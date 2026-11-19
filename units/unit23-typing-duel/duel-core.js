/* 打字擂台：遊戲核心（Claude 維護，Gemini 產的畫面只呼叫這裡，不要改這支）
 *
 * 需要先載入：passages.js（window.PASSAGES）、duel-rules.js（window.DuelRules）
 * 提供 window.DuelCore：
 *   1. createBotTransport(opts)  對電腦練習的「對手介面」，本機當裁判
 *      createNetTransport(opts)  連線對戰的「對手介面」（M4 由 duel-net.js 補上；之前 netAvailable() 回 false）
 *      兩者事件與方法完全相同，畫面不用管對手是誰
 *   2. createTracker(seq, lang)   打字比對器：餵輸入、回報對錯、累計 pos／miss、錯字清單
 *   3. zhKeys(zhuyin)／enKey(ch)  第 2、3 層提示要顯示的按鍵
 * 規格：docs/specs/unit23-duel-protocol.md
 */
(function (root) {
  'use strict';
  var R = root.DuelRules;
  var BY_ID = {};
  (root.PASSAGES || []).forEach(function (p) { BY_ID[p.id] = p; });

  // ------------------------------------------------------------ 小工具：事件
  function emitter() {
    var map = {};
    return {
      on: function (type, fn) { (map[type] = map[type] || []).push(fn); },
      off: function (type, fn) { map[type] = (map[type] || []).filter(function (f) { return f !== fn; }); },
      emit: function (type, data) {
        (map[type] || []).slice().forEach(function (fn) {
          try { fn(data); } catch (e) { console.error('[DuelCore] ' + type + ' handler 出錯', e); }
        });
      }
    };
  }

  // ------------------------------------------------------------ 1. 對電腦練習
  var BOT_SPEED = { easy: 0.7, normal: 1, hard: 1.3 };

  /**
   * opts.level：'easy' | 'normal' | 'hard'（機器人快慢，預設 normal）
   * 方法：create({nick,best}) setSettings(s) start() progress(pos,miss) rematch() leave() now() on() off()
   * join() 對電腦不適用，會回 error。
   */
  function createBotTransport(opts) {
    opts = opts || {};
    var ev = emitter();
    var level = BOT_SPEED[opts.level] ? opts.level : 'normal';
    var me = null, bot = { id: 'bot', nick: '機器人', best: 0, isBot: true };
    var settings = R.normalizeSettings({});
    var match = null, timer = null, botAcc = 0, botPos = 0, botMiss = 0;

    function roomInfo() {
      return {
        code: null, mode: 'bot', capacity: 2, settings: settings,
        you: { id: me.id, isHost: true },
        players: [
          { id: me.id, nick: me.nick, role: 'host', connected: true },
          { id: bot.id, nick: bot.nick, role: 'player', connected: true, isBot: true }
        ]
      };
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    function tick() {
      var now = Date.now();
      if (now < match.startAt) return;
      // 機器人照 CPM 慢慢打，偶爾打錯
      var cpm = R.CONFIG.BOT[settings.lang][settings.grade] * BOT_SPEED[level];
      botAcc += (cpm / 60) * 0.2 * (0.6 + Math.random() * 0.8);
      while (botAcc >= 1) {
        botAcc -= 1;
        if (Math.random() < R.CONFIG.BOT.MISS_RATE) botMiss += 1; else botPos += 1;
      }
      apply(bot.id, botPos, botMiss, now);
      ev.emit('state', R.snapshot(match, now));
      if (R.isOver(match, now)) finish(now);
    }

    function apply(id, pos, miss, now) {
      var r = R.applyProgress(match, id, { pos: pos, miss: miss }, now);
      if (r.ok && r.damage > 0) {
        ev.emit('hit', { from: id, to: r.target, damage: r.damage, combo: match.players[id].combo });
      }
      return r;
    }

    function finish(now) {
      stop();
      ev.emit('state', R.snapshot(match, now));
      ev.emit('end', R.result(match, now));
    }

    return {
      kind: 'bot',
      on: ev.on, off: ev.off,
      now: function () { return Date.now(); },
      create: function (p) {
        me = { id: 'me', nick: (p && p.nick) || '我', best: (p && p.best) || 0 };
        setTimeout(function () { ev.emit('room', roomInfo()); }, 0);
      },
      join: function () {
        setTimeout(function () { ev.emit('error', { code: 'bot-no-join', message: '對電腦練習不用輸入房號' }); }, 0);
      },
      setSettings: function (s) { settings = R.normalizeSettings(s); ev.emit('room', roomInfo()); },
      setBotLevel: function (lv) { if (BOT_SPEED[lv]) level = lv; },
      start: function () {
        stop();
        var seed = Math.floor(Math.random() * 4294967296);
        var startAt = Date.now() + R.CONFIG.COUNTDOWN_MS;
        bot.best = Math.round(R.CONFIG.BOT[settings.lang][settings.grade] * BOT_SPEED[level]);
        match = R.newMatch(settings, [me, bot], startAt);
        botAcc = 0; botPos = 0; botMiss = 0;
        ev.emit('countdown', {
          startsAt: startAt, duration: settings.duration, settings: settings, seed: seed,
          seq: R.pickSequence(root.PASSAGES || [], settings, seed),
          players: [{ id: me.id, nick: me.nick }, { id: bot.id, nick: bot.nick, isBot: true }],
          maxHp: R.snapshot(match, startAt).players
        });
        timer = setInterval(tick, 200);
      },
      progress: function (pos, miss) {
        if (!match || match.over) return;
        var now = Date.now();
        apply(me.id, pos, miss, now);
        if (R.isOver(match, now)) finish(now);
      },
      rematch: function () { stop(); match = null; ev.emit('room', roomInfo()); },
      leave: function () { stop(); match = null; }
    };
  }

  // 連線版在 duel-net.js（M4）。載入後會覆蓋這兩個函式。
  function netAvailable() { return false; }
  function createNetTransport() { throw new Error('連線對戰還沒開放（duel-net.js 未載入）'); }

  // ------------------------------------------------------------ 2. 打字比對器
  var IVS_BASE = 0xE01E0;

  /** 文章第 i 個字「顯示用」的字串：破音字補上異體字選擇器，注音粉圓才會畫出正確讀音 */
  function displayChar(p, i) {
    var n = p.ivs && p.ivs[i];
    return n && n > 1 ? p.text[i] + String.fromCodePoint(IVS_BASE + n - 1) : p.text[i];
  }

  /** 中打時哪些字自動跳過（標點、空白等沒有注音的字），不用打、不算分 */
  function isAuto(p, i) {
    return p.lang === 'zh' && !(p.zhuyin && p.zhuyin[i]);
  }

  /**
   * seq：countdown 事件給的文章 id 陣列；lang：'zh' | 'en'
   * 回傳的 tracker：
   *   current()        → { passage, index, ch, zhuyin, tier }  目前要打的字（tier＝這個字已錯幾次：0～3+）
   *   commit(text)     → 中打：把輸入法「選字完成」的文字整串丟進來
   *   key(ch)          → 英打：每按一個字元丟進來（e.key，長度 1 的才丟）
   *     兩者都回傳 { correct: 打對幾字, wrong: true/false, tier: 錯的那個字現在第幾次錯, passageDone: 這批有沒有換篇 }
   *     打錯時停在錯的字，後面多打的字丟掉；畫面據此清空輸入框、顯示提示
   *   pos / miss       → 累計打對字數／打錯次數，直接傳給 transport.progress(pos, miss)
   *   mistakes()       → 錯字清單 [{ ch, zhuyin, count }]，錯越多排越前（結算頁「錯字回顧」用）
   */
  function createTracker(seq, lang) {
    var pi = 0, ci = 0;
    var t = { pos: 0, miss: 0 };
    var missAt = {};     // 'pi:ci' → 這個字錯幾次（換篇不重置；同篇重來會從 0 開始算是新位置）
    var wrongBook = {};  // 字 → { ch, zhuyin, count }

    function passage() { return BY_ID[seq[pi % seq.length]]; }
    function skipAuto() {
      var moved = false;
      for (var guard = 0; guard < 10000; guard++) {
        var p = passage();
        if (ci >= p.text.length) { pi += 1; ci = 0; moved = true; continue; }
        if (isAuto(p, ci)) { ci += 1; continue; }
        break;
      }
      return moved;
    }
    skipAuto();

    t.current = function () {
      var p = passage();
      return {
        passage: p, passageIndex: pi, index: ci, ch: p.text[ci],
        zhuyin: p.zhuyin ? p.zhuyin[ci] : '', tier: missAt[pi + ':' + ci] || 0
      };
    };

    function hit() { t.pos += 1; ci += 1; return skipAuto(); }
    function wrong() {
      var cur = t.current();
      var k = pi + ':' + ci;
      missAt[k] = (missAt[k] || 0) + 1;
      t.miss += 1;
      var w = wrongBook[cur.ch] || (wrongBook[cur.ch] = { ch: cur.ch, zhuyin: cur.zhuyin, count: 0 });
      w.count += 1;
      return missAt[k];
    }

    t.commit = function (text) {
      var res = { correct: 0, wrong: false, tier: 0, passageDone: false };
      var chars = Array.from(String(text || '').replace(/\s+/g, ''));
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i];
        if (/[︀-️]/.test(c) || (c.codePointAt(0) >= 0xE0100 && c.codePointAt(0) <= 0xE01EF)) continue;
        var cur = t.current();
        if (isPunct(c) && !isPunct(cur.ch)) continue;   // 學生多打的標點不算錯
        if (c === cur.ch) { if (hit()) res.passageDone = true; res.correct += 1; }
        else { res.wrong = true; res.tier = wrong(); break; }
      }
      return res;
    };

    t.key = function (c) {
      var res = { correct: 0, wrong: false, tier: 0, passageDone: false };
      if (!c || c.length !== 1) return res;
      var cur = t.current();
      if (c === cur.ch) { res.passageDone = hit(); res.correct = 1; }
      else { res.wrong = true; res.tier = wrong(); }
      return res;
    };

    t.mistakes = function () {
      return Object.keys(wrongBook).map(function (k) { return wrongBook[k]; })
        .sort(function (a, b) { return b.count - a.count; });
    };
    return t;
  }

  function isPunct(c) { return /[，。、；：？！「」『』（）《》…—．,.;:?!'"()\-]/.test(c); }

  // ------------------------------------------------------------ 3. 按鍵提示
  // 標準注音（大千）鍵盤：注音符號 → 鍵盤上的鍵
  var BPMF_KEYS = {
    'ㄅ': '1', 'ㄆ': 'Q', 'ㄇ': 'A', 'ㄈ': 'Z', 'ㄉ': '2', 'ㄊ': 'W', 'ㄋ': 'S', 'ㄌ': 'X',
    'ˇ': '3', 'ㄍ': 'E', 'ㄎ': 'D', 'ㄏ': 'C', 'ˋ': '4', 'ㄐ': 'R', 'ㄑ': 'F', 'ㄒ': 'V',
    'ㄓ': '5', 'ㄔ': 'T', 'ㄕ': 'G', 'ㄖ': 'B', 'ˊ': '6', 'ㄗ': 'Y', 'ㄘ': 'H', 'ㄙ': 'N',
    '˙': '7', 'ㄧ': 'U', 'ㄨ': 'J', 'ㄩ': 'M', 'ㄚ': '8', 'ㄛ': 'I', 'ㄜ': 'K', 'ㄝ': ',',
    'ㄞ': '9', 'ㄟ': 'O', 'ㄠ': 'L', 'ㄡ': '.', 'ㄢ': '0', 'ㄣ': 'P', 'ㄤ': ';', 'ㄥ': '/',
    'ㄦ': '-'
  };

  /**
   * 一個字的注音 → 照輸入法實際按鍵順序排好的按鍵清單
   * 例：'ㄓㄥ' → [{sym:'ㄓ',key:'5'},{sym:'ㄥ',key:'/'},{sym:'一聲',key:'空白鍵'}]
   *     '˙ㄉㄜ' → 輕聲的點寫在前面，但要最後按：ㄉ(2) ㄜ(K) ˙(7)
   */
  function zhKeys(zhuyin) {
    if (!zhuyin) return [];
    var syms = Array.from(zhuyin);
    var light = syms[0] === '˙';
    if (light) syms.shift();
    var out = syms.map(function (s) { return { sym: s, key: BPMF_KEYS[s] || s }; });
    var last = syms[syms.length - 1];
    if (light) out.push({ sym: '˙', key: '7' });
    else if ('ˊˇˋ'.indexOf(last) < 0) out.push({ sym: '一聲', key: '空白鍵' });
    return out;
  }

  /** 英打要按的鍵：大寫要加 Shift */
  function enKey(ch) {
    if (ch === ' ') return { key: '空白鍵', shift: false };
    if (/[A-Z]/.test(ch)) return { key: ch, shift: true };
    if (/[a-z]/.test(ch)) return { key: ch.toUpperCase(), shift: false };
    var shifted = { '!': '1', '?': '/', '"': "'", ':': ';' };
    if (shifted[ch]) return { key: shifted[ch], shift: true };
    return { key: ch, shift: false };
  }

  root.DuelCore = {
    createBotTransport: createBotTransport,
    createNetTransport: createNetTransport,
    netAvailable: netAvailable,
    createTracker: createTracker,
    displayChar: displayChar,
    isAuto: isAuto,
    passage: function (id) { return BY_ID[id]; },
    domains: function (lang, grade) {
      var seen = {};
      (root.PASSAGES || []).forEach(function (p) {
        if (p.lang === lang && (!grade || p.grade === grade)) seen[p.domain] = true;
      });
      return Object.keys(seen);
    },
    zhKeys: zhKeys,
    enKey: enKey,
    BPMF_KEYS: BPMF_KEYS
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
