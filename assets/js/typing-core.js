/* ================= 打字島共用核心（純邏輯，不碰畫面） =================
 * 8 關共用：設定、選文、打字比對、按鍵對照、回合、成績、星等、存檔。
 * 畫面在 typing-ui.js；每關的遊戲場景只負責動畫，邏輯一律呼叫這裡。
 * 規格：docs/plans/2026-11-20-typing-island-revamp-plan.html、.interface-design/system.md
 * 測試：node tools/test-typing-core.js
 *
 * 依賴（頁面先載入）：assets/typing/passages.js（window.PASSAGES，中打）、assets/typing/en-items.js（window.EN_ITEMS，英打）
 * 比對器沿用 unit23 打字擂台 duel-core.js 的寫法（輸入法 commit 比對、標點自動跳過、錯字本）。
 */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ 1. 設定
  // 階級：注音 on＝固定開、optional＝可切換（預設關）；cpm＝三星的速度目標（每分鐘正確字數）
  var TIERS = {
    t1: { id: 't1', name: '初階', grades: '1–3 年級', zhuyin: 'on', cpm: 15, enSet: '字母' },
    t2: { id: 't2', name: '進階', grades: '4–5 年級', zhuyin: 'on', cpm: 25, enSet: '單字' },
    t3: { id: 't3', name: '高階', grades: '6 年級', zhuyin: 'optional', cpm: 35, enSet: '句子' }
  };
  // 時間 → 回合數（每回合約 2.5～3.3 分鐘，回合間有休息卡）
  // 0.5＝30 秒 1 回合，只給功能測試用：網址帶 ?test=1 才出現、才被接受（學生畫面看不到）
  var ROUNDS = { 0.5: 1, 10: 4, 15: 5, 20: 6 };
  var TEST_MINUTES = 0.5;
  var ZH_SETS = ['唐詩', '宋詞', '三字經'];
  var GOAL_ACCURACY = 90;      // 本局目標：正確率（%）
  var STAR2_ACCURACY = 85;     // ★★ 門檻
  var STAR3_ACCURACY = 95;     // ★★★ 門檻（另加速度目標）
  var RANKS = ['打字小學徒', '打字小高手', '打字小達人'];
  var LIVES = 5;               // 每回合愛心數

  var DEFAULTS = { lang: 'zh', tier: 't1', minutes: 10, set: 'random', zhuyin: true };

  /** 合法的分鐘數？測試的 30 秒只有 test 模式才算 */
  function okMinutes(m, test) {
    m = Number(m);
    return !!ROUNDS[m] && (m !== TEST_MINUTES || !!test);
  }

  /** ?test=1：功能測試模式（多一個 30 秒選項） */
  function isTestMode(search) { return /(^|[?&])test=1(&|$)/.test(String(search || '')); }

  /** 分鐘數 → 顯示文字：0.5 → 「30 秒」，10 → 「10 分鐘」 */
  function minutesText(m) { return m < 1 ? Math.round(m * 60) + ' 秒' : m + ' 分鐘'; }

  /** 把任何輸入整理成合法設定；初階、進階的注音一律開。opt.test＝允許 30 秒測試 */
  function normalizeSettings(s, opt) {
    s = s || {};
    var test = !!(opt && opt.test);
    var out = {
      lang: s.lang === 'en' ? 'en' : 'zh',
      tier: TIERS[s.tier] ? s.tier : DEFAULTS.tier,
      minutes: okMinutes(s.minutes, test) ? Number(s.minutes) : DEFAULTS.minutes,
      set: ZH_SETS.indexOf(s.set) >= 0 ? s.set : 'random',
      zhuyin: s.zhuyin === undefined ? true : !!s.zhuyin
    };
    if (TIERS[out.tier].zhuyin === 'on') out.zhuyin = true;
    return out;
  }

  // 網址參數的英文代號 ↔ 中文類別（老師用網址帶設定：?tier=t1&min=15&set=tang）
  var SET_CODES = { tang: '唐詩', song: '宋詞', szj: '三字經', random: 'random' };

  /** 從 location.search 讀老師帶的設定；沒帶的欄位不出現（由畫面決定預設） */
  function settingsFromQuery(search) {
    var q = {};
    String(search || '').replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('=');
      var k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i));
      var v = decodeURIComponent(i < 0 ? '' : kv.slice(i + 1));
      q[k] = v;
    });
    var out = {};
    if (q.tier && TIERS[q.tier]) out.tier = q.tier;
    if (q.min && ROUNDS[Number(q.min)]) out.minutes = Number(q.min);
    if (q.set && SET_CODES[q.set]) out.set = SET_CODES[q.set];
    if (q.lang === 'en' || q.lang === 'zh') out.lang = q.lang;
    if (q.zhuyin === '0' || q.zhuyin === '1') out.zhuyin = q.zhuyin === '1';
    return out;
  }

  /** 回合規劃：{ rounds, roundSec } */
  function roundPlan(minutes) {
    var m = ROUNDS[minutes] ? minutes : DEFAULTS.minutes;
    return { rounds: ROUNDS[m], roundSec: Math.round(m * 60 / ROUNDS[m]) };
  }

  // ------------------------------------------------------------ 2. 選文
  function rng(seed) { // mulberry32：同 seed 同順序，測試與重玩可重現
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pool(settings) {
    var s = normalizeSettings(settings);
    if (s.lang === 'en') {
      return (root.EN_ITEMS || []).filter(function (p) { return p.grade === s.tier; });
    }
    return (root.PASSAGES || []).filter(function (p) {
      return p.lang === 'zh' && p.grade === s.tier && (s.set === 'random' || p.domain === s.set);
    });
  }

  /** 依設定挑文章，回傳打亂順序的文章物件陣列（一局內不重複，用完才從頭） */
  function pickSequence(settings, seed) {
    var list = pool(settings).slice();
    var r = rng(seed == null ? Date.now() : seed);
    for (var i = list.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
    }
    return list;
  }

  // ------------------------------------------------------------ 3. 顯示與比對
  var IVS_BASE = 0xE01E0;

  /** 第 i 個字「顯示用」字串：破音字補異體字選擇器，注音字型才會畫出指定讀音。任何顯示國字的地方都要經過這裡 */
  function displayChar(p, i) {
    var n = p.ivs && p.ivs[i];
    return n && n > 1 ? p.text[i] + String.fromCodePoint(IVS_BASE + n - 1) : p.text[i];
  }

  /** 中打自動跳過的字（標點等沒有注音的字）：不用打、不算分 */
  function isAuto(p, i) {
    return p.lang === 'zh' && !(p.zhuyin && p.zhuyin[i]);
  }

  function isPunct(c) { return /[，。、；：？！「」『』（）《》…—．,.;:?!'"()\-]/.test(c); }

  /**
   * passages：pickSequence 給的文章物件陣列；用完會從頭循環
   * tracker：
   *   current()      → { passage, passageIndex, index, ch, display, zhuyin, tier }（tier＝這個字已錯幾次）
   *   upcoming(n)    → 從目前字起算 n 個要打的字（射擊類掉落物用），每個 { ch, display, zhuyin, passageIndex, index }
   *   commit(text)   → 中打：輸入法選字完成的文字整串丟進來
   *   key(ch)        → 英打：每按一個字元丟進來
   *     都回傳 { correct, wrong, tier, passageDone, combo }
   *   pos / miss / combo / maxCombo / passagesDone
   *   mistakes()     → [{ ch, display, zhuyin, count }] 錯越多越前
   */
  function createTracker(passages) {
    if (!passages || !passages.length) throw new Error('沒有可用的文章');
    var pi = 0, ci = 0;
    var t = { pos: 0, miss: 0, combo: 0, maxCombo: 0, passagesDone: 0 };
    var missAt = {}, wrongBook = {};

    function passage(k) { return passages[(k == null ? pi : k) % passages.length]; }
    function skipAuto() {
      var moved = false;
      for (var guard = 0; guard < 100000; guard++) {
        var p = passage();
        if (ci >= p.text.length) { pi += 1; ci = 0; moved = true; t.passagesDone += 1; continue; }
        if (isAuto(p, ci)) { ci += 1; continue; }
        break;
      }
      return moved;
    }
    skipAuto();

    t.current = function () {
      var p = passage();
      return {
        passage: p, passageIndex: pi, index: ci, ch: p.text[ci], display: displayChar(p, ci),
        zhuyin: p.zhuyin ? p.zhuyin[ci] : '', tier: missAt[pi + ':' + ci] || 0
      };
    };

    t.upcoming = function (n) {
      var out = [], k = pi, j = ci;
      for (var guard = 0; out.length < n && guard < 100000; guard++) {
        var p = passage(k);
        if (j >= p.text.length) { k += 1; j = 0; continue; }
        if (!isAuto(p, j)) out.push({ ch: p.text[j], display: displayChar(p, j), zhuyin: p.zhuyin ? p.zhuyin[j] : '', passageIndex: k, index: j });
        j += 1;
      }
      return out;
    };

    function hit() {
      t.pos += 1; ci += 1; t.combo += 1;
      if (t.combo > t.maxCombo) t.maxCombo = t.combo;
      return skipAuto();
    }
    function wrong() {
      var cur = t.current();
      var k = pi + ':' + ci;
      missAt[k] = (missAt[k] || 0) + 1;
      t.miss += 1; t.combo = 0;
      var w = wrongBook[cur.ch] || (wrongBook[cur.ch] = { ch: cur.ch, display: cur.display, zhuyin: cur.zhuyin, count: 0 });
      w.count += 1;
      return missAt[k];
    }
    function result() { return { correct: 0, wrong: false, tier: 0, passageDone: false, combo: 0 }; }

    t.commit = function (text) {
      var res = result();
      var chars = Array.from(String(text || '').replace(/\s+/g, ''));
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i], cp = c.codePointAt(0);
        if ((cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF)) continue;
        var cur = t.current();
        if (isPunct(c) && !isPunct(cur.ch)) continue;   // 學生多打的標點不算錯
        if (c === cur.ch) { if (hit()) res.passageDone = true; res.correct += 1; }
        else { res.wrong = true; res.tier = wrong(); break; }
      }
      res.combo = t.combo;
      return res;
    };

    t.key = function (c) {
      var res = result();
      if (!c || c.length !== 1) return res;
      var cur = t.current();
      if (c === cur.ch) { res.passageDone = hit(); res.correct = 1; }
      else { res.wrong = true; res.tier = wrong(); }
      res.combo = t.combo;
      return res;
    };

    t.mistakes = function () {
      return Object.keys(wrongBook).map(function (k) { return wrongBook[k]; })
        .sort(function (a, b) { return b.count - a.count; });
    };
    return t;
  }

  // ------------------------------------------------------------ 4. 鍵盤（唯一一份資料：大鍵盤圖與鍵帽都從這裡產生）
  // 大千注音：注音 → 鍵
  var BPMF_KEYS = {
    'ㄅ': '1', 'ㄆ': 'Q', 'ㄇ': 'A', 'ㄈ': 'Z', 'ㄉ': '2', 'ㄊ': 'W', 'ㄋ': 'S', 'ㄌ': 'X',
    'ˇ': '3', 'ㄍ': 'E', 'ㄎ': 'D', 'ㄏ': 'C', 'ˋ': '4', 'ㄐ': 'R', 'ㄑ': 'F', 'ㄒ': 'V',
    'ㄓ': '5', 'ㄔ': 'T', 'ㄕ': 'G', 'ㄖ': 'B', 'ˊ': '6', 'ㄗ': 'Y', 'ㄘ': 'H', 'ㄙ': 'N',
    '˙': '7', 'ㄧ': 'U', 'ㄨ': 'J', 'ㄩ': 'M', 'ㄚ': '8', 'ㄛ': 'I', 'ㄜ': 'K', 'ㄝ': ',',
    'ㄞ': '9', 'ㄟ': 'O', 'ㄠ': 'L', 'ㄡ': '.', 'ㄢ': '0', 'ㄣ': 'P', 'ㄤ': ';', 'ㄥ': '/',
    'ㄦ': '-'
  };
  var KEY_BPMF = {};
  Object.keys(BPMF_KEYS).forEach(function (s) { KEY_BPMF[BPMF_KEYS[s]] = s; });

  // 實體筆電鍵盤主鍵區 5 排；每格 [鍵名, 寬度（格）]。每排合計 15 格；左右手分區用 hand
  var KEYBOARD = [
    [['`', 1], ['1', 1], ['2', 1], ['3', 1], ['4', 1], ['5', 1], ['6', 1], ['7', 1], ['8', 1], ['9', 1], ['0', 1], ['-', 1], ['=', 1], ['Backspace', 2]],
    [['Tab', 1.5], ['Q', 1], ['W', 1], ['E', 1], ['R', 1], ['T', 1], ['Y', 1], ['U', 1], ['I', 1], ['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]],
    [['Caps Lock', 1.75], ['A', 1], ['S', 1], ['D', 1], ['F', 1], ['G', 1], ['H', 1], ['J', 1], ['K', 1], ['L', 1], [';', 1], ["'", 1], ['Enter', 2.25]],
    [['Shift', 2.25], ['Z', 1], ['X', 1], ['C', 1], ['V', 1], ['B', 1], ['N', 1], ['M', 1], [',', 1], ['.', 1], ['/', 1], ['Shift', 2.75]],
    [['Ctrl', 1.5], ['Win', 1.5], ['Alt', 1.5], ['空白鍵', 6.25], ['Alt', 1.5], ['Fn', 1.25], ['Ctrl', 1.5]]
  ];
  var LEFT_HAND = '`12345QWERTASDFGZXCVB';
  function keyHand(k) { return k.length === 1 ? (LEFT_HAND.indexOf(k) >= 0 ? 'L' : 'R') : ''; }

  /**
   * 一個字的注音 → 照輸入法實際按鍵順序的按鍵清單
   * 'ㄓㄥ' → ㄓ(5) ㄥ(/) 一聲(空白鍵)；'˙ㄉㄜ' → 輕聲點寫前面但最後按：ㄉ(2) ㄜ(K) ˙(7)
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

  /** 英打要按的鍵：大寫或符號要加 Shift */
  function enKeys(ch) {
    if (ch === ' ') return [{ sym: '', key: '空白鍵' }];
    if (/[A-Z]/.test(ch)) return [{ sym: '', key: 'Shift' }, { sym: '', key: ch }];
    if (/[a-z]/.test(ch)) return [{ sym: '', key: ch.toUpperCase() }];
    var shifted = { '!': '1', '?': '/', '"': "'", ':': ';' };
    if (shifted[ch]) return [{ sym: '', key: 'Shift' }, { sym: '', key: shifted[ch] }];
    return [{ sym: '', key: ch }];
  }

  // ------------------------------------------------------------ 5. 成績與星等
  /** activeMs：實際打字時間（不含暫停、休息） */
  function stats(tracker, activeMs) {
    var total = tracker.pos + tracker.miss;
    var minutes = Math.max(activeMs, 1000) / 60000;
    return {
      correct: tracker.pos,
      miss: tracker.miss,
      accuracy: total ? Math.round(tracker.pos / total * 100) : 0,
      cpm: Math.round(tracker.pos / minutes),
      maxCombo: tracker.maxCombo,
      passagesDone: tracker.passagesDone
    };
  }

  /** 首頁徽章用的分數：正確字數 × 正確率 */
  function score(st) { return Math.round(st.correct * st.accuracy / 100); }

  /** 闖關完成（打完全部回合）才給星：★ 完成、★★ 正確率 ≥85、★★★ 正確率 ≥95 且達速度目標 */
  function starsFor(st, tier, completed) {
    if (!completed) return 0;
    var t = TIERS[tier] || TIERS.t1;
    if (st.accuracy >= STAR3_ACCURACY && st.cpm >= t.cpm) return 3;
    if (st.accuracy >= STAR2_ACCURACY) return 2;
    return 1;
  }

  function goalFor(tier) {
    var t = TIERS[tier] || TIERS.t1;
    return { accuracy: GOAL_ACCURACY, cpm: t.cpm };
  }

  function rocDate(d) {
    d = d || new Date();
    return '中華民國 ' + (d.getFullYear() - 1911) + ' 年 ' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
  }

  // ------------------------------------------------------------ 6. 存檔（localStorage 被擋時一律靜默）
  var NAME_KEY = 'edtech-typing-name';
  var SETTINGS_KEY = 'edtech-typing-settings';
  function sget(k) { try { return root.localStorage ? root.localStorage.getItem(k) : null; } catch (e) { return null; } }
  function sset(k, v) { try { if (root.localStorage) root.localStorage.setItem(k, v); } catch (e) { /* 被擋就算了 */ } }

  var store = {
    /** 存最佳分數到 edtech-unit{N}-score（首頁徽章讀這個）；回傳是否破紀錄 */
    saveBest: function (scoreKey, value) {
      var prev = parseInt(sget(scoreKey) || '0', 10) || 0;
      if (value > prev) { sset(scoreKey, String(value)); return true; }
      return false;
    },
    last: function (scoreKey) {
      try { return JSON.parse(sget(scoreKey + '-last') || 'null'); } catch (e) { return null; }
    },
    saveLast: function (scoreKey, st) { sset(scoreKey + '-last', JSON.stringify({ cpm: st.cpm, accuracy: st.accuracy })); },
    name: function () { return sget(NAME_KEY) || ''; },
    saveName: function (n) { sset(NAME_KEY, String(n || '').trim().slice(0, 12)); },
    settings: function () { try { return JSON.parse(sget(SETTINGS_KEY) || 'null'); } catch (e) { return null; } },
    saveSettings: function (s) { sset(SETTINGS_KEY, JSON.stringify(s)); }
  };

  root.TypingCore = {
    TIERS: TIERS, ROUNDS: ROUNDS, TEST_MINUTES: TEST_MINUTES, ZH_SETS: ZH_SETS, RANKS: RANKS, LIVES: LIVES,
    isTestMode: isTestMode, minutesText: minutesText,
    GOAL_ACCURACY: GOAL_ACCURACY, KEYBOARD: KEYBOARD, BPMF_KEYS: BPMF_KEYS, KEY_BPMF: KEY_BPMF,
    normalizeSettings: normalizeSettings, settingsFromQuery: settingsFromQuery, roundPlan: roundPlan,
    pickSequence: pickSequence, createTracker: createTracker, displayChar: displayChar, isAuto: isAuto,
    zhKeys: zhKeys, enKeys: enKeys, keyHand: keyHand,
    stats: stats, score: score, starsFor: starsFor, goalFor: goalFor, rocDate: rocDate, store: store
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
