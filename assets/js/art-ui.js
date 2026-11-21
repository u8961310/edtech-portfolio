/* ================= 畫畫島共用畫面外殼 =================
 * 開始畫面（關卡卡）→ 遊戲（場景）→ 完成畫面（星星、下載、列印、交成績、畫廊）；另有「我的畫廊」全螢幕
 * 樣式：assets/css/art-island.css（A 版「貼紙畫冊」，規範 .interface-design/art-island-system.md）
 * 舞台固定 1366×657，依視窗等比縮放；場景用 px 排版即可
 *
 * 每關用法（Gemini 只寫 scene 這一塊）：
 *   ArtIsland.mount({
 *     unit: 24,                              // 成績 key：edtech-unit24-score（存「總星星數」，首頁徽章讀這個）
 *     title: '調色魔法鍋',
 *     grade: '1–2 年級',                      // 顯示用
 *     howto: '把紅、黃、藍顏料拖進大鍋，煮出客人點的顏色！',
 *     zhuyin: true,                          // 玩法句用注音字型（1–2 年級的關）
 *     teach: '三原色混色、深淺變化｜生活課程 2-I-1',   // 給老師看的「這關練什麼」
 *     hero: '<svg …>',                       // 開始畫面左側主角插圖（inline SVG 字串）
 *     levels: [{ name: '橘色南瓜', thumb: '<svg …>' }, …],   // 最多 4 關一排；第 1 關一定開，之後要前一關有星星才開
 *     submit: true,                          // 完成畫面要不要出現「交成績給老師」（自由畫畫的關設 false）
 *     scene: function (api) { return { start: function (levelIndex) {}, stop: function () {} }; }
 *   });
 *
 * api（場景拿到的）：
 *   api.field                 場景容器（1366×595，在頂列下方）；場景自己的 class 用 sc- 開頭
 *   api.quest(text)           設定頂列中間的任務條（空字串＝不顯示）
 *   api.finish({ stars, image, praise, caption })
 *                             完成這一關：stars 0–3、image＝canvas 或 dataURL（存進畫廊）、praise 稱讚句、caption 作品說明
 *   api.canvas(el, opts)      共用畫布（見下方 ArtIsland.canvas 說明），回傳畫布物件
 *   api.levelIndex()          目前第幾關（0 起算）
 *   api.toSetup()             回開始畫面
 *
 * ArtIsland.canvas(container, { width, height, color, size, mirror })
 *   畫布以 CSS px 計算，滑鼠與觸控同一套（pointer events），自動換算舞台縮放
 *   回傳：{ el, ctx, setColor(c), setSize(px), setTool('pen'|'eraser'), setMirror(fn|null), undo(), clear(),
 *           strokes(), onStroke(fn), toDataURL(), snapshot(), restore(img) }
 *   mirror：fn(point) → [額外的點…]，對稱關卡用來同時畫鏡像（例：p => [{ x: W - p.x, y: p.y }]）
 */
