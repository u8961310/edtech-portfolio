/* 打字擂台：比賽規則（純函式，不碰畫面也不碰網路）
 *
 * 同一份檔案給兩個地方用：
 *   - 瀏覽器：<script src="duel-rules.js"> → window.DuelRules（對電腦練習在本機當裁判）
 *   - Cloudflare Worker：require('./duel-rules.js')（連線對戰在伺服器當裁判）
 * 規則只寫在這裡，兩邊算出來才會一樣。調數值改 CONFIG。
 * 規格：docs/specs/unit23-duel-protocol.md
 */
(function (root) {
  'use strict';

  var CONFIG = {
    // 血量：大約是「該年級一般速度打滿 90 秒的字數」，打得比平均快就能提早擊倒對手
    HP: { zh: { low: 25, mid: 40, high: 60 }, en: { low: 60, mid: 100, high: 150 } },
    COMBO_BONUS_AT: 10,     // 連擊第 10 字起傷害加成
    COMBO_MULT: 1.5,
    MAX_CPS: 8,             // 每秒最多算 8 字；超過視為異常（貼上、改程式）不計
    BURST_SLACK: 4,         // 網路延遲造成一次送來多字的寬容量
    DURATIONS: [60, 90, 120],
    DEFAULT_DURATION: 90,
    COUNTDOWN_MS: 3000,
    HANDICAP_MAX: 1.5,      // 讓分：較慢的一方血量最多放大 1.5 倍
    // 對電腦練習：機器人每分鐘字數與失誤率
    BOT: {
      zh: { low: 12, mid: 22, high: 32 },
      en: { low: 40, mid: 70, high: 100 },
      MISS_RATE: 0.06
    }
  };

  var LANGS = ['zh', 'en'];
  var GRADES = ['low', 'mid', 'high'];

  /** 把房主送來的設定整理成合法值（不信任前端） */
  function normalizeSettings(s) {
    s = s || {};
    return {
      lang: LANGS.indexOf(s.lang) >= 0 ? s.lang : 'zh',
      grade: GRADES.indexOf(s.grade) >= 0 ? s.grade : 'mid',
      domain: typeof s.domain === 'string' && s.domain ? s.domain.slice(0, 20) : 'random',
      duration: CONFIG.DURATIONS.indexOf(s.duration) >= 0 ? s.duration : CONFIG.DEFAULT_DURATION,
      handicap: !!s.handicap
    };
  }

  /** 可重現的亂數（同一個 seed 兩台電腦抽到同樣的文章順序） */
  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * 依設定與 seed 排出文章順序（回傳 id 陣列）。打完一篇接下一篇，排到底就從頭再來。
   * 領域選 random 或篩不到文章時，退回同語言同年級的全部文章；再沒有就用同語言全部。
   */
  function pickSequence(passages, settings, seed) {
    var s = normalizeSettings(settings);
    var pool = passages.filter(function (p) {
      return p.lang === s.lang && p.grade === s.grade && (s.domain === 'random' || p.domain === s.domain);
    });
    if (!pool.length) pool = passages.filter(function (p) { return p.lang === s.lang && p.grade === s.grade; });
    if (!pool.length) pool = passages.filter(function (p) { return p.lang === s.lang; });
    var r = rng(seed);
    var ids = pool.map(function (p) { return p.id; });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(r() * (i + 1));
      var t = ids[i]; ids[i] = ids[j]; ids[j] = t;
    }
    return ids;
  }

  /**
   * 開一局。players：[{ id, nick, best }]，best＝該玩家這台電腦的個人最佳 CPM（讓分用，可為 0）
   * 回傳的 state 由裁判（本機或伺服器）持有，之後只透過下面的函式改。
   */
  function newMatch(settings, players, startAt) {
    var s = normalizeSettings(settings);
    var base = CONFIG.HP[s.lang][s.grade];
    var maxBest = 0;
    players.forEach(function (p) { maxBest = Math.max(maxBest, p.best || 0); });
    var state = {
      settings: s,
      startAt: startAt,
      endsAt: startAt + s.duration * 1000,
      over: false,
      players: {}
    };
    players.forEach(function (p) {
      var mult = 1;
      if (s.handicap && maxBest > 0 && p.best > 0) mult = Math.min(CONFIG.HANDICAP_MAX, maxBest / p.best);
      var hp = Math.round(base * mult);
      state.players[p.id] = {
        id: p.id, nick: p.nick, hp: hp, maxHp: hp,
        pos: 0, miss: 0, combo: 0, maxCombo: 0, dealt: 0, lastAt: startAt
      };
    });
    return state;
  }

  /**
   * 收到某玩家的進度。pos＝開局以來累計打對的字數，miss＝累計打錯次數（兩者都只增不減）。
   * 回傳 { ok, damage, target, reason }。ok=false 時整筆不計（不扣誰的血）。
   */
  function applyProgress(state, id, msg, now) {
    var me = state.players[id];
    if (!me) return { ok: false, reason: 'not-in-match' };
    if (state.over) return { ok: false, reason: 'over' };
    if (now < state.startAt) return { ok: false, reason: 'not-started' };
    var pos = Math.floor(Number(msg.pos)), miss = Math.floor(Number(msg.miss));
    if (!isFinite(pos) || !isFinite(miss) || pos < me.pos || miss < me.miss) return { ok: false, reason: 'bad-value' };
    var delta = pos - me.pos;
    var allowed = Math.ceil(((now - me.lastAt) / 1000) * CONFIG.MAX_CPS) + CONFIG.BURST_SLACK;
    if (delta > allowed) return { ok: false, reason: 'too-fast' };

    var damage = 0;
    for (var k = 0; k < delta; k++) {
      me.combo += 1;
      damage += me.combo >= CONFIG.COMBO_BONUS_AT ? CONFIG.COMBO_MULT : 1;
    }
    me.maxCombo = Math.max(me.maxCombo, me.combo);
    if (miss > me.miss) me.combo = 0;        // 這批裡有打錯：連擊歸零（打錯不扣自己的血）
    me.pos = pos; me.miss = miss; me.lastAt = now;

    var target = opponentOf(state, id);
    if (target && damage > 0) {
      target.hp = Math.max(0, target.hp - damage);
      me.dealt += damage;
      if (target.hp === 0) state.over = true;
    }
    return { ok: true, damage: damage, target: target ? target.id : null };
  }

  /** 1 對 1：對手就是另一個人。（班級模式之後另寫，見規格「未來：班級模式」） */
  function opponentOf(state, id) {
    var ids = Object.keys(state.players);
    for (var i = 0; i < ids.length; i++) if (ids[i] !== id) return state.players[ids[i]];
    return null;
  }

  function isOver(state, now) {
    if (!state.over && now >= state.endsAt) state.over = true;
    return state.over;
  }

  /** 給畫面用的即時狀態（不含 lastAt 等內部欄位） */
  function snapshot(state, now) {
    var out = { remaining: Math.max(0, Math.ceil((state.endsAt - now) / 1000)), players: {} };
    Object.keys(state.players).forEach(function (id) {
      var p = state.players[id];
      out.players[id] = { hp: p.hp, maxHp: p.maxHp, pos: p.pos, combo: p.combo };
    });
    return out;
  }

  /**
   * 結算。勝負看「剩餘血量比例」：讓分時雙方血量上限不同，比例才公平。
   * 回傳 { winner: id 或 null（平手）, players: [{ id, nick, chars, miss, cpm, acc, hp, maxHp, maxCombo }] }
   */
  function result(state, now) {
    var minutes = Math.max(1 / 60, (Math.min(now, state.endsAt) - state.startAt) / 60000);
    var list = Object.keys(state.players).map(function (id) {
      var p = state.players[id];
      return {
        id: id, nick: p.nick, chars: p.pos, miss: p.miss,
        cpm: Math.round(p.pos / minutes),
        acc: p.pos + p.miss ? Math.round((p.pos / (p.pos + p.miss)) * 100) : 0,
        hp: p.hp, maxHp: p.maxHp, maxCombo: p.maxCombo, ratio: p.hp / p.maxHp
      };
    });
    list.sort(function (a, b) { return b.ratio - a.ratio; });
    var winner = list.length > 1 && list[0].ratio > list[1].ratio ? list[0].id : null;
    list.forEach(function (p) { delete p.ratio; });
    return { winner: winner, players: list };
  }

  var DuelRules = {
    CONFIG: CONFIG,
    normalizeSettings: normalizeSettings,
    pickSequence: pickSequence,
    newMatch: newMatch,
    applyProgress: applyProgress,
    isOver: isOver,
    snapshot: snapshot,
    result: result,
    rng: rng
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DuelRules;
  else root.DuelRules = DuelRules;
})(typeof globalThis !== 'undefined' ? globalThis : this);
