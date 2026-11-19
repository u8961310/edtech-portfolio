/* 打字擂台（unit23）連線對戰後端
 *
 * GET  /health                → ok
 * WS   /ws?code=new           → 開新房（隨機 4 位數房號），第一個訊息送 {t:'create', nick, best}
 * WS   /ws?code=1234          → 加入房間，第一個訊息送 {t:'join', nick, best, token?}
 *
 * 一個房號一個 Durable Object（DuelRoom）。比賽規則與單機練習共用 units/unit23-typing-duel/duel-rules.js，
 * 分數只在這裡算。訊息格式見 docs/specs/unit23-duel-protocol.md 第 5 節。
 * 不存姓名、不留對戰紀錄；房間閒置 30 分鐘清空。
 */
import { DurableObject } from 'cloudflare:workers';
import R from '../../units/unit23-typing-duel/duel-rules.js';

const IDLE_MS = 30 * 60 * 1000;
const TICK_MS = 250;            // 對戰中廣播 state 的間隔
const CAPACITY = 2;             // 1 對 1；班級模式之後改這裡＋規則
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

function originOk(req, env) {
  const o = req.headers.get('Origin');
  if (!o) return false;
  if (LOCAL.test(o)) return true;
  return (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).includes(o);
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    if (url.pathname === '/') {
      // 有人直接打開伺服器網址時，給一句看得懂的說明，不要只回 not found
      return new Response(
        '<!doctype html><meta charset="utf-8"><title>打字擂台連線伺服器</title>' +
        '<body style="font:18px/1.7 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 16px">' +
        '<h1 style="font-size:24px">打字擂台連線伺服器運作中 ✅</h1>' +
        '<p>這裡是對戰用的後端，沒有畫面。要玩遊戲請到：<br>' +
        '<a href="https://u8961310.github.io/edtech-portfolio/units/unit23-typing-duel/">打字擂台</a></p></body>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
    if (url.pathname !== '/ws') return new Response('not found', { status: 404 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket', { status: 426 });
    if (!originOk(req, env)) return new Response('forbidden', { status: 403 });

    const code = url.searchParams.get('code') || '';
    if (code === 'new') {
      // 隨機挑房號；被占用的房間會回 409，換一個再試
      for (let i = 0; i < 12; i++) {
        const c = String(1000 + Math.floor(Math.random() * 9000));
        const res = await roomStub(env, c).fetch(new Request(`https://room/ws?code=${c}&mode=host`, req));
        if (res.status === 101) return res;
      }
      return new Response('房間太多，請稍後再試', { status: 503 });
    }
    if (!/^\d{4}$/.test(code)) return new Response('房號要是 4 位數字', { status: 400 });
    return roomStub(env, code).fetch(new Request(`https://room/ws?code=${code}&mode=join`, req));
  },
};

function roomStub(env, code) {
  return env.ROOMS.get(env.ROOMS.idFromName('room-' + code));
}

function cleanNick(s) {
  const n = String(s || '').replace(/[\u0000-\u001f<>]/g, '').trim();
  return Array.from(n).slice(0, 8).join('') || '選手';
}

function rid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

export class DuelRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;     // { code, settings, hostId, players: { id: { nick, best, role, token, connected } }, order: [] }
    this.match = null;    // DuelRules 的比賽狀態（只放記憶體；對戰中有計時器，不會休眠）
    this.matchMeta = null;
    this.timer = null;
    ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get('room')) || null;
    });
  }

  // ------------------------------------------------------------ 連線進來
  async fetch(req) {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');
    const code = url.searchParams.get('code');
    const hostAlive = this.room && this.room.hostId && this.room.players[this.room.hostId] &&
      this.room.players[this.room.hostId].connected;
    if (mode === 'host' && hostAlive) return new Response('busy', { status: 409 });

    const [client, server] = Object.values(new WebSocketPair());
    if (mode === 'host') {
      await this.resetRoom();
      this.room = { code, settings: R.normalizeSettings({}), hostId: null, players: {}, order: [] };
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id: null, want: 'host' });
    } else {
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ id: null, want: 'join' });
      if (!this.room || !hostAlive) {
        server.send(JSON.stringify({ t: 'error', code: 'no-room', message: '找不到這個房號，請確認後再試' }));
        server.close(4004, 'no-room');
      }
    }
    await this.touch();
    return new Response(null, { status: 101, webSocket: client });
  }

  // ------------------------------------------------------------ 收訊息
  async webSocketMessage(ws, raw) {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.t !== 'string') return;
    const att = ws.deserializeAttachment() || {};
    await this.touch();

    if (msg.t === 'create' && att.want === 'host' && !att.id) return this.onCreate(ws, msg);
    if (msg.t === 'join' && att.want === 'join' && !att.id) return this.onJoin(ws, msg);
    if (!att.id || !this.room || !this.room.players[att.id]) return;
    const isHost = att.id === this.room.hostId;

    switch (msg.t) {
      case 'settings':
        if (!isHost || this.match) return;
        this.room.settings = R.normalizeSettings(msg.settings);
        await this.save();
        return this.broadcastRoom();
      case 'start':
        if (!isHost) return;
        return this.onStart(ws);
      case 'prog':
        return this.onProgress(att.id, msg);
      case 'rematch':
        if (this.match && !this.match.over) return;
        this.stopMatch();
        return this.broadcastRoom();
      case 'leave':
        ws.close(1000, 'leave');
        return this.onGone(ws);
    }
  }

  async onCreate(ws, msg) {
    const id = rid(), token = rid();
    this.room.hostId = id;
    this.room.players[id] = { nick: cleanNick(msg.nick), best: Math.max(0, Number(msg.best) || 0), role: 'host', token, connected: true };
    this.room.order = [id];
    ws.serializeAttachment({ id, want: 'host' });
    await this.save();
    this.broadcastRoom();
  }

  async onJoin(ws, msg) {
    const room = this.room;
    if (!room) return this.reject(ws, 'no-room', '找不到這個房號，請確認後再試');
    // 斷線重連：帶著原本的 token 回來，接回原本的位子
    const back = msg.token && room.order.find((pid) => room.players[pid].token === msg.token);
    let id;
    if (back) {
      id = back;
      room.players[id].connected = true;
    } else {
      const seated = room.order.filter((pid) => room.players[pid].role !== 'spectator');
      if (seated.length >= CAPACITY) return this.reject(ws, 'room-full', '這個擂台已經滿了');
      if (this.match && !this.match.over) return this.reject(ws, 'in-match', '對戰進行中，等這局結束再加入');
      id = rid();
      // 同名（例如兩個人都沒改預設暱稱）就加編號，結算才分得出誰贏
      let nick = cleanNick(msg.nick);
      const taken = new Set(Object.values(room.players).map((pl) => pl.nick));
      if (taken.has(nick)) {
        let k = 2;
        while (taken.has(Array.from(nick).slice(0, 7).join('') + k)) k++;
        nick = Array.from(nick).slice(0, 7).join('') + k;
      }
      room.players[id] = { nick, best: Math.max(0, Number(msg.best) || 0), role: 'player', token: rid(), connected: true };
      room.order.push(id);
    }
    ws.serializeAttachment({ id, want: 'join' });
    await this.save();
    this.broadcastRoom();
    // 對戰中重連：補送開局資訊與目前狀態
    if (back && this.match && !this.match.over) {
      this.sendTo(ws, { t: 'countdown', ...this.matchMeta });
      this.sendTo(ws, { t: 'state', ...R.snapshot(this.match, Date.now()) });
    }
  }

  reject(ws, code, message) {
    this.sendTo(ws, { t: 'error', code, message });
    ws.close(4000, code);
  }

  onStart(ws) {
    if (this.match && !this.match.over) return;
    const room = this.room;
    const seated = room.order.filter((pid) => room.players[pid].role !== 'spectator' && room.players[pid].connected);
    if (seated.length < CAPACITY) {
      return this.sendTo(ws, { t: 'error', code: 'not-enough-players', message: '還沒有對手進來，等同學輸入房號吧' });
    }
    const seed = Math.floor(Math.random() * 4294967296);
    const startAt = Date.now() + R.CONFIG.COUNTDOWN_MS;
    const players = seated.map((pid) => ({ id: pid, nick: room.players[pid].nick, best: room.players[pid].best }));
    this.match = R.newMatch(room.settings, players, startAt);
    this.matchMeta = {
      startsAt: startAt, duration: this.match.settings.duration, settings: this.match.settings, seed,
      players: players.map((p) => ({ id: p.id, nick: p.nick })),
      maxHp: R.snapshot(this.match, startAt).players,
    };
    this.broadcast({ t: 'countdown', ...this.matchMeta });
    clearInterval(this.timer);
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  onProgress(id, msg) {
    if (!this.match || this.match.over) return;
    const now = Date.now();
    const r = R.applyProgress(this.match, id, msg, now);
    if (r.ok && r.damage > 0) {
      this.broadcast({ t: 'hit', from: id, to: r.target, damage: r.damage, combo: this.match.players[id].combo });
    }
    if (R.isOver(this.match, now)) this.finish(now);
  }

  tick() {
    if (!this.match) return clearInterval(this.timer);
    const now = Date.now();
    if (now < this.match.startAt) return;
    this.broadcast({ t: 'state', ...R.snapshot(this.match, now) });
    if (R.isOver(this.match, now)) this.finish(now);
  }

  finish(now) {
    clearInterval(this.timer);
    this.timer = null;
    if (this.matchEnded) return;
    this.matchEnded = true;
    this.broadcast({ t: 'state', ...R.snapshot(this.match, now) });
    this.broadcast({ t: 'end', ...R.result(this.match, now) });
  }

  stopMatch() {
    clearInterval(this.timer);
    this.timer = null;
    this.match = null;
    this.matchMeta = null;
    this.matchEnded = false;
  }

  // ------------------------------------------------------------ 斷線
  async webSocketClose(ws) { await this.onGone(ws); }
  async webSocketError(ws) { await this.onGone(ws); }

  async onGone(ws) {
    const att = ws.deserializeAttachment() || {};
    const room = this.room;
    if (!att.id || !room || !room.players[att.id]) return;
    const p = room.players[att.id];
    if (!p.connected) return;
    p.connected = false;
    const inMatch = this.match && !this.match.over;
    if (inMatch) {
      // 對戰中斷線：保留位子等他用 token 回來，比賽照常進行到時間結束
      this.broadcast({ t: 'left', id: att.id, temporary: true });
    } else if (att.id === room.hostId) {
      // 房主在大廳離開：整間房解散
      this.broadcast({ t: 'error', code: 'host-left', message: '房主離開了，擂台已關閉' });
      for (const s of this.ctx.getWebSockets()) { try { s.close(4001, 'host-left'); } catch {} }
      await this.resetRoom();
      return;
    } else {
      delete room.players[att.id];
      room.order = room.order.filter((pid) => pid !== att.id);
      this.broadcast({ t: 'left', id: att.id });
    }
    await this.save();
    this.broadcastRoom();
  }

  // ------------------------------------------------------------ 閒置清理
  async touch() {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
  }

  async alarm() {
    if (this.match && !this.match.over) return this.touch();
    for (const s of this.ctx.getWebSockets()) { try { s.close(4002, 'idle'); } catch {} }
    await this.resetRoom();
  }

  async resetRoom() {
    this.stopMatch();
    this.room = null;
    await this.ctx.storage.deleteAll();
  }

  async save() {
    if (this.room) await this.ctx.storage.put('room', this.room);
  }

  // ------------------------------------------------------------ 送訊息
  roomFor(id) {
    const room = this.room;
    return {
      t: 'room', code: room.code, mode: 'net', capacity: CAPACITY, settings: room.settings, serverNow: Date.now(),
      you: { id, isHost: id === room.hostId, token: room.players[id] ? room.players[id].token : null },
      players: room.order.map((pid) => ({
        id: pid, nick: room.players[pid].nick, role: room.players[pid].role, connected: room.players[pid].connected,
      })),
    };
  }

  broadcastRoom() {
    if (!this.room) return;
    for (const s of this.ctx.getWebSockets()) {
      const att = s.deserializeAttachment() || {};
      if (att.id) this.sendTo(s, this.roomFor(att.id));
    }
  }

  broadcast(obj) {
    const data = JSON.stringify(obj);
    for (const s of this.ctx.getWebSockets()) {
      const att = s.deserializeAttachment() || {};
      if (att.id) { try { s.send(data); } catch {} }
    }
  }

  sendTo(ws, obj) {
    try { ws.send(JSON.stringify(obj)); } catch {}
  }
}
