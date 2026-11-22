/* ================= 滑鼠島共用畫面外殼 =================
 * 開始畫面 → 三段遊戲（看我示範／自己來／小挑戰）→ 結算（星星、寶石落槽、成功率、圖鑑、交成績）
 * 樣式：assets/css/mouse-island.css（C 版「海島尋寶地圖」，規範 .interface-design/mouse-island-system.md）
 * 舞台固定 1366×657，依視窗等比縮放；頂欄 76px，場景區 api.field 是 1366×581
 *
 * 每關用法（Gemini 只寫 scene 這一塊）：
 *   MouseIsland.mount({
 *     unit: 33,                     // 成績 key：edtech-unit33-score（存最佳星數，首頁徽章讀這個）
 *     title: '敲敲蛋寶寶',
 *     skill: 'dblclick',            // point｜click｜dblclick｜drag｜right｜wheel｜box｜mix（總複習）
 *     gem: '雙擊',                   // 寶石名稱（結算「你拿到雙擊寶石！」）
 *     grade: '14',                  // '12'｜'14'｜'34'：年段（14 的關，首頁選 3–4／5–6 年級時自動加難度、可跳過示範）
 *     zhuyin: true,                 // 1–2 年級會看到的關：玩法句、段落名、寄寄台詞、結算用注音字型
 *     howto: '快快按兩下，把蛋敲開！',
 *     teach: '雙擊｜生活 2-I-5、資E1',
 *     hints: ['按兩下要快一點喔！', '再看一次示範。'],   // 失手 2 次、4 次時寄寄說的話（注音關要先核過讀音）
 *     hero: '<svg …>',              // 開始畫面左邊的主角插圖
 *     dex: { name: '蛋寶寶圖鑑', total: 12, items: { chick: { name: '小雞', svg: '<svg…>' }, … } },   // 選填：收集圖鑑
 *     scene: function (api) { return { start(stage, cfg) {}, hint(level) {}, assist() {}, stop() {} }; }
 *   });
 *
 * 外殼的流程：
 *   開始 → scene.start(0, cfg) → 場景出目標、偵測操作，對了 api.hit()、錯了 api.miss()，這一段做完 api.stageDone()
 *   → 外殼放「完成！」→ scene.start(1, cfg) → … → scene.start(2, cfg) → stageDone → 結算
 *   失手連續 2 次：scene.hint(1)＋寄寄說 hints[0]；連續 4 次：scene.hint(2)＋寄寄說 hints[1]（場景自己呼叫 api.demo 重播示範）；
 *   連續 6 次：cfg.assist = true＋scene.assist()（場景要把目標放大、放慢）。對一次就歸零。
 *   cfg：{ stage, big, assist, size, speed }。big＝3–4 年級玩 1–4 的關；size／speed 是建議倍率（第三段且 big 時 0.8／1.3，assist 時 1.4／0.6）
 *
 * api（場景拿到的）：見檔尾 makeApi 的註解；偵測器 MouseIsland.on(el, type, handlers, opts) 見 detectors 段
 */