(function () {
  'use strict';
  var W = 1366, H = 657;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  var IC = {
    home: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    gal: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/></svg>',
    play: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    lock: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    down: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v12M6 11l6 6 6-6M5 20h14"/></svg>',
    print: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 9V4h10v5"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v6H7z"/></svg>',
    send: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>',
    again: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    next: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg class="ai-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>'
  };
  function starSVG(on, size) {
    return '<svg viewBox="0 0 24 24" width="' + (size || 28) + '" height="' + (size || 28) + '" aria-hidden="true"><path class="ai-star' + (on ? ' on' : '') +
      '" d="M12 2.8l2.8 5.7 6.3.9-4.6 4.4 1.1 6.2L12 17l-5.6 3 1.1-6.2L2.9 9.4l6.3-.9z"/></svg>';
  }
  function starsHTML(n, size) { return [1, 2, 3].map(function (i) { return starSVG(i <= n, size); }).join(''); }

  // ------------------------------------------------------------ 存檔
  var PROG_KEY = 'edtech-art-progress';   // { "24": [3, 2, 0, 0], ... } 每關最佳星數
  var GAL_KEY = 'edtech-art-gallery';     // [{ unit, title, caption, img(dataURL 縮圖), t }] 最新在前，最多 GAL_MAX 張
  var GAL_MAX = 15;
  function readJSON(k, d) { try { var v = JSON.parse(sget(k)); return v == null ? d : v; } catch (e) { return d; } }
  var store = {
    progress: function (unit) { var p = readJSON(PROG_KEY, {}); return Array.isArray(p[unit]) ? p[unit] : []; },
    saveStars: function (unit, idx, stars) {
      var p = readJSON(PROG_KEY, {}); var a = Array.isArray(p[unit]) ? p[unit] : [];
      a[idx] = Math.max(a[idx] || 0, stars); p[unit] = a; sset(PROG_KEY, JSON.stringify(p));
      return a;
    },
    gallery: function () { var g = readJSON(GAL_KEY, []); return Array.isArray(g) ? g : []; },
    addWork: function (w) {
      var g = store.gallery(); g.unshift(w); g = g.slice(0, GAL_MAX);
      while (g.length && !sset(GAL_KEY, JSON.stringify(g))) g.pop();   // 空間不夠就丟最舊的
      return g;
    }
  };

  // 把作品縮成畫廊縮圖（最長邊 480px，JPEG 省空間）
  function thumb(src, cb) {
    var img = new Image();
    img.onload = function () {
      var k = Math.min(1, 480 / Math.max(img.width, img.height));
      var c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = function () { cb(null); };
    img.src = src;
  }
  function toURL(image) {
    if (!image) return null;
    if (typeof image === 'string') return image;
    if (image.toDataURL) {   // canvas：補白底再輸出，透明處下載後才不會變黑
      var c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(image, 0, 0);
      return c.toDataURL('image/png');
    }
    return null;
  }

  // ------------------------------------------------------------ 舞台縮放
  function fit(stage) {
    var k = Math.min(window.innerWidth / W, window.innerHeight / H);
    var x = (window.innerWidth - W * k) / 2, y = (window.innerHeight - H * k) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + k + ')';
  }

  // ------------------------------------------------------------ 共用畫布
  function canvas(container, o) {
    o = o || {};
    var w = o.width || container.clientWidth, h = o.height || container.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var el = document.createElement('canvas');
    el.className = 'ai-cv'; el.width = Math.round(w * dpr); el.height = Math.round(h * dpr);
    el.style.width = w + 'px'; el.style.height = h + 'px';
    container.appendChild(el);
    var ctx = el.getContext('2d'); ctx.scale(dpr, dpr); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var st = { color: o.color || '#1F2A4D', size: o.size || 8, tool: 'pen', mirror: o.mirror || null };
    var history = [], strokes = 0, listeners = [];
    var drawing = null;

    function fillWhite() { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, el.width, el.height); ctx.restore(); }
    fillWhite();
    function pos(e) {   // 換算舞台縮放：用實際顯示大小對回畫布 CSS px
      var r = el.getBoundingClientRect();
      return { x: (e.clientX - r.left) * w / r.width, y: (e.clientY - r.top) * h / r.height };
    }
    function pts(p) { return [p].concat(st.mirror ? st.mirror(p) || [] : []); }
    function seg(a, b) {
      ctx.strokeStyle = st.tool === 'eraser' ? '#fff' : st.color;
      ctx.lineWidth = st.tool === 'eraser' ? st.size * 2.5 : st.size;
      var A = pts(a), B = pts(b);
      for (var i = 0; i < A.length && i < B.length; i++) { ctx.beginPath(); ctx.moveTo(A[i].x, A[i].y); ctx.lineTo(B[i].x, B[i].y); ctx.stroke(); }
    }
    function snapshot() { return ctx.getImageData(0, 0, el.width, el.height); }
    el.addEventListener('pointerdown', function (e) {
      if (e.button > 0) return;
      e.preventDefault(); el.setPointerCapture(e.pointerId);
      history.push(snapshot()); if (history.length > 30) history.shift();
      var p = pos(e); drawing = { last: p, id: e.pointerId, path: [p] };
      seg(p, { x: p.x + 0.01, y: p.y });   // 點一下也有一個點
    });
    el.addEventListener('pointermove', function (e) {
      if (!drawing || e.pointerId !== drawing.id) return;
      var list = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (var i = 0; i < list.length; i++) { var p = pos(list[i]); seg(drawing.last, p); drawing.last = p; drawing.path.push(p); }
    });
    function end(e) {
      if (!drawing || e.pointerId !== drawing.id) return;
      var path = drawing.path; drawing = null; strokes++;
      listeners.forEach(function (fn) { try { fn({ path: path, tool: st.tool, color: st.color, size: st.size }); } catch (err) { console.error(err); } });
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    return {
      el: el, ctx: ctx, width: w, height: h,
      setColor: function (c) { st.color = c; st.tool = 'pen'; },
      setSize: function (s) { st.size = s; },
      setTool: function (t) { st.tool = t; },
      setMirror: function (fn) { st.mirror = fn; },
      undo: function () { if (history.length) { ctx.putImageData(history.pop(), 0, 0); strokes = Math.max(0, strokes - 1); } },
      clear: function () { history.push(snapshot()); fillWhite(); strokes = 0; },
      strokes: function () { return strokes; },
      onStroke: function (fn) { listeners.push(fn); },
      snapshot: snapshot,
      restore: function (img) { ctx.putImageData(img, 0, 0); },
      toDataURL: function () { return el.toDataURL('image/png'); }
    };
  }

  // ------------------------------------------------------------ 交成績模組：用到才載入（跟打字島共用 class-scores.js）
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
    var app = document.createElement('div');
    app.className = 'ai-app';
    app.innerHTML = '<div class="ai-stage">' + skeleton(opts, homeUrl) + '</div>';
    document.body.appendChild(app);
    var stage = $('.ai-stage', app);
    fit(stage);
    window.addEventListener('resize', function () { fit(stage); });

    var cur = 0, scene = null, last = null, prevScreen = 'setup';
    var api = {
      field: $('.ai-field', app),
      quest: function (t) { $('.ai-quest', app).textContent = t || ''; },
      canvas: canvas,
      levelIndex: function () { return cur; },
      toSetup: function () { stopScene(); show('setup'); },
      finish: finish
    };

    function show(name) {
      ['setup', 'play', 'done', 'gallery'].forEach(function (n) { $('.ai-s-' + n, app).hidden = n !== name; });
      if (name === 'setup') { api.quest(''); renderLevels(); }
      if (name === 'gallery') api.quest('');
      if (name !== 'gallery') prevScreen = name;
    }
    function unlocked(i, prog) { return i === 0 || (prog[i - 1] || 0) > 0; }
    function nextOpen() {
      var prog = store.progress(opts.unit);
      for (var i = 0; i < levels.length; i++) if (!(prog[i] > 0)) return unlocked(i, prog) ? i : Math.max(0, i - 1);
      return 0;
    }
    function renderLevels() {
      var prog = store.progress(opts.unit);
      $('.ai-levels', app).innerHTML = levels.map(function (lv, i) {
        var s = prog[i] || 0, open = unlocked(i, prog);
        var state = !open ? '<span class="ai-ic-wrap">' + IC.lock + '</span>鎖住' : s > 0 ? '已過 ' + starsHTML(s) : '<span>▶ 還沒玩</span>';
        return '<button type="button" class="ai-lv' + (!open ? ' lock' : s > 0 ? '' : ' new') + '" data-i="' + i + '"' + (open ? '' : ' aria-disabled="true"') + '>' +
          '<span class="th">' + (open ? (lv.thumb || '') : IC.lock) + '</span>' +
          '<span><span class="n1 ai-num">第 ' + (i + 1) + ' 關</span><br><span class="n2">' + esc(lv.name) + '</span><span class="n3">' + state + '</span></span></button>';
      }).join('');
      $('.ai-lvlabel', app).hidden = !levels.length;
    }
    function startLevel(i) {
      cur = i; stopScene();
      api.field.innerHTML = '';
      api.quest('');
      show('play');
      if (!scene) scene = opts.scene(api) || {};
      if (scene.start) scene.start(i);
    }
    function stopScene() { if (scene && scene.stop) { try { scene.stop(); } catch (e) { console.error(e); } } }

    // ---------------- 開始畫面
    $('.ai-s-setup', app).addEventListener('click', function (e) {
      var lv = e.target.closest('.ai-lv');
      if (lv) { if (!lv.classList.contains('lock')) startLevel(Number(lv.dataset.i)); return; }
      if (e.target.closest('.ai-start')) startLevel(levels.length ? nextOpen() : 0);
    });

    // ---------------- 完成
    function finish(r) {
      r = r || {};
      var stars = Math.max(0, Math.min(3, Math.round(r.stars || 0)));
      var url = toURL(r.image);
      var prog = store.saveStars(opts.unit, cur, stars);
      var total = prog.reduce(function (a, b) { return a + (b || 0); }, 0);
      // 首頁徽章讀 edtech-unitN-score：有星星的關存總星數；自由畫畫（submit:false）存完成張數；opts.score(prog) 可自訂
      var prevScore = parseInt(sget(scoreKey) || '0', 10) || 0;
      var score = opts.score ? opts.score(prog, prevScore) : opts.submit === false ? prevScore + 1 : total;
      if (score > 0) sset(scoreKey, String(score));
      last = { stars: stars, url: url, caption: r.caption || (levels[cur] ? levels[cur].name : opts.title), level: cur };
      var done = $('.ai-s-done', app);
      $('.ai-work .ai-board', done).innerHTML = url ? '<img alt="剛完成的作品" src="' + url + '">' : '';
      $('.ai-work .cap', done).textContent = last.caption + '｜' + opts.title;
      $('.ai-praise h2', done).textContent = r.title || (stars >= 3 ? '太棒了！' : stars >= 1 ? '完成了！' : '畫好了！');
      $('.ai-praise .stars', done).innerHTML = opts.submit === false ? '' : starsHTML(stars, 76);
      $('.ai-praise p', done).textContent = r.praise || '';
      $('.ai-msg', done).textContent = '';
      var hasNext = cur + 1 < levels.length && stars > 0;
      $('.ai-next', done).hidden = !hasNext;
      $('.ai-submit', done).hidden = !opts.submit;
      api.quest('');
      show('done');
      if (url) thumb(url, function (t) {
        if (t) store.addWork({ unit: opts.unit, title: opts.title, caption: last.caption, img: t, t: Date.now() });
        renderGallery();
      }); else renderGallery();
    }
    function renderGallery() {
      var g = store.gallery();
      var row = g.slice(0, 6).map(function (w, i) {
        return '<figure class="' + (i === 0 && last && last.url ? 'nw' : '') + '">' + (i === 0 && last && last.url ? '<span class="nwb">新</span>' : '') +
          '<img alt="' + esc(w.title + ' ' + w.caption) + '" src="' + w.img + '"><figcaption>' + esc(w.title) + '</figcaption></figure>';
      });
      while (row.length < 6) row.push('<figure><span class="empty" aria-hidden="true"></span><figcaption>　</figcaption></figure>');
      $('.ai-gl', app).innerHTML = row.join('');
      $('.ai-s-done .ai-gallery .hd span', app).textContent = '共 ' + g.length + ' 張作品';
    }
    function download() {
      if (!last || !last.url) return;
      var a = document.createElement('a');
      a.href = last.url; a.download = opts.title + '-' + last.caption + '.png';
      document.body.appendChild(a); a.click(); a.remove();
    }
    function submit() {
      if (!last) return;
      loadClassScores().then(function (CS) {
        CS.openSubmit({ unit: opts.unit, tier: '-', lang: 'art', acc: last.level + 1, cpm: 0, stars: last.stars, min: 0 }, {});
      }, function () { $('.ai-msg', app).textContent = '交成績的元件載入失敗，請重新整理再試一次。'; });
    }
    $('.ai-s-done', app).addEventListener('click', function (e) {
      if (e.target.closest('.ai-dl')) download();
      else if (e.target.closest('.ai-print')) window.print();
      else if (e.target.closest('.ai-submit')) submit();
      else if (e.target.closest('.ai-again')) startLevel(cur);
      else if (e.target.closest('.ai-next')) startLevel(cur + 1);
      else if (e.target.closest('.ai-tolv')) show('setup');
    });

    // ---------------- 我的畫廊
    function openGallery() {
      var g = store.gallery();
      $('.ai-galgrid', app).innerHTML = g.length ? g.map(function (w) {
        return '<figure><img alt="' + esc(w.title + ' ' + w.caption) + '" src="' + w.img + '"><figcaption>' + esc(w.title + '・' + w.caption) + '</figcaption></figure>';
      }).join('') : '<p class="none">還沒有作品，完成一關就會收進來。</p>';
      $('.ai-s-gallery .hd span', app).textContent = '最近 ' + g.length + ' 張（最多留 ' + GAL_MAX + ' 張，只存在這台電腦）';
      show('gallery');
    }
    app.addEventListener('click', function (e) {
      if (e.target.closest('.ai-bar .ai-gal')) { if (!$('.ai-s-play', app).hidden) stopScene(); openGallery(); }
      else if (e.target.closest('.ai-galback')) { if (prevScreen === 'play') startLevel(cur); else show(prevScreen); }
    });

    show('setup');
    // ?debug=1：給 tools/test-art-scenes.py 用，直接開某關或完成目前這關
    if (/[?&]debug=1\b/.test(location.search)) window.__aiDebug = { api: api, start: startLevel, levels: levels.length, unit: opts.unit };
    return api;
  }

  function skeleton(o, homeUrl) {
    return '' +
    '<header class="ai-bar">' +
      '<a class="ai-btn ai-home" href="' + esc(homeUrl) + '">' + IC.home + '首頁</a>' +
      '<div class="ai-quest" aria-live="polite"></div>' +
      '<button class="ai-btn ai-gal" type="button">' + IC.gal + '我的畫廊</button>' +
    '</header>' +

    '<section class="ai-screen ai-s-setup">' +
      '<div class="ai-hero" aria-hidden="true">' + (o.hero || '') + '</div>' +
      '<div class="ai-title"><h1>' + esc(o.title) + '</h1>' +
        '<p class="ai-howto' + (o.zhuyin ? ' ai-zy' : '') + '">' + esc(o.howto || '') + '</p></div>' +
      '<button class="ai-btn go ai-start" type="button">' + IC.play + '開始</button>' +
      (o.teach ? '<div class="ai-teach"><b>這關練什麼：</b>' + esc(o.teach) + (o.grade ? '｜' + esc(o.grade) : '') + '</div>' : '') +
      '<h2 class="ai-lvlabel">選一關</h2><div class="ai-levels"></div>' +
    '</section>' +

    '<section class="ai-screen ai-s-play" hidden><div class="ai-field"></div></section>' +

    '<section class="ai-screen ai-s-done" hidden><div class="ai-done">' +
      '<div class="ai-work"><span class="ai-tape" style="left:60px;top:-12px;transform:rotate(-4deg)"></span><span class="ai-tape" style="right:60px;top:-12px;transform:rotate(5deg)"></span>' +
        '<div class="ai-board"></div><div class="cap"></div></div>' +
      '<div class="ai-praise"><h2></h2><div class="stars"></div><p></p><div class="ai-msg" role="status"></div>' +
        '<div class="ai-acts">' +
          '<button class="ai-btn ai-dl" type="button">' + IC.down + '下載圖片</button>' +
          '<button class="ai-btn ai-print" type="button">' + IC.print + '列印</button>' +
          '<button class="ai-btn go ai-submit" type="button">' + IC.send + '交成績給老師</button>' +
          '<button class="ai-btn ai-again" type="button">' + IC.again + '再玩一次</button>' +
          '<button class="ai-btn go ai-next" type="button">' + IC.next + '下一關</button>' +
          '<button class="ai-btn ai-tolv" type="button">' + IC.back + '選關卡</button>' +
        '</div></div>' +
      '<div class="ai-panel ai-gallery"><div class="hd"><b>我的畫廊</b><span></span></div><div class="ai-gl"></div></div>' +
    '</div></section>' +

    '<section class="ai-screen ai-s-gallery" hidden><div class="ai-panel ai-galbox">' +
      '<div class="hd"><b>我的畫廊</b><span></span><button class="ai-btn ai-galback" type="button" style="margin-left:auto">' + IC.back + '回去</button></div>' +
      '<div class="ai-galgrid"></div></div></section>';
  }

  window.ArtIsland = { mount: mount, canvas: canvas, store: store, starsHTML: starsHTML, W: W, H: H };
})();
