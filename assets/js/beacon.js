// 造訪來源統計：回報頁面路徑＋一組瀏覽器內的隨機編號（只用來算不重複裝置數，不含個人資訊）。
// 用 text/plain 送出，跨網域不觸發 CORS 預檢；失敗一律靜默忽略，絕不影響教材本身的運作。
(function () {
  var WORKER_URL = 'https://edtech-analytics.edtech-analytics.workers.dev/c';
  var KEY = 'edtech_vid';

  // 隨機 UUID v4；舊瀏覽器沒有 randomUUID 時用 getRandomValues 組
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    var h = [];
    for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
    return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' +
      h.slice(8, 10).join('') + '-' + h.slice(10).join('');
  }

  // localStorage 被擋（無痕、封鎖網站資料）就回 null，照樣送路徑
  function deviceId() {
    try {
      var id = localStorage.getItem(KEY);
      if (!id) {
        id = newId();
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      return null;
    }
  }

  try {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    var data = { p: location.pathname };
    var id = deviceId();
    if (id) data.d = id;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(WORKER_URL, new Blob([JSON.stringify(data)], { type: 'text/plain' }));
    }
  } catch (e) {
    /* 統計失敗不影響頁面 */
  }
})();
