/* ================= 小常識島共用畫面外殼 =================
 * 開始畫面（我的寵物＋關卡卡）→ 遊戲（場景出題）→ 結算（寵物吃點心、成長條、這關回顧、交成績）
 * 樣式：assets/css/smart-island.css（B 版「黏土點心屋」，規範 .interface-design/smart-island-system.md）
 * 寵物：assets/js/smart-pet.js（要先載入）；舞台固定 1366×657，依視窗等比縮放；場景用 px 排版即可
 *
 * 每關用法（Gemini 只寫 scene 這一塊）：
 *   SmartIsland.mount({
 *     unit: 29,                              // 成績 key：edtech-unit29-score（存「總星星數」，首頁徽章讀這個）
 *     title: '寵物的新電腦',
 *     grade: '1–2 年級',                      // 顯示用：'1–2 年級'｜'3–4 年級'｜'1–4 年級'
 *     howto: '寵物買了新電腦！請你幫牠找出滑鼠。',
 *     zhuyin: true,                          // 1–2 年級的關：玩法句、題目、回饋句都用注音字型
 *     teach: '認識常見的資訊設備｜資E1',        // 給老師看的「這關練什麼」
 *     levels: [{ name: '書桌上的電腦', icon: '<svg …>' }, …],   // 最多 5 關一排；第 1 關一定開，過了才開下一關
 *     scene: function (api) { return { start: function (levelIndex) {}, stop: function () {} }; }
 *   });
 *
 * api（場景拿到的）：
 *   api.field                 場景容器（1366×591，在頂欄下方）；場景自己的 class 用 sc- 開頭
 *   api.progress(i, n)        頂欄右側題號「第 i 題／共 n 題」＋進度豆（i 從 1 起算）
 *   api.petSVG(mood, opts)    目前這隻寵物的 SVG 字串；mood：happy｜normal｜worried｜surprised；opts：{ q:true 冒問號, sweat:true, spark:true }
 *   api.pet()                 { name, type, stage, guest }（沒領養時是訪客小雲）
 *   api.feedback({ ok, text, explain })  → Promise；跳出寵物回饋卡，孩子按「下一題」才 resolve
 *                             ok：對／錯；text：主句（省略時用預設句）；explain：一句正確觀念（答錯時一定要給）
 *                             寬鬆原則：答錯也一定能往下，不擋關
 *   api.finish({ stars, correct, total, review, learned, retry })
 *                             完成這一關：stars 0–3（外殼保底 1）、review：[{ ok, q }] 每題對錯、learned：今天學到一句、retry：要再練習的一句（可省）
 *   api.zy                    這關是否用注音（場景自己的注音句加 class="sm-zy"）
 *   api.levelIndex()／api.toSetup()
 */
