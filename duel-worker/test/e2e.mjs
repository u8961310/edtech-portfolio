// 打字擂台連線後端端對端測試：先在 duel-worker 開 `npx wrangler dev --port 8788`，再跑 `node test/e2e.mjs [ws://127.0.0.1:8788]`
import assert from 'node:assert';

const BASE = process.argv[2] || 'ws://127.0.0.1:8788';
const ORIGIN = 'http://localhost:8000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
  const c = { name, events: [], ws: null };
  c.open = (path) => new Promise((resolve, reject) => {
    c.ws = new WebSocket(BASE + path, { headers: { Origin: ORIGIN } });
    c.ws.onopen = () => resolve(c);
    c.ws.onerror = (e) => reject(new Error(name + ' 連線失敗 ' + (e.message || '')));
    c.ws.onmessage = (ev) => c.events.push(JSON.parse(ev.data));
    c.ws.onclose = (ev) => c.events.push({ t: '_close', code: ev.code });
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.last = (t) => [...c.events].reverse().find((e) => e.t === t);
  c.wait = async (t, pred = () => true, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = c.events.find((x) => x.t === t && !x._seen && pred(x));
      if (e) { e._seen = true; return e; }
      await sleep(20);
    }
    throw new Error(`${name} 等不到 ${t}`);
  };
  return c;
}

let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok', name); }

const A = client('A'), B = client('B');
let code, tokenB;

await t('不明網站來源會被擋', async () => {
  const ok = await new Promise((resolve) => {
    const w = new WebSocket(BASE + '/ws?code=new', { headers: { Origin: 'https://evil.example.com' } });
    w.onopen = () => { w.close(); resolve(true); };
    w.onerror = () => resolve(false);
  });
  assert.strictEqual(ok, false);
});

await t('A 開房拿到 4 位數房號', async () => {
  await A.open('/ws?code=new');
  A.send({ t: 'create', nick: '小明<script>', best: 30 });
  const r = await A.wait('room');
  code = r.code;
  assert.match(code, /^\d{4}$/);
  assert.strictEqual(r.you.isHost, true);
  assert.strictEqual(r.players[0].nick, '小明script');   // 角括號被濾掉
});

await t('B 用房號加入，雙方都看到 2 人', async () => {
  await B.open('/ws?code=' + code);
  B.send({ t: 'join', nick: '阿寶', best: 20 });
  const rb = await B.wait('room', (r) => r.players.length === 2);
  tokenB = rb.you.token;
  assert.strictEqual(rb.you.isHost, false);
  await A.wait('room', (r) => r.players.length === 2);
});

await t('同名加入會自動加編號', async () => {
  const X = client('X'), Y = client('Y');
  await X.open('/ws?code=new');
  X.send({ t: 'create', nick: '小選手' });
  const rx = await X.wait('room');
  await Y.open('/ws?code=' + rx.code);
  Y.send({ t: 'join', nick: '小選手' });
  const ry = await Y.wait('room', (r) => r.players.length === 2);
  assert.deepStrictEqual(ry.players.map((p) => p.nick), ['小選手', '小選手2']);
  X.send({ t: 'leave' }); Y.send({ t: 'leave' });
});

await t('第三人加入被擋（房間滿）', async () => {
  const C = client('C');
  await C.open('/ws?code=' + code);
  C.send({ t: 'join', nick: '小華' });
  const e = await C.wait('error');
  assert.strictEqual(e.code, 'room-full');
});

await t('非房主改設定無效、房主改設定雙方同步', async () => {
  B.send({ t: 'settings', settings: { lang: 'en' } });
  await sleep(300);
  A.send({ t: 'settings', settings: { lang: 'zh', grade: 'low', duration: 60 } });
  const r = await B.wait('room', (x) => x.settings.grade === 'low');
  assert.strictEqual(r.settings.lang, 'zh');
  assert.strictEqual(r.settings.duration, 60);
});

await t('開打：雙方收到同一個 seed 與血量', async () => {
  A.send({ t: 'start' });
  const ca = await A.wait('countdown'), cb = await B.wait('countdown');
  assert.strictEqual(ca.seed, cb.seed);
  assert.strictEqual(Object.values(ca.maxHp)[0].maxHp, 25);
  await sleep(Math.max(0, ca.startsAt - Date.now()) + 100);
});

await t('作弊：一次跳 100 字不計', async () => {
  B.send({ t: 'prog', pos: 100, miss: 0 });
  await sleep(300);
  assert.ok(!B.events.some((e) => e.t === 'hit' && !e._seen));
});

await t('B 斷線重連用 token 接回原位，補到開局資訊', async () => {
  B.ws.close();
  await sleep(300);
  await A.wait('left', (e) => e.temporary);
  B.events = [];
  await B.open('/ws?code=' + code);
  B.send({ t: 'join', nick: '阿寶', token: tokenB });
  await B.wait('countdown');
  const r = await B.wait('room');
  assert.strictEqual(r.you.token, tokenB);
});

await t('A 穩定打字把 B 打倒，雙方收到 hit 與 end', async () => {
  let pos = 0;
  for (let i = 0; i < 40; i++) {
    pos += 2;
    A.send({ t: 'prog', pos, miss: 0 });
    await sleep(260);
    if (A.events.some((e) => e.t === 'end')) break;
  }
  const h = await B.wait('hit');
  assert.strictEqual(h.to, B.last('room').you.id);
  const ea = await A.wait('end', () => true, 8000), eb = await B.wait('end', () => true, 8000);
  assert.strictEqual(ea.winner, A.last('room').you.id);
  assert.deepStrictEqual(ea.players.map((p) => p.id), eb.players.map((p) => p.id));
  assert.strictEqual(ea.players.find((p) => p.id !== ea.winner).hp, 0);
});

await t('結束後 rematch 回到房間', async () => {
  A.send({ t: 'rematch' });
  await B.wait('room');
});

await t('房主在大廳離開：B 收到 host-left', async () => {
  A.send({ t: 'leave' });
  const e = await B.wait('error');
  assert.strictEqual(e.code, 'host-left');
});

await t('不存在的房號：no-room', async () => {
  const D = client('D');
  await D.open('/ws?code=' + code);
  D.send({ t: 'join', nick: '小李' });
  const e = await D.wait('error');
  assert.strictEqual(e.code, 'no-room');
});

console.log(`\n全部 ${n} 項通過`);
process.exit(0);
