/* ================= 打字島共用畫面外殼 =================
 * 設定 → 遊戲（HUD＋場景＋詩句卡＋提示階梯＋第 3 層大鍵盤）→ 休息一下 → 結算回顧 → 闖關獎狀
 * 樣式：assets/css/typing-island.css（C 版「繪本剪紙」，規範 .interface-design/system.md）
 * 邏輯：assets/js/typing-core.js（TypingCore）
 *
 * 每關用法（Gemini 只寫 scene 這一塊）：
 *   TypingIsland.mount({
 *     unit: 12,                         // 存檔 key：edtech-unit12-score（沿用舊 key，首頁徽章不掉）
 *     title: '中打特攻', subtitle: '射擊類',
 *     langs: ['zh'] | ['en'] | ['zh','en'],
 *     scene: function (api) { return { start, pause, resume, stop, hit, miss, roundStart, resize }; }
 *   });
 *   api：field（場景 div）、current()、upcoming(n)、loseLife()、lives()、settings、combo()
 *   scene.hit(res, cur)：打對（res.correct 字數、res.combo）；scene.miss(res, cur)：打錯（res.tier 第幾次錯）
 *   掉到底線／怪獸反擊時，場景呼叫 api.loseLife()；愛心歸零該回合提早結束
 */
(function () {
  'use strict';
  var C = window.TypingCore;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var HEART = '<svg width="30" height="28" viewBox="0 0 30 28" aria-hidden="true"><path d="M15 26S2 18 2 9.5A6.5 6.5 0 0 1 15 6a6.5 6.5 0 0 1 13 3.5C28 18 15 26 15 26z" fill="#EF6B62" stroke="#B3262B" stroke-width="2"/></svg>';
  var HEART_OFF = '<svg width="30" height="28" viewBox="0 0 30 28" aria-hidden="true"><path d="M15 26S2 18 2 9.5A6.5 6.5 0 0 1 15 6a6.5 6.5 0 0 1 13 3.5C28 18 15 26 15 26z" fill="none" stroke="#C9A66B" stroke-width="2" stroke-dasharray="4 3"/></svg>';
  var TICK = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var REST_SEC = 20;

  // ------------------------------------------------------------ 鍵帽與鍵盤（都從 TypingCore 的單一資料產生）
  function keyLabel(k) { return k === '空白鍵' ? '空白' : k; }
  function capsHTML(keys, cls) {
    return keys.map(function (k) {
      var wide = k.key.length > 1 ? ' wide' : '';
      return '<span class="ti-kc' + wide + (cls ? ' ' + cls : '') + '">' + (k.sym ? '<small>' + esc(k.sym) + '</small>' : '') + '<b>' + esc(keyLabel(k.key)) + '</b></span>';
    }).join('');
  }
  function keyboardHTML(keys) {
    var order = {};
    keys.forEach(function (k, i) { if (!(k.key in order)) order[k.key] = i + 1; });
    var unit = 62, gap = 4;
    return C.KEYBOARD.map(function (row) {
      return '<div class="ti-kbrow">' + row.map(function (cell) {
        var k = cell[0], w = cell[1] * unit + (cell[1] - 1) * gap;
        var single = k.length === 1;
        var cls = 'ti-k' + (single ? '' : ' mod') + (k === 'F' || k === 'J' ? ' bump' : '') + (k in order ? ' hit' : '') + (single ? ' hand-' + C.keyHand(k) : '');
        var inner = single
          ? '<span class="en">' + esc(k) + '</span>' + (C.KEY_BPMF[k] ? '<span class="zy">' + C.KEY_BPMF[k] + '</span>' : '')
          : esc(k === '空白鍵' ? '空白＝一聲' : k);
        return '<span class="' + cls + '" style="width:' + w + 'px">' + inner + (k in order ? '<span class="ord">' + order[k] + '</span>' : '') + '</span>';
      }).join('') + '</div>';
    }).join('');
  }

  // ------------------------------------------------------------ 主程式
  function mount(opts) {
    var langs = opts.langs && opts.langs.length ? opts.langs : ['zh'];
    var scoreKey = 'edtech-unit' + opts.unit + '-score';
    var saved = C.store.settings() || {};
    var settings = C.normalizeSettings(Object.assign({ lang: langs[0] }, saved, C.settingsFromQuery(location.search)));
    if (langs.indexOf(settings.lang) < 0) settings.lang = langs[0];

    var app = document.createElement('div');
    app.className = 'ti-app';
    app.innerHTML = skeleton(opts);
    document.body.appendChild(app);

    var game = null;   // 一局的狀態
    var scene = null;

    // ---------------- 設定畫面
    function renderSetup() {
      var s = settings, T = C.TIERS;
      var row = function (label, body) { return '<div class="ti-row"><span class="label">' + label + '</span>' + body + '</div>'; };
      var opt = function (key, val, big, small) {
        return '<button class="ti-opt" data-k="' + key + '" data-v="' + val + '" aria-pressed="' + (String(s[key]) === String(val)) + '">' + big + (small ? '<small>' + small + '</small>' : '') + '</button>';
      };
      var html = '';
      if (langs.length > 1) html += row('打字方式', '<div class="ti-opts">' + opt('lang', 'zh', '中打', '注音') + opt('lang', 'en', '英打', 'ABC') + '</div>');
      html += row('階級', '<div class="ti-opts">' + ['t1', 't2', 't3'].map(function (t) { return opt('tier', t, T[t].name, T[t].grades); }).join('') + '</div>');
      if (s.lang === 'zh') {
        html += row('注音', T[s.tier].zhuyin === 'on'
          ? '<div class="ti-lock"><b>注音固定開著</b><span>' + T[s.tier].name + '一律顯示注音，幫你看清楚每個字怎麼唸</span></div>'
          : '<div class="ti-switch"><button class="ti-sw" role="switch" aria-checked="' + s.zhuyin + '" aria-label="顯示注音"></button><span>' + (s.zhuyin ? '顯示注音' : '不顯示注音（挑戰模式）') + '</span></div>');
      }
      html += row('時間', '<div class="ti-opts">' + [10, 15, 20].map(function (m) { return opt('minutes', m, m + ' 分鐘', C.ROUNDS[m] + ' 回合'); }).join('') + '</div>');
      html += s.lang === 'zh'
        ? row('文章', '<div class="ti-opts">' + C.ZH_SETS.map(function (z) { return opt('set', z, z); }).join('') + opt('set', 'random', '隨機') + '</div>')
        : row('內容', '<div class="ti-lock"><b>' + T[s.tier].enSet + '</b><span>' + ({ t1: '從基準列 F、J 開始練字母', t2: '顏色、動物、學校等常用單字', t3: '生活短句，要注意大寫和標點' })[s.tier] + '</span></div>');
      $('.ti-setup-rows', app).innerHTML = html;

      var g = C.goalFor(s.tier);
      $('.ti-goal-list', app).innerHTML =
        '<div class="g"><span class="big num">' + g.accuracy + '<small>%</small></span><span>正確率 ' + g.accuracy + '% 以上<br><small>慢慢打，打對最重要</small></span></div>' +
        '<div class="g"><span class="big num">' + C.ROUNDS[s.minutes] + '</span><span>打完 ' + C.ROUNDS[s.minutes] + ' 個回合<br><small>每回合中間可以休息眼睛</small></span></div>' +
        '<div class="g"><span class="big num">' + g.cpm + '</span><span>每分鐘 ' + g.cpm + ' 字<br><small>達到就有機會拿三顆星</small></span></div>';
      $('.ti-start small', app).textContent = T[s.tier].name + '・' + (s.lang === 'zh' ? (s.set === 'random' ? '隨機文章' : s.set) : T[s.tier].enSet) + '・' + s.minutes + ' 分鐘';
      app.classList.toggle('no-zy', s.lang === 'zh' && !s.zhuyin);
    }
    $('.ti-setup', app).addEventListener('click', function (e) {
      var b = e.target.closest('.ti-opt');
      if (b) {
        var v = b.dataset.v;
        settings[b.dataset.k] = b.dataset.k === 'minutes' ? Number(v) : v;
        settings = C.normalizeSettings(settings);
        C.store.saveSettings(settings);
        renderSetup();
        return;
      }
      if (e.target.closest('.ti-sw')) {
        settings.zhuyin = !settings.zhuyin;
        C.store.saveSettings(settings);
        renderSetup();
        return;
      }
      if (e.target.closest('.ti-start')) startGame();
    });

    // ---------------- 畫面切換
    function show(name) {
      ['setup', 'play', 'rest', 'review', 'cert'].forEach(function (n) {
        $('.ti-' + n, app).hidden = n !== name;
      });
      if (scene && scene.resize && name === 'play') scene.resize();
    }

    // ---------------- 一局
    function startGame() {
      var plan = C.roundPlan(settings.minutes);
      var seq = C.pickSequence(settings);
      game = {
        plan: plan, round: 1, tracker: C.createTracker(seq), lives: C.LIVES,
        activeMs: 0, roundMs: 0, running: false, last: 0, timer: null, lastPassage: null, l3: false
      };
      app.dataset.lang = settings.lang;
      app.classList.toggle('no-zy', settings.lang === 'zh' && !settings.zhuyin);
      $('.ti-input', app).hidden = settings.lang !== 'zh';
      $('.ti-entype', app).hidden = settings.lang !== 'en';
      show('play');
      if (!scene) scene = opts.scene(api) || {};
      beginRound();
    }

    function beginRound() {
      game.roundMs = 0;
      game.lives = C.LIVES;
      renderHUD();
      renderPoem();
      renderLadder();
      if (game.round === 1 && scene.start) scene.start();   // 契約：start 在第一回合 roundStart 之前
      if (scene.roundStart) scene.roundStart(game.round);
      resume();
    }

    function resume() {
      if (!game || game.running) return;
      game.running = true;
      game.last = performance.now();
      clearInterval(game.timer);
      game.timer = setInterval(tick, 200);
      $('.ti-paused', app).hidden = true;
      if (scene.resume) scene.resume();
      focusInput();
    }
    function pause(reason) {
      if (!game || !game.running) return;
      game.running = false;
      clearInterval(game.timer);
      if (scene.pause) scene.pause();
      if (reason === 'user' || reason === 'hidden') $('.ti-paused', app).hidden = false;
    }
    function tick() {
      var now = performance.now();
      var dt = Math.min(now - game.last, 1000);
      game.last = now;
      game.activeMs += dt;
      game.roundMs += dt;
      renderTime();
      if (game.roundMs >= game.plan.roundSec * 1000) endRound();
    }
    function endRound() {
      pause('round');
      if (scene.roundEnd) scene.roundEnd(game.round);
      if (game.round >= game.plan.rounds) return finish();
      showRest();
    }

    // ---------------- HUD
    function renderHUD() {
      var p = game.plan, dots = '';
      for (var i = 1; i <= p.rounds; i++) dots += '<i class="' + (i < game.round ? 'done' : i === game.round ? 'now' : '') + '"></i>';
      $('.ti-route', app).innerHTML = dots;
      $('.ti-roundno', app).innerHTML = '<b class="num">' + game.round + '</b>／' + p.rounds;
      renderLives();
      renderTime();
      renderScore();
    }
    function renderLives() {
      var h = '';
      for (var i = 0; i < C.LIVES; i++) h += i < game.lives ? HEART : HEART_OFF;
      $('.ti-lives', app).innerHTML = h;
      $('.ti-lives', app).setAttribute('aria-label', '愛心 ' + game.lives + ' 顆');
    }
    function renderTime() {
      var left = Math.max(0, Math.ceil(game.plan.roundSec - game.roundMs / 1000));
      $('.ti-time .v', app).textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    }
    function renderScore() {
      var st = C.stats(game.tracker, game.activeMs);
      $('.ti-combo', app).textContent = game.tracker.combo;
      $('.ti-acc', app).innerHTML = (game.tracker.pos + game.tracker.miss ? st.accuracy : 100) + '<small>%</small>';
    }

    // ---------------- 詩句卡：顯示目前這一小段（到標點為止）＋下一小段，放不下就只放一段
    function segmentsOf(p) {
      var segs = [], start = 0;
      for (var i = 0; i < p.text.length; i++) {
        var end = p.lang === 'zh' ? /[，。？！]/.test(p.text[i]) : (p.text[i] === ' ' && i - start >= 18) || i === p.text.length - 1;
        if (end || i === p.text.length - 1) { segs.push([start, i + 1]); start = i + 1; }
      }
      return segs;
    }
    function renderPoem() {
      var cur = game.tracker.current(), p = cur.passage;
      game.lastPassage = p;
      var segs = segmentsOf(p), si = 0;
      for (var k = 0; k < segs.length; k++) if (cur.index < segs[k][1]) { si = k; break; }
      var limit = settings.lang === 'zh' ? 13 : 34;
      var a = segs[si][0], b = segs[si][1];
      if (segs[si + 1] && segs[si + 1][1] - a <= limit) b = segs[si + 1][1];
      var html = '';
      for (var i = a; i < b; i++) {
        var auto = C.isAuto(p, i), ch = C.displayChar(p, i);
        var cls = 'c' + (auto ? ' p' : '') + (i < cur.index && !auto ? ' done' : '') + (i === cur.index ? ' cur' + (cur.tier ? ' wrong' : '') : '');
        html += '<span class="' + cls + '">' + (p.lang === 'en' && ch === ' ' ? '␣' : esc(ch)) + '</span>';
      }
      $('.ti-poem', app).innerHTML = html;
      $('.ti-poemcap', app).innerHTML = '<span><b>' + esc(p.title) + '</b>' + (p.author ? '・' + esc(p.author) : '') + '</span>' +
        '<span>已打 <b class="num">' + game.tracker.pos + '</b> 字　<span class="ok">✓ 打對 ' + game.tracker.pos + '</span>　<span class="ng">✗ 打錯 ' + game.tracker.miss + '</span></span>';
    }

    // ---------------- 提示階梯
    function keysFor(cur) { return settings.lang === 'zh' ? C.zhKeys(cur.zhuyin) : C.enKeys(cur.ch); }
    function renderLadder() {
      var cur = game.tracker.current(), tier = cur.tier;
      var step = function (n, title, body) {
        var st = tier > n ? 'used' : tier === n ? 'now' : '';
        return '<div class="ti-step ' + st + '"><span class="n num">' + n + '</span><span>' + title + '</span><span class="body">' + body + '</span></div>';
      };
      $('.ti-ladder', app).innerHTML =
        step(1, '打錯一次：字框紅閃', tier >= 1 ? '<span class="mini zh">' + esc(cur.display) + '</span><span class="note">再看清楚一次</span>' : '<span class="note">慢慢打，打錯會先閃紅框</span>') +
        step(2, '打錯兩次：看按鍵', tier >= 2 ? '<span class="ti-kcs">' + capsHTML(keysFor(cur)) + '</span>' : '<span class="note">會告訴你要按哪幾個鍵</span>') +
        step(3, '打錯三次：鍵盤指位置', '<button class="ti-go" type="button">暫停，看大鍵盤</button>');
    }
    function openKeyboard() {
      var cur = game.tracker.current();
      pause('l3');
      game.l3 = true;
      $('.ti-l3 .tgt .zh', app).textContent = cur.display;
      $('.ti-l3 .seq', app).innerHTML = capsHTML(keysFor(cur));
      $('.ti-l3 .ti-kb', app).innerHTML = keyboardHTML(keysFor(cur));
      $('.ti-l3', app).hidden = false;
      $('.ti-l3 .ti-btn1', app).focus();
    }
    function closeKeyboard() {
      if (!game || !game.l3) return;
      game.l3 = false;
      $('.ti-l3', app).hidden = true;
      resume();
    }
    app.addEventListener('click', function (e) {
      if (e.target.closest('.ti-go')) openKeyboard();
      else if (e.target.closest('.ti-l3 .ti-btn1')) closeKeyboard();
      else if (e.target.closest('.ti-pausebtn')) pause('user');
      else if (e.target.closest('.ti-paused .ti-btn1')) resume();
      else if (e.target.closest('.ti-paused .ti-btn2')) { quit(); }
      else if ($('.ti-play', app).contains(e.target) && !e.target.closest('button')) focusInput();
    });

    // ---------------- 輸入：中打用輸入框（輸入法選字完成才比對），英打直接收按鍵
    var input = $('.ti-input', app), composing = false;
    function focusInput() { if (game && game.running && settings.lang === 'zh') input.focus(); }
    input.addEventListener('compositionstart', function () { composing = true; });
    input.addEventListener('compositionend', function () { composing = false; feed(input.value); });
    input.addEventListener('input', function () { if (!composing) feed(input.value); });
    function feed(text) {
      if (!game || !game.running || !text) return;
      input.value = '';
      apply(game.tracker.commit(text));
    }
    document.addEventListener('keydown', function (e) {
      if (!game) return;
      if (e.key === 'Escape' && game.l3) { e.preventDefault(); closeKeyboard(); return; }
      if (settings.lang !== 'en' || !game.running || $('.ti-play', app).hidden) return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length !== 1) return;
      e.preventDefault();
      apply(game.tracker.key(e.key));
    });
    function apply(res) {
      var cur = game.tracker.current();
      if (res.correct && scene.hit) scene.hit(res, cur);
      if (res.wrong && scene.miss) scene.miss(res, cur);
      renderPoem();
      renderLadder();
      renderScore();
      if (res.wrong && res.tier >= 3) openKeyboard();
    }

    // ---------------- 場景用的 API
    var api = {
      get field() { return $('.ti-field', app); },
      get settings() { return settings; },
      current: function () { return game.tracker.current(); },
      upcoming: function (n) { return game.tracker.upcoming(n); },
      combo: function () { return game.tracker.combo; },
      lives: function () { return game.lives; },
      loseLife: function () {
        if (!game || !game.running) return;
        game.lives = Math.max(0, game.lives - 1);
        renderLives();
        if (!game.lives) endRound();
      }
    };

    // ---------------- 休息一下
    function showRest() {
      show('rest');
      var left = REST_SEC, ring = $('.ti-ring circle.fg', app), len = 2 * Math.PI * 90;
      ring.style.strokeDasharray = len;
      var draw = function () {
        $('.ti-ring .t b', app).textContent = left;
        ring.style.strokeDashoffset = len * (1 - left / REST_SEC);
      };
      draw();
      clearInterval(game.restTimer);
      game.restTimer = setInterval(function () { left -= 1; draw(); if (left <= 0) nextRound(); }, 1000);
      $('.ti-rest-msg', app).textContent = '第 ' + game.round + ' 回合完成！休息一下，等一下打第 ' + (game.round + 1) + ' 回合。';
      $('.ti-rest .ti-btn1', app).focus();
    }
    function nextRound() {
      clearInterval(game.restTimer);
      game.round += 1;
      show('play');
      beginRound();
    }
    $('.ti-rest', app).addEventListener('click', function (e) { if (e.target.closest('button')) nextRound(); });

    // ---------------- 結算
    var lastResult = null;
    function finish() {
      if (scene.stop) scene.stop();
      var st = C.stats(game.tracker, game.activeMs);
      var stars = C.starsFor(st, settings.tier, true);
      var prev = C.store.last(scoreKey);
      C.store.saveBest(scoreKey, C.score(st));
      C.store.saveLast(scoreKey, st);
      lastResult = { st: st, stars: stars, settings: Object.assign({}, settings), passage: game.lastPassage };
      var g = C.goalFor(settings.tier);
      var delta = function (v, p, unit) {
        if (p == null) return '<span class="delta first">第一次玩</span>';
        var d = v - p;
        return '<span class="delta ' + (d >= 0 ? 'up' : 'down') + '">' + (d >= 0 ? '▲ 多 ' : '▼ 少 ') + Math.abs(d) + unit + ' <small>比上次</small></span>';
      };
      $('.ti-hero .v', app).textContent = st.cpm;
      $('.ti-hero .d1', app).innerHTML = delta(st.cpm, prev && prev.cpm, ' 字');
      $('.ti-hero .accv', app).innerHTML = st.accuracy + '<small>%</small>';
      $('.ti-hero .d2', app).innerHTML = delta(st.accuracy, prev && prev.accuracy, '%');
      var chk = function (ok, text, val) {
        return '<div class="g"><span class="tick' + (ok ? '' : ' no') + '">' + (ok ? TICK : '') + '</span>' + (ok ? '' : '再加油：') + text + '<b class="num">' + val + '</b></div>';
      };
      $('.ti-goalchk', app).innerHTML = '<h2>本局目標</h2>' +
        chk(st.accuracy >= g.accuracy, '正確率 ' + g.accuracy + '% 以上', st.accuracy + '%') +
        chk(st.cpm >= g.cpm, '每分鐘 ' + g.cpm + ' 字', st.cpm + ' 字') +
        chk(true, '打完 ' + game.plan.rounds + ' 回合', game.plan.rounds + '／' + game.plan.rounds);
      var worst = game.tracker.mistakes().slice(0, 5);
      $('.ti-worst-list', app).innerHTML = worst.length ? worst.map(function (w, i) {
        var keys = settings.lang === 'zh' ? C.zhKeys(w.zhuyin) : C.enKeys(w.ch);
        return '<div class="wrow"><span class="rk num">' + (i + 1) + '</span><span class="zh">' + esc(w.lang === 'en' || settings.lang === 'en' ? (w.ch === ' ' ? '␣' : w.ch) : w.display) + '</span><span class="ti-kcs">' + capsHTML(keys) + '</span><span class="cnt">錯 <b>' + w.count + '</b> 次</span></div>';
      }).join('') : '<p class="ti-none">✓ 這局一個字都沒打錯，太厲害了！</p>';
      var p = game.lastPassage;
      $('.ti-gloss', app).hidden = !(p && p.gloss);
      if (p && p.gloss) {
        $('.ti-gloss .ttl', app).innerHTML = '<b>' + esc(p.title) + '</b><span>' + esc(p.author || '') + '</span>';
        $('.ti-gloss .say', app).textContent = p.gloss;
      }
      $('.ti-cheer', app).textContent = settings.tier === 't1'
        ? (stars >= 2 ? '你打得又準又穩，好棒！' : '你很努力喔！每天練一點點，會越來越快！')
        : (stars === 3 ? '又快又準，打字小達人就是你！' : '繼續練習，下次挑戰更高的星星！');
      show('review');
      game = Object.assign(game, { done: true });
    }
    $('.ti-review', app).addEventListener('click', function (e) {
      if (e.target.closest('.ti-again')) startGame();
      else if (e.target.closest('.ti-change')) { show('setup'); renderSetup(); }
      else if (e.target.closest('.ti-tocert')) showCert();
    });

    // ---------------- 獎狀
    function showCert() {
      var r = lastResult, s = r.settings, T = C.TIERS[s.tier];
      var what = s.lang === 'zh' ? (s.set === 'random' ? '中打' : s.set) : '英打' + T.enSet;
      var nm = C.store.name();
      $('.ti-cert-name', app).textContent = nm || '　　　';
      $('.ti-name-in', app).value = nm;
      $('.ti-cert-say', app).innerHTML = '在打字島〈' + esc(opts.title) + '・' + esc(what) + '・' + T.name + '〉闖關成功，<br>正確率 <b>' + r.st.accuracy + '%</b>、每分鐘 <b>' + r.st.cpm + '</b> 字，特頒此狀以資鼓勵。';
      $('.ti-cert-stars', app).innerHTML = [1, 2, 3].map(function (i) { return '<span class="star' + (i <= r.stars ? ' on' : '') + '">★</span>'; }).join('');
      $('.ti-cert-rank', app).textContent = C.RANKS[r.stars - 1];
      $('.ti-cert-date', app).textContent = C.rocDate();
      $('.ti-ranks', app).innerHTML = C.RANKS.map(function (rk, i) {
        return '<div class="' + (i + 1 === r.stars ? 'now' : '') + '"><span class="st">' + '★★★'.slice(0, i + 1) + '</span>' + rk + (i + 1 === r.stars ? '　本次' : '') + '</div>';
      }).join('');
      show('cert');
      if (!nm) $('.ti-name-in', app).focus();
    }
    $('.ti-name-in', app).addEventListener('input', function (e) {
      C.store.saveName(e.target.value);
      $('.ti-cert-name', app).textContent = e.target.value.trim() || '　　　';
    });
    $('.ti-cert', app).addEventListener('click', function (e) {
      if (e.target.closest('.ti-print')) window.print();
      else if (e.target.closest('.ti-home')) location.href = opts.homeUrl || '../../index.html';
      else if (e.target.closest('.ti-back')) show('review');
    });

    // ---------------- 暫停、離開、切分頁
    function quit() {
      if (game) { clearInterval(game.timer); clearInterval(game.restTimer); }
      if (scene && scene.stop) scene.stop();
      game = null;
      $('.ti-paused', app).hidden = true;
      show('setup');
      renderSetup();
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden && game && game.running) pause('hidden'); });
    window.addEventListener('resize', function () { if (scene && scene.resize) scene.resize(); });

    renderSetup();
    show('setup');
    // 測試用：網址帶 ?debug=1 才有，讓自動測試不用等滿一回合
    if (/[?&]debug=1\b/.test(location.search)) {
      window.__tiDebug = { endRound: function () { if (game) game.roundMs = game.plan.roundSec * 1000; } };
    }
    return { api: api, quit: quit };
  }

  // ------------------------------------------------------------ 畫面骨架
  function skeleton(o) {
    var restCard = function (n, title, text) { return '<div class="rs"><span class="no num">' + n + '</span><b>' + title + '</b><span>' + text + '</span></div>'; };
    return '' +
    '<section class="ti-setup">' +
      '<div class="ti-setup-main">' +
        '<div class="ti-title"><h1>' + esc(o.title) + '</h1><p>' + esc(o.subtitle || '打字島') + '　選好了就按「開始」</p></div>' +
        '<div class="ti-setup-rows"></div>' +
      '</div>' +
      '<div class="ti-setup-side">' +
        '<div class="ti-panel ti-goal tape"><h2>本局目標</h2><div class="ti-goal-list"></div></div>' +
        '<button class="ti-start" type="button"><span>開始<small></small></span></button>' +
      '</div>' +
    '</section>' +

    '<section class="ti-play" hidden>' +
      '<div class="ti-panel ti-hud">' +
        '<div class="l"><span class="ti-route" aria-hidden="true"></span><span class="label">回合</span><span class="ti-roundno"></span></div>' +
        '<div class="ti-time"><span class="label">剩餘</span><span class="v num">00:00</span></div>' +
        '<div class="r"><span class="label">愛心</span><span class="ti-lives"></span>' +
          '<span class="stat"><span class="label">連擊</span><b class="v num ti-combo">0</b></span>' +
          '<span class="stat"><span class="label">正確率</span><b class="v num ti-acc">100<small>%</small></b></span>' +
          '<button class="ti-pausebtn" type="button" aria-label="暫停">⏸</button></div>' +
      '</div>' +
      '<div class="ti-panel ti-field"></div>' +
      '<div class="ti-panel ti-poembox">' +
        '<div class="ti-poemcap"></div>' +
        '<div class="ti-poemrow"><div class="ti-poem" aria-live="polite"></div>' +
          '<input class="ti-input" type="text" autocomplete="off" spellcheck="false" aria-label="在這裡打字" placeholder="在這裡打字">' +
          '<span class="ti-entype" hidden>直接按鍵盤打字</span></div>' +
      '</div>' +
      '<div class="ti-panel ti-ladder"></div>' +
      '<div class="ti-l3" hidden><div class="ti-panel ti-l3box" role="dialog" aria-label="大鍵盤提示">' +
        '<div class="l3head"><span class="pause">⏸ 遊戲暫停了</span>' +
          '<span class="tgt"><span class="zh"></span>要按<span class="seq ti-kcs"></span></span>' +
          '<button class="ti-btn1" type="button">我知道了，繼續打字</button></div>' +
        '<div class="ti-kb"></div></div></div>' +
      '<div class="ti-paused" hidden><div class="ti-panel"><h2>⏸ 暫停中</h2><p>準備好了再按「繼續」。</p>' +
        '<div class="btns"><button class="ti-btn1" type="button">繼續</button><button class="ti-btn2" type="button">回到設定</button></div></div></div>' +
    '</section>' +

    '<section class="ti-rest" hidden><div class="ti-panel ti-restbox">' +
      '<h1>休息一下<small>讓眼睛和手放鬆</small></h1>' +
      '<div class="ti-ring"><svg viewBox="0 0 200 200" width="210" height="210" aria-hidden="true"><circle cx="100" cy="100" r="90" fill="none" stroke="#E4CC9C" stroke-width="14"/>' +
        '<circle class="fg" cx="100" cy="100" r="90" fill="none" stroke="#1F6B9C" stroke-width="14" stroke-linecap="round" transform="rotate(-90 100 100)"/></svg>' +
        '<div class="t"><b>20</b><small>秒</small></div></div>' +
      '<div class="rsteps">' + restCard(1, '看遠方', '看窗外最遠的地方 20 秒') + restCard(2, '眨眨眼', '用力眨眼 10 下') + restCard(3, '動一動', '轉轉脖子、甩甩手指') + '</div>' +
      '<p class="ti-rest-msg"></p>' +
      '<div class="btns"><button class="ti-btn2" type="button">略過休息</button><button class="ti-btn1" type="button">休息好了，繼續</button></div>' +
    '</div></section>' +

    '<section class="ti-review" hidden>' +
      '<div class="head"><h1>闖關完成！</h1></div>' +
      '<div class="col"><div class="ti-panel ti-hero"><span class="label">每分鐘打對</span>' +
        '<div class="wpm"><span class="v num">0</span><span class="u">字</span></div><span class="d1"></span>' +
        '<div class="acc"><span class="label">正確率</span><span class="v num accv"></span><span class="d2"></span></div></div>' +
        '<div class="ti-panel ti-goalchk"></div></div>' +
      '<div class="col"><div class="ti-panel ti-worst"><h2>最常打錯的字</h2><div class="ti-worst-list"></div></div></div>' +
      '<div class="col"><div class="ti-panel ti-gloss"><h2>這首在說什麼</h2><div class="ttl"></div><p class="say"></p></div>' +
        '<p class="ti-cheer"></p>' +
        '<div class="btns"><button class="ti-btn1 ti-tocert" type="button">領獎狀</button>' +
        '<button class="ti-btn2 ti-again" type="button">再玩一次</button><button class="ti-btn2 ti-change" type="button">換文章／設定</button></div></div>' +
    '</section>' +

    '<section class="ti-cert" hidden>' +
      '<div class="ti-certcard"><div class="frame">' +
        '<div class="ribbon">獎　狀</div>' +
        '<div class="to"><span class="nm ti-cert-name">　　　</span><span class="s">小朋友</span></div>' +
        '<p class="say ti-cert-say"></p>' +
        '<div class="rank"><span class="stars ti-cert-stars"></span><span class="ttl ti-cert-rank"></span></div>' +
        '<div class="foot"><span class="who">頒發單位<br><b>打字島　島主小狐狸</b></span>' +
          '<span class="date ti-cert-date"></span>' +
          '<span class="seal" aria-hidden="true">打字<br>島印</span></div>' +
      '</div></div>' +
      '<div class="ti-cert-side">' +
        '<div class="ti-panel hello">闖關成功！<br>可以列印喔</div>' +
        '<div class="ti-panel"><label for="ti-name">獎狀上的名字</label><input id="ti-name" class="ti-name-in" maxlength="12" autocomplete="off" placeholder="輸入你的名字">' +
          '<p class="hint">只存在這台電腦，下次不用再打。</p></div>' +
        '<div class="ti-panel"><span class="label">稱號</span><div class="ti-ranks"></div></div>' +
        '<button class="ti-btn1 ti-print" type="button">列印獎狀</button>' +
        '<button class="ti-btn2 ti-back" type="button">看成績</button>' +
        '<button class="ti-btn2 ti-home" type="button">回到打字島</button>' +
      '</div>' +
    '</section>';
  }

  window.TypingIsland = { mount: mount, keyboardHTML: keyboardHTML, capsHTML: capsHTML };
})();