(function () {
  'use strict';
  var W = 1366, H = 657, BAR = 76;
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function sget(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function readJSON(k, d) { try { var v = JSON.parse(sget(k)); return v == null ? d : v; } catch (e) { return d; } }
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 7 關的順序（技能階梯）與寶石：大廳、結算的寶箱都照這個排
  var LADDER = [
    { unit: 21, gem: '指向單擊', color: '#E8704F' }, { unit: 33, gem: '雙擊', color: '#F2B134' },
    { unit: 19, gem: '拖拉', color: '#5FAF6A' }, { unit: 2, gem: '總複習', color: '#4FA3C7' },
    { unit: 34, gem: '右鍵', color: '#9B6BD1' }, { unit: 35, gem: '滾輪', color: '#2F8FB0' },
    { unit: 36, gem: '框選', color: '#D9577A' }
  ];
  var STAGES = ['看我示範', '自己來', '小挑戰'];
  var STAGE_NOTE = ['目標大、不會動，先看示範再做。', '目標變小、慢慢動，失手不扣分。', '目標更小、會動，挑戰看看！'];
  var DBL = { slow: 800, mid: 550, fast: 380 };   // 雙擊間隔（毫秒），老師可在開始畫面調

  // ------------------------------------------------------------ 圖示與角色
  var IC = {
    home: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    play: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>',
    skip: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l9 7-9 7z"/><path d="M17 5v14"/></svg>',
    send: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3L10 14"/><path d="M21 3l-7 18-4-7-7-4z"/></svg>',
    again: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
    map: '<svg class="mi-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
    on: '<svg viewBox="0 0 24 24" fill="none" stroke="#33261B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/></svg>',
    off: '<svg viewBox="0 0 24 24" fill="none" stroke="#33261B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>'
  };
  var CRAB = '<svg viewBox="0 0 120 112" aria-hidden="true">' +
    '<g stroke="#8A3A22" stroke-width="5" stroke-linecap="round"><path d="M26 100 L20 110"/><path d="M42 102 L40 111"/><path d="M58 100 L62 110"/></g>' +
    '<circle cx="86" cy="70" r="30" fill="#F6D9A8" stroke="#B9794A" stroke-width="4"/>' +
    '<path d="M86 70 m-5 0 a5 5 0 1 1 5 5 a10 10 0 1 1 -10 -10 a15 15 0 1 1 15 15" fill="none" stroke="#B9794A" stroke-width="3" stroke-linecap="round"/>' +
    '<ellipse cx="46" cy="84" rx="32" ry="20" fill="#E8704F" stroke="#8A3A22" stroke-width="3"/>' +
    '<path d="M36 66 V55 M58 66 V55" stroke="#8A3A22" stroke-width="5" stroke-linecap="round"/>' +
    '<circle cx="36" cy="46" r="9" fill="#FFF9EA" stroke="#33261B" stroke-width="2.5"/><circle cx="58" cy="46" r="9" fill="#FFF9EA" stroke="#33261B" stroke-width="2.5"/>' +
    '<circle cx="38" cy="47" r="4" fill="#33261B"/><circle cx="60" cy="47" r="4" fill="#33261B"/>' +
    '<path d="M22 30 Q22 6 47 6 Q72 6 72 30 Z" fill="#23406B" stroke="#14264A" stroke-width="2.5" stroke-linejoin="round"/>' +
    '<ellipse cx="47" cy="30" rx="30" ry="6" fill="#14264A"/><circle cx="47" cy="19" r="5" fill="#F2B134"/>' +
    '<path d="M38 88 Q47 98 56 88" fill="none" stroke="#5A1E10" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="10" cy="78" r="11" fill="#E8704F" stroke="#8A3A22" stroke-width="3"/><path d="M4 69 L10 78" stroke="#8A3A22" stroke-width="3" stroke-linecap="round"/>' +
    '<circle cx="80" cy="88" r="10" fill="#E8704F" stroke="#8A3A22" stroke-width="3"/><path d="M86 80 L80 88" stroke="#8A3A22" stroke-width="3" stroke-linecap="round"/></svg>';
  var CURSOR = '<svg viewBox="0 0 40 56" aria-hidden="true"><path d="M4 3 L4 42 L13 33 L20 50 L27 47 L20 30 L33 30 Z" fill="#FFFDF6" stroke="#33261B" stroke-width="3" stroke-linejoin="round"/></svg>';
  function starSVG(on) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="12,1.5 15.2,8.3 22.6,9.2 17.1,14.3 18.6,21.6 12,18 5.4,21.6 6.9,14.3 1.4,9.2 8.8,8.3" stroke-linejoin="round" ' +
      (on ? 'fill="#F2B134" stroke="#8A5A12"' : 'fill="#FFF8E4" stroke="#8A7A62"') + ' stroke-width="1.5"/></svg>';
  }
  function starsHTML(n) { return [1, 2, 3].map(function (i) { return starSVG(i <= n); }).join(''); }
  function gemPath(color) {
    return '<polygon points="0,-11 11,-3.5 0,11 -11,-3.5" fill="' + color + '" stroke="#3A2412" stroke-width="1.6" stroke-linejoin="round"/>' +
      '<polygon points="0,-11 11,-3.5 0,-3.5" fill="#fff" opacity=".4"/>';
  }

  // ------------------------------------------------------------ 存檔
  var PROG_KEY = 'edtech-mouse-progress';   // { "33": { stars, rate, best(毫秒), plays } }
  var DEX_KEY = 'edtech-mouse-dex';         // { "33": ["chick", "penguin", …] }
  var SET_KEY = 'edtech-mouse-settings';    // { dbl: 'slow'|'mid'|'fast', sound: false }
  var store = {
    all: function () { var p = readJSON(PROG_KEY, {}); return p && typeof p === 'object' ? p : {}; },
    get: function (unit) { return store.all()[unit] || null; },
    save: function (unit, r) {
      var p = store.all(), o = p[unit] || { stars: 0, rate: 0, best: 0, plays: 0 };
      var rec = !o.best || r.ms < o.best;
      o.stars = Math.max(o.stars || 0, r.stars); o.rate = Math.max(o.rate || 0, r.rate);
      if (rec) o.best = r.ms;
      o.plays = (o.plays || 0) + 1; p[unit] = o; sset(PROG_KEY, JSON.stringify(p));
      return { prog: o, record: rec && o.plays > 1 };
    },
    dex: function (unit) { var d = readJSON(DEX_KEY, {}); return Array.isArray(d[unit]) ? d[unit] : []; },
    addDex: function (unit, id) {
      var d = readJSON(DEX_KEY, {}), a = Array.isArray(d[unit]) ? d[unit] : [];
      if (a.indexOf(id) >= 0) return false;
      a.push(id); d[unit] = a; sset(DEX_KEY, JSON.stringify(d)); return true;
    },
    settings: function () { var s = readJSON(SET_KEY, {}); return { dbl: DBL[s.dbl] ? s.dbl : 'mid', sound: !!s.sound }; },
    setSettings: function (s) { sset(SET_KEY, JSON.stringify(s)); },
    gems: function () { var p = store.all(); return LADDER.map(function (l) { return !!(p[l.unit] && p[l.unit].stars > 0); }); }
  };

  // 首頁選的年級（只記到當天）；網址 ?grade=12|34|56|all 優先
  function homeGrade() {
    var m = /[?&]grade=(12|34|56|all)\b/.exec(location.search);
    if (m) return m[1];
    var v = readJSON('edtech-home-grade', null), d = new Date();
    var today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    return v && v.day === today ? v.g : null;
  }

  // ------------------------------------------------------------ 舞台縮放與座標
  var stageEl = null, scaleK = 1;
  function fit(stage) {
    scaleK = Math.min(window.innerWidth / W, window.innerHeight / H);
    var x = (window.innerWidth - W * scaleK) / 2, y = (window.innerHeight - H * scaleK) / 2;
    stage.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + scaleK + ')';
  }
  /** 視窗座標 → 某元素內的 px（已換算舞台縮放） */
  function local(e, el) { var r = el.getBoundingClientRect(); return { x: (e.clientX - r.left) / scaleK, y: (e.clientY - r.top) / scaleK }; }
  /** 元素中心在另一個元素（預設場景區）裡的座標 */
  function centerIn(el, base) {
    var r = el.getBoundingClientRect(), b = base.getBoundingClientRect();
    return { x: (r.left + r.width / 2 - b.left) / scaleK, y: (r.top + r.height / 2 - b.top) / scaleK };
  }

  // ------------------------------------------------------------ 音效（WebAudio 合成，預設關；教室不吵）
  var actx = null, soundOn = false;
  function tone(freq, dur, type, when, vol) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      var t = actx.currentTime + (when || 0), o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol || .18, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
      o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + .02);
    } catch (e) { /* 不支援就靜音 */ }
  }
  var SFX = {
    pop: function () { tone(660, .12, 'triangle'); tone(990, .1, 'triangle', .05); },
    ok: function () { tone(523, .12); tone(659, .12, 'sine', .1); tone(784, .18, 'sine', .2); },
    giggle: function () { [0, .09, .18].forEach(function (w, i) { tone(880 - i * 60, .07, 'square', w, .06); }); },
    boing: function () { tone(220, .2, 'sine'); tone(330, .15, 'sine', .08); },
    gem: function () { [0, .08, .16, .24].forEach(function (w, i) { tone(784 + i * 196, .14, 'triangle', w); }); }
  };
  function sfx(name) { if (soundOn && SFX[name]) SFX[name](); }

  // ------------------------------------------------------------ 偵測器（7 關判斷標準都在這裡，場景不要自己寫）
  // MouseIsland.on(el, type, handlers, opts) → 回傳 off()。所有座標都已換算成「el 內的 px」
  //   'point'   游標停在 el 上 opts.dwell 毫秒（預設 300）→ ok(pos)；觸控：手指按到就算
  //   'click'   左鍵按下又放開在 el 上（移動 < 12px）→ ok(pos, e)（e.ctrlKey 可判斷 Ctrl＋點選）；按右鍵 → wrong('right')
  //   'dblclick' 兩下左鍵間隔 ≤ 雙擊速度設定、距離 < 18px → ok(pos)；只按一下（等不到第二下）→ single(pos)；觸控：點兩下
  //   'drag'    按住 el 拖動放開 → move(pos, dx, dy) 拖動中、drop(pos, target)：target＝opts.targets 裡放開位置所在的元素（沒有就 null）；
  //             沒拖就放開（移動 < 8px）→ tap(pos)。拖動中 el 會跟著游標移動（opts.follow === false 可關掉，自己處理）
  //   'right'   按右鍵 → ok(pos)（會擋掉瀏覽器選單）；按左鍵 → wrong('left')；觸控：長按 550 毫秒
  //   'wheel'   滾輪 → wheel(dy, e)（dy 往下為正，已把行數換成 px）；觸控：手指上下滑 → wheel(-手指位移)
  //   'box'     在 el（容器）空白處按住拖出框 → move(rect)、select(items, rect, e)：items＝opts.items() 裡中心點落在框內的元素；
  //             框太小（< 10px）當成點空白 → empty()
  var dblSetting = 'mid';
  function on(el, type, h, o) {
    h = h || {}; o = o || {};
    var offs = [];
    function listen(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); offs.push(function () { t.removeEventListener(ev, fn, opt); }); }
    var call = function (name) { var a = [].slice.call(arguments, 1); if (h[name]) { try { h[name].apply(null, a); } catch (err) { console.error(err); } } };

    if (type === 'point') {
      var tm = null;
      listen(el, 'pointerenter', function (e) { if (e.pointerType === 'touch') return; clearTimeout(tm); tm = setTimeout(function () { call('ok', local(e, el)); }, o.dwell == null ? 300 : o.dwell); });
      listen(el, 'pointerleave', function () { clearTimeout(tm); call('leave'); });
      listen(el, 'pointerdown', function (e) { if (e.pointerType === 'touch') call('ok', local(e, el)); });
      offs.push(function () { clearTimeout(tm); });
    }
    if (type === 'click') {
      var down = null;
      listen(el, 'pointerdown', function (e) { if (e.button === 2) { call('wrong', 'right'); return; } if (e.button !== 0) return; down = { x: e.clientX, y: e.clientY }; });
      listen(el, 'pointerup', function (e) {
        if (!down || e.button !== 0) return;
        var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) / scaleK; down = null;
        if (moved < 12) call('ok', local(e, el), e);
      });
    }
    if (type === 'dblclick') {
      var last = null, single = null;
      listen(el, 'pointerdown', function (e) { if (e.button === 2) call('wrong', 'right'); });
      listen(el, 'pointerup', function (e) {
        if (e.button !== 0) return;
        var p = local(e, el), now = performance.now(), gap = DBL[dblSetting] || 550;
        if (last && now - last.t <= gap && Math.hypot(p.x - last.p.x, p.y - last.p.y) < 18) {
          clearTimeout(single); last = null; call('ok', p);
        } else {
          last = { t: now, p: p }; clearTimeout(single);
          call('first', p);   // 第一下（場景可以讓目標晃一下）
          single = setTimeout(function () { if (last) { var q = last.p; last = null; call('single', q); } }, gap + 20);
        }
      });
      offs.push(function () { clearTimeout(single); });
    }
    if (type === 'drag') {
      var st = null;
      listen(el, 'pointerdown', function (e) {
        if (e.button !== 0) return;
        e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
        st = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, tx: el.style.transform || '' };
        el.style.zIndex = 4; call('start', local(e, el.parentNode));
      });
      listen(el, 'pointermove', function (e) {
        if (!st || e.pointerId !== st.id) return;
        var dx = (e.clientX - st.x) / scaleK, dy = (e.clientY - st.y) / scaleK;
        st.moved = Math.max(st.moved, Math.hypot(dx, dy));
        if (o.follow !== false) el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        call('move', local(e, el.parentNode), dx, dy);
      });
      var end = function (e) {
        if (!st || e.pointerId !== st.id) return;
        var moved = st.moved; st = null; el.style.zIndex = '';
        if (o.follow !== false) el.style.transform = '';
        if (moved < 8) { call('tap', local(e, el.parentNode)); return; }
        var hit = null, list = typeof o.targets === 'function' ? o.targets() : (o.targets || []);
        for (var i = 0; i < list.length; i++) {
          var r = list[i].getBoundingClientRect();
          if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { hit = list[i]; break; }
        }
        call('drop', local(e, el.parentNode), hit);
      };
      listen(el, 'pointerup', end); listen(el, 'pointercancel', end);
    }
    if (type === 'right') {
      var lp = null;
      listen(el, 'contextmenu', function (e) { e.preventDefault(); call('ok', local(e, el)); });
      listen(el, 'pointerdown', function (e) {
        if (e.pointerType === 'touch') {
          var sx = e.clientX, sy = e.clientY;
          lp = setTimeout(function () { lp = null; call('ok', local({ clientX: sx, clientY: sy }, el)); }, 550);
        } else if (e.button === 0) call('wrong', 'left');
      });
      var cancel = function () { if (lp) { clearTimeout(lp); lp = null; } };
      listen(el, 'pointerup', cancel); listen(el, 'pointercancel', cancel);
      listen(el, 'pointermove', function (e) { if (lp && e.pointerType === 'touch' && (Math.abs(e.movementX) + Math.abs(e.movementY)) > 6) cancel(); });
      offs.push(cancel);
    }
    if (type === 'wheel') {
      listen(el, 'wheel', function (e) { e.preventDefault(); var k = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? 400 : 1; call('wheel', e.deltaY * k, e); }, { passive: false });
      var ty = null;
      listen(el, 'pointerdown', function (e) { if (e.pointerType === 'touch') ty = e.clientY; });
      listen(el, 'pointermove', function (e) { if (ty == null || e.pointerType !== 'touch') return; var d = (e.clientY - ty) / scaleK; ty = e.clientY; call('wheel', -d, e); });
      listen(el, 'pointerup', function () { ty = null; });
    }
    if (type === 'box') {
      var bx = null, box = null;
      listen(el, 'pointerdown', function (e) {
        if (e.button !== 0) return;
        var bg = o.background ? o.background(e.target) : e.target === el;
        if (!bg) return;
        e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (err) { /* 舊瀏覽器 */ }
        bx = { id: e.pointerId, p: local(e, el) };
        box = document.createElement('div'); box.className = 'mi-boxsel'; el.appendChild(box);
      });
      listen(el, 'pointermove', function (e) {
        if (!bx || e.pointerId !== bx.id) return;
        var q = local(e, el), r = { x: Math.min(bx.p.x, q.x), y: Math.min(bx.p.y, q.y), w: Math.abs(q.x - bx.p.x), h: Math.abs(q.y - bx.p.y) };
        box.style.cssText = 'left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px';
        bx.r = r; call('move', r);
      });
      var bend = function (e) {
        if (!bx || e.pointerId !== bx.id) return;
        var r = bx.r; bx = null; if (box) { box.remove(); box = null; }
        if (!r || r.w < 10 || r.h < 10) { call('empty'); return; }
        var items = (o.items ? o.items() : []).filter(function (it) { var c = centerIn(it, el); return c.x >= r.x && c.x <= r.x + r.w && c.y >= r.y && c.y <= r.y + r.h; });
        call('select', items, r, e);
      };
      listen(el, 'pointerup', bend); listen(el, 'pointercancel', bend);
      offs.push(function () { if (box) box.remove(); });
    }
    return function off() { offs.forEach(function (f) { f(); }); offs = []; };
  }

  // ------------------------------------------------------------ 交成績模組：用到才載入（跟其他島共用 class-scores.js）
  var JS_BASE = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
  var csLoading = null;
  function loadClassScores() {
    if (window.ClassScores) return Promise.resolve(window.ClassScores);
    if (csLoading) return csLoading;
    csLoading = new Promise(function (resolve, reject) {
      var s = document.createElement('script'); s.src = JS_BASE + 'class-scores.js';
      s.onload = function () { window.ClassScores ? resolve(window.ClassScores) : reject(new Error('no ClassScores')); };
      s.onerror = function () { csLoading = null; reject(new Error('load failed')); };
      document.head.appendChild(s);
    });
    return csLoading;
  }

  // ------------------------------------------------------------ 主程式
  function mount(opts) {
    var scoreKey = 'edtech-unit' + opts.unit + '-score';
    var homeUrl = opts.homeUrl || '../../index.html';
    var lobbyUrl = opts.lobbyUrl || homeUrl;
    var zyc = opts.zhuyin ? ' mi-zy' : '';
    var g = homeGrade(), big = opts.grade === '14' && (g === '34' || g === '56');
    var set = store.settings(); dblSetting = set.dbl; soundOn = set.sound;

    var app = document.createElement('div');
    app.className = 'mi-app';
    app.innerHTML = '<div class="mi-stage">' + skeleton(opts, homeUrl, zyc) + '</div>';
    document.body.appendChild(app);
    var stage = stageEl = $('.mi-stage', app);
    fit(stage); window.addEventListener('resize', function () { fit(stage); });
    stage.addEventListener('contextmenu', function (e) { e.preventDefault(); });   // 遊戲裡不要跳瀏覽器右鍵選單

    var field = $('.mi-field', app), sayEl = $('.mi-say', app);
    var scene = null, cur = 0, run = null, timers = [];
    var cfg = { stage: 0, big: big, assist: false, size: 1, speed: 1 };
    function later(fn, ms) { var t = setTimeout(fn, ms); timers.push(t); return t; }
    function clearTimers() { timers.forEach(clearTimeout); timers = []; }

    function show(name) {
      ['setup', 'play', 'done'].forEach(function (n) { $('.mi-s-' + n, app).hidden = n !== name; });
      $('.mi-pills', app).hidden = name !== 'play';
      $('.mi-calm', app).hidden = !(name === 'play' && cur === 1);
      if (name === 'setup') renderSetup();
    }
    function say(text, o) {
      o = o || {};
      if (!text) { sayEl.hidden = true; sayEl.textContent = ''; sayEl.className = 'mi-say'; return; }
      sayEl.textContent = text; sayEl.hidden = false;
      sayEl.className = 'mi-say' + (o.zy === false ? '' : zyc) + (o.hint ? ' hint' : '');
    }

    // ---------------- 開始畫面
    function renderSetup() {
      var p = store.get(opts.unit);
      $('.mi-best', app).textContent = p && p.best ? '最快紀錄 ' + (p.best / 1000).toFixed(1) + ' 秒｜最多 ' + p.stars + ' 顆星' : '';
      $('.mi-skipdemo', app).hidden = !(big || (p && p.stars > 0));
      $('.mi-title', app).textContent = opts.title;
      $('.mi-title', app).className = 'mi-title' + zyc;
      say('');
    }
    $('.mi-s-setup', app).addEventListener('click', function (e) {
      if (e.target.closest('.mi-start')) begin(0);
      else if (e.target.closest('.mi-skipdemo')) begin(1);
      var b = e.target.closest('.mi-seg button');
      if (b) {
        dblSetting = b.dataset.v; set.dbl = dblSetting; store.setSettings(set);
        $('.mi-seg', app).querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      }
    });
    $('.mi-sound', app).addEventListener('click', function () {
      soundOn = !soundOn; set.sound = soundOn; store.setSettings(set);
      this.innerHTML = soundOn ? IC.on : IC.off; this.setAttribute('aria-label', soundOn ? '關掉音效' : '打開音效');
      if (soundOn) sfx('pop');
    });

    // ---------------- 三段遊戲
    function begin(from) {
      run = { t0: performance.now(), hits: 0, misses: 0, hints: 0, consec: 0, items: [], from: from };
      cfg.assist = false;
      startStage(from);
    }
    function startStage(i) {
      cur = i; stopScene(); clearTimers();
      field.innerHTML = ''; say('');
      cfg.stage = i;
      cfg.size = cfg.assist ? 1.4 : (i === 2 && big ? .8 : 1);
      cfg.speed = cfg.assist ? .6 : (i === 2 && big ? 1.3 : 1);
      $('.mi-pills', app).innerHTML = STAGES.map(function (n, k) {
        var c = k < i ? 'done' : k === i ? 'now' : '';
        return '<span class="mi-pill ' + c + '"><i>' + (k < i ? '✓' : k + 1) + '</i><span class="' + zyc.trim() + '">' + n + '</span></span>';
      }).join('');
      $('.mi-title', app).textContent = (opts.zhuyin ? '第' + '一二三'[i] + '段：' : '第 ' + (i + 1) + ' 段：') + STAGES[i];
      show('play');
      if (!scene) scene = opts.scene(api) || {};
      if (scene.start) scene.start(i, cfg);
      // 場景自己沒說話時，第一段寄寄說預設句（依本關技能；注音句 11-22 萌典核過）
      if (i === 0 && sayEl.hidden) say({ point: '看我移過去', dblclick: '看我按兩下', drag: '看我拖過去', mix: '看我做一次',
        right: '看我按右鍵', wheel: '看我轉滾輪', box: '看我拉一個框' }[opts.skill] || '看我按一次');
    }
    function stopScene() { if (scene && scene.stop) { try { scene.stop(); } catch (e) { console.error(e); } } }

    function hit() {
      if (!run) return;
      run.hits++; run.consec = 0; sfx('pop');
      if (!sayEl.classList.contains('hint')) return;
      say('');
    }
    function miss() {
      if (!run) return;
      run.misses++; run.consec++;
      if (run.consec === 2) { run.hints++; say(opts.hints && opts.hints[0], { hint: true }); if (scene.hint) scene.hint(1); }
      else if (run.consec === 4) { run.hints++; say(opts.hints && opts.hints[1], { hint: true }); if (scene.hint) scene.hint(2); }
      else if (run.consec === 6 && !cfg.assist) {
        run.hints++; cfg.assist = true; cfg.size = 1.4; cfg.speed = .6;
        if (scene.assist) scene.assist();
      }
    }
    function stageDone() {
      if (!run) return;
      sfx('ok');
      if (cur < 2) {
        var b = document.createElement('div'); b.className = 'mi-banner' + zyc; b.textContent = '完成！'; field.appendChild(b);
        later(function () { startStage(cur + 1); }, 1300);
      } else later(finish, 600);
    }

    // ---------------- 結算
    function finish() {
      stopScene();
      var r = run; run = null;
      var ms = Math.round(performance.now() - r.t0);
      var total = r.hits + r.misses, rate = total ? Math.round(r.hits * 100 / total) : 100;
      var stars = r.misses <= 2 ? 3 : r.misses <= 6 ? 2 : 1;   // 失手不扣命，只影響星星
      var saved = store.save(opts.unit, { stars: stars, rate: rate, ms: ms });
      var best = saved.prog.stars;
      if (best > 0) sset(scoreKey, String(best));
      var idx = -1; LADDER.forEach(function (l, i) { if (l.unit === opts.unit) idx = i; });
      var done = $('.mi-s-done', app);
      $('.mi-chest > svg', done).innerHTML = chestSVG(store.gems(), idx);
      $('.mi-chest .cap', done).innerHTML = '<b>寶石 ' + store.gems().filter(Boolean).length + '／7</b><br><span class="' + zyc.trim() + '">集滿 7 顆，領證書！</span>';
      $('.mi-praise .txt', done).textContent = '你拿到' + (opts.gem || '') + '寶石！好棒！';
      $('.mi-praise .txt', done).className = 'txt' + zyc;
      $('.mi-stars', done).innerHTML = starsHTML(stars);
      $('.mi-t-ok', done).textContent = r.hits + '／' + total;
      $('.mi-t-avg', done).textContent = (r.hits ? (ms / 1000 / r.hits).toFixed(1) : '—');
      $('.mi-t-time', done).innerHTML = (ms / 1000).toFixed(1) + ' 秒' + (saved.record ? '<span class="rec">新紀錄！</span>' : '');
      $('.mi-t-hint', done).textContent = r.hints;
      renderDex(r.items);
      $('.mi-msg', done).textContent = '';
      last = { stars: stars, rate: rate, ms: ms };
      $('.mi-title', app).textContent = opts.title + '　過關';
      show('done'); say('');
      sfx('gem');
    }
    var last = null;
    function renderDex(newItems) {
      var box = $('.mi-dex', app), d = opts.dex;
      if (!d) { box.hidden = true; return; }
      box.hidden = false;
      var got = store.dex(opts.unit), ids = Object.keys(d.items || {});
      var newest = newItems.length ? newItems[newItems.length - 1] : null;
      box.classList.toggle('empty', !newest);
      $('.hd', box).innerHTML = '<b class="' + zyc.trim() + '">' + esc(d.name || '圖鑑') + '</b><span>已收集 ' + got.length + '／' + (d.total || ids.length) + '</span>';
      if (newest && d.items[newest]) {
        $('.new', box).innerHTML = '<div class="pic"><em>新解鎖</em>' + d.items[newest].svg + '</div><div><span class="' + zyc.trim() + '">新朋友：</span><br><b class="' + zyc.trim() + '">' + esc(d.items[newest].name) + '</b></div>';
      }
      var cells = [];
      for (var i = 0; i < (d.total || ids.length); i++) {
        var id = ids[i], has = id && got.indexOf(id) >= 0;
        cells.push(has ? '<div class="slot' + (id === newest ? ' now' : '') + '" title="' + esc(d.items[id].name) + '">' + d.items[id].svg + '</div>' : '<div class="slot q">?</div>');
      }
      $('.grid', box).innerHTML = cells.join('');
      $('.tip', box).textContent = d.tip || '';
      $('.tip', box).className = 'tip' + zyc;
    }
    function submit() {
      if (!last) return;
      loadClassScores().then(function (CS) {
        CS.openSubmit({ unit: opts.unit, tier: '-', lang: 'mouse', acc: last.rate, cpm: 0, stars: last.stars, min: Math.max(1, Math.round(last.ms / 60000)) }, {});
      }, function () { $('.mi-msg', app).textContent = '交成績的元件載入失敗，請重新整理再試一次。'; });
    }
    $('.mi-s-done', app).addEventListener('click', function (e) {
      if (e.target.closest('.mi-submit')) submit();
      else if (e.target.closest('.mi-again')) begin(big ? 1 : 0);
      else if (e.target.closest('.mi-tosetup')) show('setup');
    });

    // ---------------- 場景 api
    var api = {
      field: field,                              // 場景容器 1366×581（頂欄下方），用 px 絕對定位
      cfg: function () { return cfg; },          // { stage, big, assist, size, speed }
      stage: function () { return cur; },        // 目前第幾段（0 看我示範、1 自己來、2 小挑戰）
      hit: hit,                                  // 操作對了（每個目標一次）
      miss: miss,                                // 操作錯了／沒按到（外殼會依連續失手次數給提示）
      stageDone: stageDone,                      // 這一段的目標都做完了
      say: say,                                  // 寄寄說話：say('句子')；say('')＝收起；{ zy:false }＝不用注音（3–4 年級的句子）
      glow: function (el, on) { if (el) el.classList.toggle('mi-glow', on !== false); },   // 目標發光（金色光暈＋深色外圈）
      demo: function (el, kind, o) { return demo(el, kind, o || {}); },   // 手指示範，回傳 Promise（播完 resolve）
      collect: function (id) { if (!opts.dex || !run) return false; var isNew = store.addDex(opts.unit, id); if (isNew) run.items.push(id); return isNew; },
      collected: function () { return store.dex(opts.unit); },
      sfx: sfx,                                  // 'pop'｜'ok'｜'giggle'｜'boing'｜'gem'（使用者打開音效才有聲音）
      wob: function (el) { if (!el) return; el.classList.remove('mi-wob'); void el.offsetWidth; el.classList.add('mi-wob'); },   // 晃一晃（失手搞笑反應）
      on: on,                                    // 偵測器，同 MouseIsland.on
      later: later,                              // 跟 setTimeout 一樣，但離開這段會自動清掉
      zy: !!opts.zhuyin,                         // 這關用注音：場景裡給 1–2 年級讀的字加 class="mi-zy"
      toSetup: function () { stopScene(); clearTimers(); run = null; show('setup'); }
    };

    // ---------------- 手指示範（不擋點擊）
    function demo(el, kind, o) {
      return new Promise(function (resolve) {
        if (!el) { resolve(); return; }
        var c = centerIn(el, field), hand = document.createElement('div');
        hand.className = 'mi-demo'; hand.innerHTML = CURSOR + (kind === 'right' ? '<span class="mi-rbtn">右鍵</span>' : '');
        var startAt = { x: c.x + 120, y: c.y + 90 };
        hand.style.transform = 'translate(' + startAt.x + 'px,' + startAt.y + 'px)';
        field.appendChild(hand);
        var marks = [];
        function at(p) { hand.style.transform = 'translate(' + (p.x - 4) + 'px,' + (p.y - 3) + 'px)'; }
        function ripple(p, n) {
          var r = document.createElement('div'); r.className = 'mi-rip'; r.style.left = p.x + 'px'; r.style.top = p.y + 'px'; field.appendChild(r); marks.push(r);
          if (n) { var b = document.createElement('div'); b.className = 'mi-num ' + (n === 1 ? 'a' : 'b'); b.textContent = n; b.style.left = (p.x + 70) + 'px'; b.style.top = (p.y - 40 + (n - 1) * 52) + 'px'; field.appendChild(b); marks.push(b); }
        }
        function press(on) { hand.classList.toggle('press', on); }
        function done() { later(function () { hand.remove(); marks.forEach(function (m) { m.remove(); }); resolve(); }, o.hold || 700); }
        var T = reduce ? 0 : 1;
        later(function () {
          at(c);
          later(function () {
            if (kind === 'click' || kind === 'point') { press(true); ripple(c, kind === 'click' ? 1 : 0); later(function () { press(false); done(); }, 200 * T + 50); }
            else if (kind === 'dblclick') {
              press(true); ripple(c, 1);
              later(function () { press(false); }, 110 * T + 20);
              later(function () { press(true); ripple(c, 2); }, 260 * T + 40);
              later(function () { press(false); done(); }, 380 * T + 60);
            } else if (kind === 'right') { press(true); ripple(c, 0); later(function () { press(false); done(); }, 300 * T + 50); }
            else if (kind === 'drag' && o.to) {
              var to = centerIn(o.to, field); press(true);
              var ghost = el.cloneNode(true); ghost.style.pointerEvents = 'none'; ghost.style.opacity = '.75';
              ghost.classList.remove('mi-glow');
              el.parentNode.appendChild(ghost); marks.push(ghost);
              ghost.style.transition = reduce ? 'none' : 'transform .9s cubic-bezier(.4,.1,.3,1)';
              later(function () { at(to); ghost.style.transform = 'translate(' + (to.x - c.x) + 'px,' + (to.y - c.y) + 'px)'; }, 120);
              later(function () { press(false); done(); }, 1150 * T + 150);
            } else if (kind === 'wheel') {
              var y = c.y; press(true);
              [0, 1, 2].forEach(function (k) { later(function () { y += o.up ? -26 : 26; ripple({ x: c.x, y: y }, 0); }, (k * 260) * T + 20 * k); });
              later(function () { press(false); done(); }, 900 * T + 80);
            } else if (kind === 'box' && o.from && o.to) {
              var a = o.from, b2 = o.to, box = document.createElement('div'); box.className = 'mi-boxsel'; field.appendChild(box); marks.push(box);
              at(a); press(true);
              var steps = reduce ? 1 : 12, k2 = 0;
              (function step() {
                k2++; var t = k2 / steps, p = { x: a.x + (b2.x - a.x) * t, y: a.y + (b2.y - a.y) * t };
                hand.style.transition = 'none'; at(p);
                box.style.cssText = 'left:' + Math.min(a.x, p.x) + 'px;top:' + Math.min(a.y, p.y) + 'px;width:' + Math.abs(p.x - a.x) + 'px;height:' + Math.abs(p.y - a.y) + 'px';
                if (k2 < steps) later(step, 70); else { press(false); done(); }
              })();
            } else done();
          }, 650 * T + 30);
        }, 30);
      });
    }

    // ---------------- 開機
    show('setup');
    $('.mi-sound', app).innerHTML = soundOn ? IC.on : IC.off;
    $('.mi-sound', app).setAttribute('aria-label', soundOn ? '關掉音效' : '打開音效');
    // ?debug=1：給 tools/test-mouse-scenes.py 用
    if (/[?&]debug=1\b/.test(location.search)) window.__miDebug = { api: api, begin: begin, startStage: startStage, finish: function () { if (!run) begin(2); finish(); }, unit: opts.unit, cfg: cfg, run: function () { return run; } };
    return api;
  }

  function chestSVG(gems, nowIdx) {
    // 寶箱（viewBox 220×190）：蓋子上 7 個寶石槽沿弧線排；nowIdx＝這次拿到的那顆（播落槽動畫）
    var slots = [[44, 62], [64, 42], [90, 30], [118, 30], [144, 42], [166, 62], [182, 86]];
    var s = '<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M14 108 A96 84 0 0 1 206 108 Z" fill="#B9794A" stroke="#6E4125" stroke-width="4"/>' +
      '<rect x="10" y="100" width="200" height="14" rx="4" fill="#8A5A32" stroke="#6E4125" stroke-width="3"/>' +
      '<rect x="14" y="112" width="192" height="66" rx="8" fill="#9A5F36" stroke="#6E4125" stroke-width="4"/>' +
      '<path d="M16 134 H204 M16 156 H204" stroke="#7A4A2A" stroke-width="2.5"/>' +
      '<rect x="96" y="104" width="28" height="34" rx="5" fill="#F2B134" stroke="#6E4125" stroke-width="3"/><circle cx="110" cy="117" r="4" fill="#33261B"/><path d="M110 120 V128" stroke="#33261B" stroke-width="3"/>';
    slots.forEach(function (p, i) {
      var lit = gems[i], col = LADDER[i].color;
      s += '<g transform="translate(' + p[0] + ' ' + p[1] + ')">';
      if (!lit) s += '<circle r="11" fill="#7A4A2A" stroke="#E9D9B0" stroke-width="2" stroke-dasharray="3 2"/>';
      else if (i === nowIdx) {
        s += '<circle r="11" fill="#7A4A2A"/><circle class="mi-halo" r="12"/>' +
          '<g class="mi-gemdrop">' + gemPath(col) + '</g>' +
          [[-18, -14], [18, -14], [-22, 6], [22, 6], [0, -24], [0, 20]].map(function (d) {
            return '<circle class="mi-spark" r="2.6" fill="#F2B134" style="--dx:' + d[0] + 'px;--dy:' + d[1] + 'px"/>';
          }).join('');
      } else s += gemPath(col);
      s += '</g>';
    });
    return s + '</svg>';
  }

  function skeleton(o, homeUrl, zyc) {
    var gtag = { '12': ['g12', '1–2 年級'], '14': ['g14', '1–4 年級'], '34': ['g34', '3–4 年級'] }[o.grade] || ['g14', '1–4 年級'];
    var dbl = o.skill === 'dblclick' || o.skill === 'mix';
    return '' +
    '<header class="mi-bar">' +
      '<a class="mi-home" href="' + esc(homeUrl) + '">' + IC.home + '<span class="' + zyc.trim() + '">首頁</span></a>' +
      '<div class="mi-title" aria-live="polite"></div>' +
      '<div class="mi-pills" hidden></div>' +
      '<div class="mi-calm' + zyc + '" hidden>失手沒關係' + String.fromCodePoint(0xE01E1) + '，慢慢來！</div>' +
      '<button class="mi-sound" type="button"></button>' +
    '</header>' +

    '<section class="mi-s-setup">' +
      '<div class="mi-hero" aria-hidden="true">' + (o.hero || CRAB) + '</div>' +
      '<div class="mi-info"><h1>' + esc(o.title) + '</h1>' +
        '<div class="mi-tags"><span class="mi-tag skill">練：' + esc(o.gem || '') + '</span><span class="mi-tag ' + gtag[0] + '">' + gtag[1] + '</span></div>' +
        '<p class="mi-howto' + zyc + '">' + esc(o.howto || '') + '</p>' +
        '<div class="mi-steps">' + STAGES.map(function (n, i) {
          return '<div class="mi-step"><b><i>' + (i + 1) + '</i><span class="' + zyc.trim() + '">' + n + '</span></b><p>' + STAGE_NOTE[i] + '</p></div>';
        }).join('') + '</div>' +
        '<div class="mi-go"><button class="mi-btn coral mi-start" type="button">' + IC.play + '開始</button>' +
          '<button class="mi-btn line mi-skipdemo" type="button" hidden>' + IC.skip + '我會了，跳過示範</button>' +
          '<span class="mi-best"></span></div>' +
      '</div>' +
      (dbl ? '<div class="mi-set"><span>雙擊速度（老師設定）</span><span class="mi-seg" role="group" aria-label="雙擊速度">' +
        [['slow', '慢'], ['mid', '中'], ['fast', '快']].map(function (x) { return '<button type="button" data-v="' + x[0] + '" aria-pressed="' + (store.settings().dbl === x[0]) + '">' + x[1] + '</button>'; }).join('') +
        '</span></div>' : '') +
      (o.teach ? '<div class="mi-teach"><b>給老師｜這關練什麼：</b>' + esc(o.teach) + '</div>' : '') +
    '</section>' +

    '<section class="mi-s-play" hidden><div class="mi-field"></div>' +
      '<div class="mi-buddy" aria-hidden="true">' + CRAB + '</div><div class="mi-say" role="status" hidden></div></section>' +

    '<section class="mi-s-done" hidden>' +
      '<div class="mi-chest"><svg></svg><div class="buddy" aria-hidden="true">' + CRAB + '</div><div class="cap"></div></div>' +
      '<div class="mi-praise"><span class="txt"></span><span class="mi-stars"></span></div>' +
      '<div class="mi-tiles">' +
        '<div class="mi-tile"><small>成功</small><b class="mi-t-ok"></b></div>' +
        '<div class="mi-tile"><small>平均每個（秒）</small><b class="mi-t-avg"></b></div>' +
        '<div class="mi-tile"><small>總時間｜提示 <span class="mi-t-hint"></span> 次</small><b class="mi-t-time"></b></div>' +
      '</div>' +
      '<div class="mi-dex" hidden><div class="hd"></div><div class="new"></div><div class="grid"></div><div class="tip"></div></div>' +
      '<div class="mi-msg" role="status"></div>' +
      '<div class="mi-acts">' +
        '<button class="mi-btn coral mi-submit" type="button">' + IC.send + '<span class="' + zyc.trim() + '">交成績給老師</span></button>' +
        '<button class="mi-btn palm mi-again" type="button">' + IC.again + '<span class="' + zyc.trim() + '">再玩一次</span></button>' +
        '<button class="mi-btn sea mi-tosetup" type="button">' + IC.map + '<span class="' + zyc.trim() + '">回開始</span></button>' +
        '<a class="mi-btn line" href="' + esc(homeUrl) + '">' + IC.home + '<span class="' + zyc.trim() + '">首頁</span></a>' +
      '</div>' +
    '</section>';
  }

  window.MouseIsland = { mount: mount, on: on, store: store, LADDER: LADDER, starsHTML: starsHTML, CRAB: CRAB, W: W, H: H, local: local, centerIn: centerIn };
})();
