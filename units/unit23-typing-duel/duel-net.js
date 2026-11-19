/* 打字擂台：連線對戰的「對手介面」（Claude 維護）
 *
 * 載入順序在 duel-core.js 之後；載入後覆蓋 DuelCore.netAvailable 與 DuelCore.createNetTransport。
 * 方法與事件跟 createBotTransport 完全一樣（見 docs/specs/unit23-duel-protocol.md 第 2、5 節），畫面不用分兩套。
 *
 * 伺服器網址：預設 DUEL_URL；本機測試可在網址加 ?duel=ws://127.0.0.1:8787
 */
(function (root) {
  'use strict';
  var Core = root.DuelCore, R = root.DuelRules;
  if (!Core || !R) return;

  var DUEL_URL = 'wss://edtech-duel.edtech-analytics.workers.dev';
  var SEND_GAP_MS = 150;          // 打字進度最多每 0.15 秒送一次（只送最新值）
  var RETRY = [500, 1000, 2000, 4000, 6000];

  function baseUrl(opts) {
    if (opts && opts.url) return opts.url;
    try {
      var q = new URLSearchParams(root.location.search).get('duel');
      if (q && /^wss?:\/\//.test(q)) return q.replace(/\/$/, '');
    } catch (e) {}
    return DUEL_URL;
  }

  function tokenKey(code) { return 'edtech-unit23-token-' + code; }
  function getToken(code) { try { return root.sessionStorage.getItem(tokenKey(code)); } catch (e) { return null; } }
  function setToken(code, t) { try { root.sessionStorage.setItem(tokenKey(code), t); } catch (e) {} }

  function createNetTransport(opts) {
    var map = {};
    function emit(type, data) {
      (map[type] || []).slice().forEach(function (fn) {
        try { fn(data); } catch (e) { console.error('[DuelNet] ' + type + ' handler 出錯', e); }
      });
    }
    var base = baseUrl(opts);
    var ws = null, code = null, me = null, offset = 0, closedByUs = false, retries = 0;
    var pending = null, lastSent = 0, sendTimer = null;

    function send(obj) {
      if (ws && ws.readyState === 1) ws.send(JSON.stringify(obj));
    }

    function connect(path, hello) {
      closedByUs = false;
      try { ws = new WebSocket(base + path); } catch (e) {
        emit('error', { code: 'connect-failed', message: '連不上對戰伺服器，請檢查網路，或先對電腦練習' });
        return;
      }
      ws.onopen = function () { retries = 0; send(hello()); };
      ws.onmessage = function (ev) {
        var m; try { m = JSON.parse(ev.data); } catch (e) { return; }
        var t = m.t; delete m.t;
        if (t === 'room') {
          code = m.code;
          if (m.serverNow) offset = m.serverNow - Date.now();
          if (m.you && m.you.token) setToken(code, m.you.token);
          me = m.you && m.you.id;
          emit('room', m);
        } else if (t === 'countdown') {
          // 伺服器只給 seed，文章順序在本機用同一套規則算（雙方結果相同）
          m.seq = R.pickSequence(root.PASSAGES || [], m.settings, m.seed);
          emit('countdown', m);
        } else if (t) {
          emit(t, m);
        }
      };
      ws.onclose = function (ev) {
        ws = null;
        if (closedByUs) return;
        // 伺服器主動關（房號錯、房間滿、房主離開、閒置）：不重連，錯誤訊息已經先送到
        if (ev.code >= 4000 && ev.code < 5000) return;
        if (code && retries < RETRY.length) {
          setTimeout(function () { reconnect(); }, RETRY[retries++]);
        } else {
          emit('error', { code: 'disconnected', message: '連線中斷了，請回大廳重新加入擂台' });
        }
      };
    }

    var who = { nick: '', best: 0 };   // 重連時沿用原本的暱稱

    function reconnect() {
      var c = code;
      connect('/ws?code=' + c, function () {
        return { t: 'join', nick: who.nick, best: who.best, token: getToken(c) };
      });
    }

    function flush() {
      sendTimer = null;
      if (!pending) return;
      send({ t: 'prog', pos: pending.pos, miss: pending.miss });
      lastSent = Date.now();
      pending = null;
    }

    return {
      kind: 'net',
      on: function (type, fn) { (map[type] = map[type] || []).push(fn); },
      off: function (type, fn) { map[type] = (map[type] || []).filter(function (f) { return f !== fn; }); },
      now: function () { return Date.now() + offset; },
      create: function (p) {
        who = { nick: (p && p.nick) || '', best: (p && p.best) || 0 };
        connect('/ws?code=new', function () { return { t: 'create', nick: who.nick, best: who.best }; });
      },
      join: function (c, p) {
        c = String(c || '').trim();
        if (!/^\d{4}$/.test(c)) {
          setTimeout(function () { emit('error', { code: 'bad-code', message: '房號要是 4 位數字' }); }, 0);
          return;
        }
        code = c;
        who = { nick: (p && p.nick) || '', best: (p && p.best) || 0 };
        connect('/ws?code=' + c, function () {
          return { t: 'join', nick: who.nick, best: who.best, token: getToken(c) };
        });
      },
      setSettings: function (s) { send({ t: 'settings', settings: s }); },
      start: function () { send({ t: 'start' }); },
      progress: function (pos, miss) {
        pending = { pos: pos, miss: miss };
        var wait = SEND_GAP_MS - (Date.now() - lastSent);
        if (wait <= 0) flush();
        else if (!sendTimer) sendTimer = setTimeout(flush, wait);
      },
      rematch: function () { send({ t: 'rematch' }); },
      leave: function () {
        closedByUs = true;
        send({ t: 'leave' });
        if (ws) { try { ws.close(1000, 'leave'); } catch (e) {} }
        ws = null;
      }
    };
  }

  Core.netAvailable = function () { return typeof root.WebSocket === 'function'; };
  Core.createNetTransport = createNetTransport;
})(typeof globalThis !== 'undefined' ? globalThis : this);
