// 造訪來源統計：只回報頁面路徑，不蒐集任何個人資訊。
// 用 text/plain 送出，跨網域不觸發 CORS 預檢；失敗一律靜默忽略，絕不影響教材本身的運作。
(function () {
  var WORKER_URL = 'https://edtech-analytics.edtech-analytics.workers.dev/c';
  try {
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
    var payload = JSON.stringify({ p: location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(WORKER_URL, new Blob([payload], { type: 'text/plain' }));
    }
  } catch (e) {
    /* 統計失敗不影響頁面 */
  }
})();