(function () {
  'use strict';
  var W = 1366, H = 657;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function readJSON(k, d) { try { var v = JSON.parse(sget(k)); return v == null ? d : v; } catch (e) { return d; } }

  var IC = {
    home: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11 12 3.5 21 11M5.5 9v11h13V9"/><path d="M10 20v-6h4v6"/></svg>',
    play: '<svg class="sm-ic fill" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    lock: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    send: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/></svg>',
    again: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    next: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    house: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11l8-6 8 6v9H4z"/><circle cx="12" cy="14" r="2.5"/></svg>',
    back: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    swap: '<svg class="sm-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
    isl: '<svg viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="25" rx="14" ry="5" fill="#9BD7F2"/><path d="M6 24 Q16 14 26 24Z" fill="#7CC79A"/><circle cx="16" cy="11" r="7" fill="#FFD65E" stroke="#fff" stroke-width="1.5"/><path d="M13 18h6M14 20.5h4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>',
    ck: '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="20" fill="#E9A955" stroke="#A8672A" stroke-width="3"/><circle cx="24" cy="24" r="14" fill="#F3C27A"/><circle cx="17" cy="19" r="2.6" fill="#6B3E1F"/><circle cx="29" cy="17" r="2.2" fill="#6B3E1F"/><circle cx="26" cy="29" r="2.8" fill="#6B3E1F"/><circle cx="16" cy="29" r="1.8" fill="#6B3E1F"/></svg>'
  };
  function starSVG(on, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 28) + '" height="' + (size || 28) + '" aria-hidden="true"><path class="sm-star' + (on ? ' on' : '') +
      '" d="M12 1.8 15.1 8.4 22.3 9.2 16.9 14.1 18.4 21.3 12 17.7 5.6 21.3 7.1 14.1 1.7 9.2 8.9 8.4z"/></svg>';
  }
  function starsHTML(n, size) { return [1, 2, 3].map(function (i) { return starSVG(i <= n, size); }).join(''); }
  function gradeClass(g) { return /1.2/.test(g) ? 'g12' : /3.4/.test(g) ? 'g34' : 'g14'; }

  // 預設句（注音關用；破音字已用教育部重編國語辭典核對）
  var SAY = { ok: '答對了！寵物好開心。', bad: '別擔心！答案在這裡。', eat: '寵物吃到點心，好開心！' };

  // ------------------------------------------------------------ 存檔：每關最佳星數
  var PROG_KEY = 'edtech-smart-progress';   // { "29": [3, 2, 0], ... }
  var store = {
    progress: function (unit) { var p = readJSON(PROG_KEY, {}); return Array.isArray(p[unit]) ? p[unit] : []; },
    saveStars: function (unit, idx, stars) {
      var p = readJSON(PROG_KEY, {}); var a = Array.isArray(p[unit]) ? p[unit] : [];
      a[idx] = Math.max(a[idx] || 0, stars); p[unit] = a; sset(PROG_KEY, JSON.stringify(p));
      return a;
    }
  };

  // ------------------------------------------------------------ 寵物（沒領養＝訪客小雲，點心不存）
  var GUEST = { name: '小雲', type: 'bunny', snacks: 0, wear: [], guest: true };
  function P() { return window.SmartPet; }
  function curPet() { var p = P() && P().current(); return p || GUEST; }
  function petSVG(mood, o) { return P() ? P().svgOf(curPet(), mood, o) : ''; }

  function fit(stage) {
    var k = Math.min(window.innerWidth / W, window.innerHeight / H);
    var x = (window.innerWidth - W * k) / 2, y = (window.innerHeight - H * k) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
  }

  // ------------------------------------------------------------ 交成績模組：用到才載入（跟打字島、畫畫島共用 class-scores.js）
  var JS_BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  var csLoading = null;
  function loadClassScores() {
    if (window.ClassScores) return Promise.resolve(window.ClassScores);
    if (csLoading) return csLoading;
    csLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = JS_BASE + 'class-scores.js';
      s.onload = function () { window.ClassScores ? resolve(window.ClassScores) : reject(new Error('no ClassScores')); };
      s.onerror = function () { csLoading = null; reject(new Error('load failed')); };
      document.head.appendChild(s);
    });
    return csLoading;
  }

  // ------------------------------------------------------------ 主程式
  function mount(opts) {
    var levels = opts.levels || [];
    var scoreKey = 'edtech-unit' + opts.unit + '-score';
    var homeUrl = opts.homeUrl || '../../index.html';
    var houseUrl = opts.houseUrl || '../smart-pet-house/index.html';
    var zy = !!opts.zhuyin;
    var app = document.createElement('div');
    app.className = 'sm-app';
    app.innerHTML = '<div class="sm-stage">' + skeleton(opts, homeUrl, houseUrl) + '</div>';
    document.body.appendChild(app);
    var stage = $('.sm-stage', app);
    fit(stage);
    window.addEventListener('resize', function () { fit(stage); });

    var cur = 0, scene = null, last = null, fbResolve = null;
    var api = {
      field: $('.sm-field', app),
      zy: zy,
      progress: progress,
      petSVG: petSVG,
      pet: function () { var p = curPet(); return { name: p.name, type: p.type, stage: P() ? P().stageOf(p.snacks || 0) : 0, guest: !!p.guest }; },
      feedback: feedback,
      finish: finish,
      levelIndex: function () { return cur; },
      toSetup: function () { stopScene(); show('setup'); }
    };

    function show(name) {
      ['setup', 'play', 'done'].forEach(function (n) { $('.sm-s-' + n, app).hidden = n !== name; });
      $('.sm-fb', app).hidden = true;
      if (name !== 'play') progress(0, 0);
      if (name === 'setup') { renderPet(); renderLevels(); }
      renderBadge();
    }
    function progress(i, n) {
      var el = $('.sm-prog', app);
      if (!n) { el.innerHTML = ''; return; }
      var dots = ''; for (var k = 1; k <= n; k++) dots += '<i class="' + (k < i ? 'done' : k === i ? 'now' : '') + '"></i>';
      el.innerHTML = '<span>第 <b class="sm-num">' + i + '</b> 題／共 <b class="sm-num">' + n + '</b> 題</span><span class="dots" aria-hidden="true">' + dots + '</span>';
    }
    // 頂欄右側的寵物小頭像（開始、結算畫面）
    function renderBadge() {
      var p = curPet(), el = $('.sm-petbadge', app);
      el.hidden = !$('.sm-s-play', app).hidden;
      el.innerHTML = '<span class="av">' + petSVG('happy') + '</span><span>' + esc(p.guest ? '還沒有寵物' : p.name) + '</span>';
    }
    function renderPet() {
      var p = curPet(), box = $('.sm-mypet', app), st = P() ? P().stageOf(p.snacks || 0) : 0;
      if (p.guest) {
        box.innerHTML = '<div class="pic">' + petSVG('surprised', { q: true }) + '</div>' +
          '<p class="nm">還沒有寵物</p><p class="sub">先到寵物小屋領養，過關的點心才會存起來</p>' +
          '<a class="sm-btn or" href="' + esc(houseUrl) + '">' + IC.house + '去寵物小屋領養</a>' +
          '<p class="sub small">不領養也可以先玩</p>';
        return;
      }
      var into = p.snacks % (P().STEP), need = st >= 2 ? 0 : P().STEP - into;
      box.innerHTML = '<div class="pic">' + petSVG('happy') + '</div>' +
        '<p class="nm">' + esc(p.name) + ' <span class="chip">' + esc(P().typeName(p.type)) + '・' + P().stageName(st) + '</span></p>' +
        '<p class="sub">主人：' + esc(p.seat) + ' 號 ' + esc(p.owner) + '</p>' +
        '<p class="sub">' + (st >= 2 ? '已經是大朋友了，點心 ' + p.snacks + ' 個' : '點心 ' + into + '／' + P().STEP + '，再 ' + need + ' 個就長大') + '</p>' +
        '<a class="sm-btn" href="' + esc(houseUrl) + '">' + IC.swap + '換寵物、換衣服</a>';
    }
    function unlocked(i, prog) { return opts.allOpen || i === 0 || (prog[i - 1] || 0) > 0; }
    function nextOpen() {
      var prog = store.progress(opts.unit);
      for (var i = 0; i < levels.length; i++) if (!(prog[i] > 0)) return unlocked(i, prog) ? i : Math.max(0, i - 1);
      return 0;
    }
    function renderLevels() {
      var prog = store.progress(opts.unit);
      $('.sm-levels', app).innerHTML = levels.map(function (lv, i) {
        var s = prog[i] || 0, open = unlocked(i, prog);
        var state = !open ? IC.lock + '過了上一關才會開' : s > 0 ? starsHTML(s, 24) : '<span class="new">▶ 還沒玩</span>';
        return '<button type="button" class="sm-lv clay' + (!open ? ' lock' : '') + '" data-i="' + i + '"' + (open ? '' : ' aria-disabled="true"') + '>' +
          '<span class="ic">' + (open ? (lv.icon || '') : IC.lock) + '</span>' +
          '<span class="tx"><span class="n1">第 <b class="sm-num">' + (i + 1) + '</b> 關</span><span class="n2">' + esc(lv.name) + '</span><span class="n3">' + state + '</span></span></button>';
      }).join('');
      $('.sm-lvlabel', app).hidden = !levels.length;
    }
    function startLevel(i) {
      cur = i; stopScene();
      api.field.innerHTML = '';
      show('play');
      if (!scene) scene = opts.scene(api) || {};
      if (scene.start) scene.start(i);
    }
    function stopScene() { if (scene && scene.stop) { try { scene.stop(); } catch (e) { console.error(e); } } }

    $('.sm-s-setup', app).addEventListener('click', function (e) {
      var lv = e.target.closest('.sm-lv');
      if (lv) { if (!lv.classList.contains('lock')) startLevel(Number(lv.dataset.i)); return; }
      if (e.target.closest('.sm-start')) startLevel(levels.length ? nextOpen() : 0);
    });

    // ---------------- 回饋卡（寬鬆：答錯也一定能往下）
    function feedback(r) {
      r = r || {};
      var ok = !!r.ok, fb = $('.sm-fb', app);
      fb.className = 'sm-fb ' + (ok ? 'ok' : 'bad');
      $('.pic', fb).innerHTML = petSVG(ok ? 'happy' : 'worried', ok ? { spark: true } : { sweat: true });
      $('.hd', fb).innerHTML = ok ? '<span class="mk">✓</span>答對了' : '<span class="mk">✗</span>不是這個';
      var t = $('.t', fb); t.textContent = r.text || (zy ? (ok ? SAY.ok : SAY.bad) : (ok ? '答對了！寵物好開心。' : '沒關係，看看正確的做法。'));
      t.classList.toggle('sm-zy', zy);
      var ex = $('.ex', fb); ex.textContent = r.explain || ''; ex.hidden = !r.explain; ex.classList.toggle('sm-zy', zy && !!r.zyExplain);
      fb.hidden = false;
      setTimeout(function () { var b = $('.sm-fbgo', fb); if (b) b.focus(); }, 30);
      return new Promise(function (res) { fbResolve = res; });
    }
    $('.sm-fb', app).addEventListener('click', function (e) {
      if (!e.target.closest('.sm-fbgo')) return;
      $('.sm-fb', app).hidden = true;
      var f = fbResolve; fbResolve = null; if (f) f();
    });

    // ---------------- 結算
    function finish(r) {
      r = r || {};
      // 小常識島寬鬆原則（沿用畫畫島，老師 11-21）：完成就至少 1 顆星，下一關一定解鎖；星星反映表現
      var stars = Math.max(1, Math.min(3, Math.round(r.stars || 0)));
      var prog = store.saveStars(opts.unit, cur, stars);
      var total = prog.reduce(function (a, b) { return a + (b || 0); }, 0);
      if (total > 0) sset(scoreKey, String(total));
      var aw = P() ? P().award(opts.unit, cur) : null;   // 訪客回傳 null
      last = { stars: stars, level: cur };
      var done = $('.sm-s-done', app), p = curPet();

      $('.sm-eat .stars', done).innerHTML = starsHTML(stars, 72);
      $('.sm-eat .pic', done).innerHTML = petSVG('happy', { snack: !aw || aw.snack, spark: stars >= 3 });
      var say = $('.sm-eat .say', done);
      say.textContent = aw && !aw.snack ? '這關的點心吃過囉，再玩一次也很棒！' : zy ? SAY.eat : '寵物吃到點心，好開心！';
      say.classList.toggle('sm-zy', zy && !(aw && !aw.snack));

      // 成長條
      var grow = $('.sm-grow', done), step = P() ? P().STEP : 8;
      if (!aw) {
        grow.innerHTML = '<div class="hd"><b>還沒有寵物</b></div><p class="sub">去寵物小屋領養一隻，過關的點心就會存起來，寵物會慢慢長大。</p>' +
          '<a class="sm-btn or" href="' + esc(houseUrl) + '">' + IC.house + '去領養</a>';
      } else {
        var st = P().stageOf(aw.after), into = st >= 2 ? step : aw.after % step, fromInto = aw.snack ? into - 1 : into;
        var slots = ''; for (var k = 0; k < step; k++) slots += '<span class="slot' + (k < into ? ' on' : '') + (aw.snack && k === into - 1 && !aw.stageUp ? ' new' : '') + '">' + (k < into ? IC.ck : '') + '</span>';
        var msg = aw.stageUp ? '長大了！變成' + P().stageName(st) + '！' : st >= 2 ? '已經是大朋友了，點心 ' + aw.after + ' 個' : '再 ' + (step - into) + ' 個點心就長大';
        grow.innerHTML = '<div class="hd"><b>' + esc(p.name) + (aw.stageUp ? ' 長大了' : ' 長大中') + '</b>' +
          (aw.snack ? '<span class="plus">＋1 點心</span>' : '') + '</div>' +
          '<div class="slots">' + slots + '</div>' +
          '<p class="sub">' + (aw.snack && !aw.stageUp && st < 2 ? '點心 <b class="sm-num">' + Math.max(0, fromInto) + '</b>／' + step + ' → <b class="sm-num">' + into + '</b>／' + step + '，' : '') + esc(msg) + '</p>' +
          (aw.outfit ? '<p class="gift">拿到新衣服：<b>' + esc(P().outfitName(aw.outfit)) + '</b>，到寵物小屋就能穿上</p>' : '');
      }

      // 這關回顧
      var rv = r.review || [], marks = rv.map(function (x, i) { return '<span class="mk ' + (x.ok ? 'ok' : 'bad') + '" title="第 ' + (i + 1) + ' 題">' + (x.ok ? '✓' : '✗') + '</span>'; }).join('');
      var correct = r.correct != null ? r.correct : rv.filter(function (x) { return x.ok; }).length;
      var tot = r.total != null ? r.total : rv.length;
      $('.sm-review', done).innerHTML = '<div class="hd"><b>這關回顧</b>' + (tot ? '<span>答對 <b class="sm-num">' + correct + '</b>／<b class="sm-num">' + tot + '</b></span>' : '') +
        '<span class="marks">' + marks + '</span></div>' +
        (r.learned ? '<p class="lbl">今天學到</p><p class="learned">' + esc(r.learned) + '</p>' : '') +
        (r.retry ? '<p class="retry">' + esc(r.retry) + '</p>' : '');

      $('.sm-next', done).hidden = !(cur + 1 < levels.length);
      $('.sm-msg', done).textContent = '';
      show('done');
    }
    function submit() {
      if (!last) return;
      loadClassScores().then(function (CS) {
        CS.openSubmit({ unit: opts.unit, tier: '-', lang: 'smart', acc: last.level + 1, cpm: 0, stars: last.stars, min: 0 }, {});
      }, function () { $('.sm-msg', app).textContent = '交成績的元件載入失敗，請重新整理再試一次。'; });
    }
    $('.sm-s-done', app).addEventListener('click', function (e) {
      if (e.target.closest('.sm-submit')) submit();
      else if (e.target.closest('.sm-again')) startLevel(cur);
      else if (e.target.closest('.sm-next')) startLevel(cur + 1);
      else if (e.target.closest('.sm-tolv')) show('setup');
    });

    show('setup');
    // ?debug=1：給 tools/test-smart-scenes.py 用
    if (/[?&]debug=1\b/.test(location.search)) window.__smDebug = { api: api, start: startLevel, levels: levels.length, unit: opts.unit };
    return api;
  }

  function skeleton(o, homeUrl, houseUrl) {
    var g = o.grade ? '<span class="chip ' + gradeClass(o.grade) + '">' + esc(o.grade) + '</span>' : '';
    return '' +
    '<header class="sm-bar">' +
      '<a class="sm-btn sm-home" href="' + esc(homeUrl) + '">' + IC.home + '首頁</a>' +
      '<div class="sm-mid"><span class="sm-island">' + IC.isl + '小常識島</span><b>' + esc(o.title) + '</b>' + g + '</div>' +
      '<div class="sm-right"><div class="sm-prog" aria-live="polite"></div>' +
        '<a class="sm-petbadge" href="' + esc(houseUrl) + '" title="寵物小屋"></a></div>' +
    '</header>' +

    '<section class="sm-screen sm-s-setup">' +
      '<div class="sm-mypet clay"></div>' +
      '<div class="sm-title"><h1>' + esc(o.title) + '</h1>' +
        '<p class="sm-howto' + (o.zhuyin ? ' sm-zy' : '') + '">' + esc(o.howto || '') + '</p></div>' +
      '<button class="sm-btn or sm-start" type="button">' + IC.play + '開始</button>' +
      (o.teach ? '<div class="sm-teach"><b>給老師：</b>這關練什麼｜' + esc(o.teach) + '</div>' : '') +
      '<h2 class="sm-lvlabel">選一關</h2><div class="sm-levels"></div>' +
    '</section>' +

    '<section class="sm-screen sm-s-play" hidden><div class="sm-field"></div>' +
      '<div class="sm-fb" hidden role="dialog" aria-modal="true" aria-live="assertive"><div class="card clay">' +
        '<div class="pic"></div><div class="tx"><p class="hd"></p><p class="t"></p><p class="ex"></p>' +
        '<button class="sm-btn or sm-fbgo" type="button">' + IC.next + '下一題</button></div></div></div>' +
    '</section>' +

    '<section class="sm-screen sm-s-done" hidden>' +
      '<div class="sm-eat clay"><div class="stars"></div><div class="pic"></div><p class="say"></p></div>' +
      '<div class="sm-grow clay"></div>' +
      '<div class="sm-review clay"></div>' +
      '<div class="sm-acts"><p class="sm-msg" role="status"></p>' +
        '<button class="sm-btn or sm-submit" type="button">' + IC.send + '交成績給老師</button>' +
        '<button class="sm-btn sm-again" type="button">' + IC.again + '再玩一次</button>' +
        '<button class="sm-btn or sm-next" type="button">' + IC.next + '下一關</button>' +
        '<button class="sm-btn sm-tolv" type="button">' + IC.back + '選關卡</button>' +
        '<a class="sm-btn vi" href="' + esc(houseUrl) + '">' + IC.house + '回寵物小屋</a>' +
      '</div>' +
    '</section>';
  }

  window.SmartIsland = { mount: mount, store: store, starsHTML: starsHTML, IC: IC, W: W, H: H };
})();
