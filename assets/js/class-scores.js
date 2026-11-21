/* ================= 全班成績 QR 收成績（共用） =================
 * 學生端：結算／獎狀頁按「交成績給老師」→ ClassScores.openSubmit(rec) 跳出視窗：座號、名字、QR、核對清單
 * 老師端：teacher/scores.html 用 parse() 解 QR、toCSV() 匯出
 * 全部在瀏覽器內完成，不經過任何伺服器。名字只存在學生那台電腦。
 *
 * QR 內容（一行文字，| 分隔）：
 *   ETS1|unit|tier|lang|seat|name|acc|cpm|stars|min|yyyymmddHHMM
 *   例：ETS1|12|t2|zh|7|小明|96|28|3|10|202611211030
 *   unit：1/3/4/11/12/13/14/16/23；tier：t1/t2/t3（unit23 填 -）；lang：zh/en
 * 純函式部分（encode／parse／toCSV）可在 Node 跑測試：tools/test-class-scores.js
 */
(function (root) {
  'use strict';

  var PREFIX = 'ETS1';
  var MAX_SEAT = 60;
  // 關卡代號 → 顯示名稱（跟 island/data.js 的短名一致）
  var UNITS = {
    1: '中文打字', 3: '太空打字', 4: '怪獸冒頭', 11: '英打特攻', 12: '中打特攻',
    13: '雷射森林', 14: '魔法字彈', 16: '恐龍打字', 23: '打字擂台'
  };
  var TIERS = { t1: '初階', t2: '進階', t3: '高階', '-': '—' };
  var LANGS = { zh: '中打', en: '英打' };

  function int(v, lo, hi) {
    var n = parseInt(v, 10);
    if (!isFinite(n) || n < lo || n > hi) return null;
    return n;
  }
  function cleanName(s) { return String(s || '').replace(/[|\r\n]/g, '').trim().slice(0, 12); }
  function stamp(d) {
    d = d || new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return '' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + p(d.getHours()) + p(d.getMinutes());
  }

  /** rec：{ unit, tier, lang, seat, name, acc, cpm, stars, min, time? } → QR 字串 */
  function encode(rec) {
    return [PREFIX, rec.unit, rec.tier || '-', rec.lang, rec.seat, cleanName(rec.name),
      Math.round(rec.acc), Math.round(rec.cpm), rec.stars, rec.min, rec.time || stamp()].join('|');
  }

  /** QR 字串 → rec；格式不對一律回 null（掃到別的 QR 不收） */
  function parse(str) {
    if (typeof str !== 'string') return null;
    var f = str.trim().split('|');
    if (f.length !== 11 || f[0] !== PREFIX) return null;
    var unit = int(f[1], 1, 99), seat = int(f[4], 1, MAX_SEAT);
    var acc = int(f[6], 0, 100), cpm = int(f[7], 0, 999), stars = int(f[8], 0, 3), min = int(f[9], 1, 120);
    if (!UNITS[unit] || !TIERS[f[2]] || !LANGS[f[3]] || seat == null || acc == null || cpm == null || stars == null || min == null) return null;
    if (!/^\d{12}$/.test(f[10])) return null;
    return { unit: unit, tier: f[2], lang: f[3], seat: seat, name: cleanName(f[5]), acc: acc, cpm: cpm, stars: stars, min: min, time: f[10] };
  }

  function unitName(u) { return UNITS[u] || ('第 ' + u + ' 關'); }
  function timeText(t) { return t ? t.slice(8, 10) + ':' + t.slice(10, 12) : ''; }
  function dateText(t) { return t ? t.slice(0, 4) + '-' + t.slice(4, 6) + '-' + t.slice(6, 8) : ''; }

  /** 老師端：把一筆新成績併進清單（同座號就更新）；回傳 'new' 或 'updated' */
  function upsert(list, rec) {
    for (var i = 0; i < list.length; i++) {
      if (list[i].seat === rec.seat) { list[i] = rec; return 'updated'; }
    }
    list.push(rec);
    list.sort(function (a, b) { return a.seat - b.seat; });
    return 'new';
  }

  /** 應到 expected 人：回傳還沒交的座號（只算 1..expected） */
  function missing(list, expected) {
    var have = {};
    list.forEach(function (r) { have[r.seat] = 1; });
    var out = [];
    for (var s = 1; s <= expected; s++) if (!have[s]) out.push(s);
    return out;
  }

  function csvCell(v) {
    v = String(v == null ? '' : v);
    // 避免 Excel 把 = + - @ 開頭當公式
    if (/^[=+\-@]/.test(v)) v = "'" + v;
    return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
  }
  /** 匯出 CSV（UTF-8 BOM、CRLF、中文表頭）；expected 有給就把沒交的座號也列出來 */
  function toCSV(list, expected, title) {
    var head = ['座號', '名字', '關卡', '階別', '打字', '正確率(%)', '每分鐘字數', '星等', '選擇分鐘', '日期', '時間', '備註'];
    var rows = list.slice().sort(function (a, b) { return a.seat - b.seat; }).map(function (r) {
      return [r.seat, r.name, unitName(r.unit), TIERS[r.tier], LANGS[r.lang], r.acc, r.cpm, r.unit === 23 ? '' : r.stars, r.min, dateText(r.time), timeText(r.time),
        expected && r.seat > expected ? '超過應到人數' : ''];
    });
    if (expected) missing(list, expected).forEach(function (s) { rows.push([s, '', '', '', '', '', '', '', '', '', '', '未交']); });
    rows.sort(function (a, b) { return a[0] - b[0]; });
    var lines = [head].concat(rows).map(function (r) { return r.map(csvCell).join(','); });
    if (title) lines.unshift(csvCell(title));
    return '﻿' + lines.join('\r\n') + '\r\n';
  }

  var api = {
    PREFIX: PREFIX, UNITS: UNITS, TIERS: TIERS, LANGS: LANGS, MAX_SEAT: MAX_SEAT,
    encode: encode, parse: parse, upsert: upsert, missing: missing, toCSV: toCSV,
    unitName: unitName, timeText: timeText, dateText: dateText, stamp: stamp
  };

  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  // ------------------------------------------------------------ 以下只在瀏覽器：學生端「交成績」視窗
  var doc = root.document;
  var BASE = (doc.currentScript && doc.currentScript.src || '').replace(/[^/]*$/, '');
  var SEAT_KEY = 'edtech-class-seat';
  var NAME_KEY = 'edtech-typing-name';   // 跟打字島獎狀共用
  function sget(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function sset(k, v) { try { root.localStorage.setItem(k, v); } catch (e) { /* 被擋就算了 */ } }
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var loading = null;
  function loadAssets() {
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      if (!doc.querySelector('link[data-cs]')) {
        var l = doc.createElement('link');
        l.rel = 'stylesheet'; l.href = BASE + '../css/class-scores.css'; l.setAttribute('data-cs', '1');
        doc.head.appendChild(l);
      }
      if (root.qrcode) return resolve();
      var s = doc.createElement('script');
      s.src = BASE + 'vendor/qrcode-generator-2.0.4.js';
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(new Error('QR 元件載入失敗')); };
      doc.head.appendChild(s);
    });
    return loading;
  }

  function qrSVG(text) {
    var qr = root.qrcode(0, 'M');
    root.qrcode.stringToBytes = root.qrcode.stringToBytesFuncs['UTF-8'];
    qr.addData(text, 'Byte');
    qr.make();
    return qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
  }

  /**
   * 跳出「交成績給老師」視窗。
   * rec：{ unit, tier, lang, acc, cpm, stars, min }（座號、名字由視窗收）
   * opts.onClose：關閉時呼叫
   */
  function openSubmit(rec, opts) {
    opts = opts || {};
    var prevFocus = doc.activeElement;
    var seat = int(sget(SEAT_KEY), 1, MAX_SEAT);
    var name = cleanName(sget(NAME_KEY)) || cleanName(rec.name);   // 沒存過名字就用遊戲裡的暱稱
    var time = stamp();

    var wrap = doc.createElement('div');
    wrap.className = 'cs-overlay';
    wrap.innerHTML =
      '<div class="cs-box" role="dialog" aria-modal="true" aria-labelledby="cs-title">' +
        '<div class="cs-head"><h2 id="cs-title">交成績給老師</h2><span>老師用手機掃 QR 就收到了，不會上傳到網路</span>' +
          '<button class="cs-x" type="button" aria-label="關閉">✕</button></div>' +
        '<div class="cs-body">' +
          '<div class="cs-col cs-seatcol">' +
            '<label class="cs-label" for="cs-seat-show">① 你的座號</label>' +
            '<output id="cs-seat-show" class="cs-seat" aria-live="polite"></output>' +
            '<div class="cs-pad">' +
              [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (n) { return '<button type="button" data-n="' + n + '">' + n + '</button>'; }).join('') +
              '<button type="button" data-n="c" class="cs-sm">清除</button><button type="button" data-n="0">0</button>' +
              '<button type="button" data-n="b" class="cs-sm" aria-label="倒退">⌫</button>' +
            '</div>' +
            '<p class="cs-hint">按數字選座號（1～' + MAX_SEAT + '），下次會自動記住</p>' +
          '</div>' +
          '<div class="cs-col cs-qrcol">' +
            '<label class="cs-label" for="cs-name">② 你的名字</label>' +
            '<input id="cs-name" class="cs-name" maxlength="12" autocomplete="off" placeholder="輸入你的名字">' +
            '<span class="cs-label">③ 給老師掃</span>' +
            '<div class="cs-qr" aria-live="polite"></div>' +
          '</div>' +
          '<div class="cs-col cs-chkcol">' +
            '<span class="cs-label">QR 裡面有這些（請核對）</span>' +
            '<dl class="cs-chk"></dl>' +
            '<p class="cs-safe">名字只存在這台電腦。QR 只給老師當面掃。</p>' +
            '<button class="cs-done" type="button">交好了</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    doc.body.appendChild(wrap);
    var $ = function (sel) { return wrap.querySelector(sel); };
    $('.cs-name').value = name;

    function row(k, v) { return '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>'; }
    function render() {
      $('.cs-seat').innerHTML = seat ? '<b class="cs-num">' + seat + '</b> 號' : '<span class="cs-empty">還沒選</span>';
      var stars = '★★★'.slice(0, rec.stars) + '<span class="cs-off">' + '★★★'.slice(rec.stars) + '</span>';
      $('.cs-chk').innerHTML =
        row('座號', seat ? '<b class="cs-num">' + seat + '</b> 號' : '—') +
        row('名字', name ? esc(name) : '—') +
        row('關卡', esc(unitName(rec.unit)) + (rec.tier && rec.tier !== '-' ? '・' + TIERS[rec.tier] : '')) +
        row('正確率', '<b class="cs-num">' + Math.round(rec.acc) + '</b> %') +
        row('每分鐘', '<b class="cs-num">' + Math.round(rec.cpm) + '</b> 字') +
        (rec.unit === 23 ? row('打字', LANGS[rec.lang]) : row('星等', '<span class="cs-stars">' + stars + '</span>'));   // 擂台沒有星等
      var box = $('.cs-qr');
      if (!seat) { box.innerHTML = '<p class="cs-wait">先選<br>座號</p>'; return; }
      if (!root.qrcode) { box.innerHTML = '<p class="cs-wait">準備中…</p>'; return; }
      var full = Object.assign({}, rec, { seat: seat, name: name, time: time });
      box.innerHTML = qrSVG(encode(full));
      box.setAttribute('data-text', encode(full));
    }

    $('.cs-pad').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var n = b.getAttribute('data-n');
      var s = seat ? String(seat) : '';
      if (n === 'c') s = '';
      else if (n === 'b') s = s.slice(0, -1);
      else s = (s + n).replace(/^0+/, '');
      var v = int(s, 1, MAX_SEAT);
      if (s && v == null) { // 超過上限：改成只留最後按的那個數字
        v = int(n, 1, MAX_SEAT);
      }
      seat = v;
      if (seat) sset(SEAT_KEY, String(seat));
      render();
    });
    $('.cs-name').addEventListener('input', function (e) {
      name = cleanName(e.target.value);
      sset(NAME_KEY, name);
      render();
    });
    function onKey(e) {
      if (e.key === 'Escape') { close(); return; }
      if (doc.activeElement === $('.cs-name')) return;
      if (/^[0-9]$/.test(e.key)) { wrap.querySelector('.cs-pad [data-n="' + e.key + '"]').click(); e.preventDefault(); }
      else if (e.key === 'Backspace') { wrap.querySelector('.cs-pad [data-n="b"]').click(); e.preventDefault(); }
    }
    function close() {
      doc.removeEventListener('keydown', onKey, true);
      wrap.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      if (opts.onClose) opts.onClose();
    }
    doc.addEventListener('keydown', onKey, true);
    $('.cs-x').addEventListener('click', close);
    $('.cs-done').addEventListener('click', close);
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(); });

    render();
    loadAssets().then(render, function () {
      $('.cs-qr').innerHTML = '<p class="cs-wait">QR 載入失敗<br>請重新整理</p>';
    });
    (seat ? $('.cs-done') : wrap.querySelector('.cs-pad button')).focus();
    return { close: close };
  }

  api.openSubmit = openSubmit;
  api.preload = loadAssets;
  root.ClassScores = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
