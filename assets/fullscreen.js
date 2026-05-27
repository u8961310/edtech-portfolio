/* edtech-portfolio 自動全螢幕 helper
 *
 * 學生第一次點任何按鈕（button / .big-btn / .card）時自動進入全螢幕。
 * 瀏覽器限制：requestFullscreen 必須是 user gesture 觸發，不能在 load 時自動。
 *
 * 加在 <head>：
 *   <script defer src="../../assets/fullscreen.js"></script>
 *
 * 學生可按 ESC 或 F11 退出全螢幕，瀏覽器原生顯示提示。
 */
(function () {
    'use strict';

    let triggered = false;

    function enter() {
        const el = document.documentElement;
        const req =
            el.requestFullscreen ||
            el.webkitRequestFullscreen ||
            el.mozRequestFullScreen ||
            el.msRequestFullscreen;
        if (!req) return;
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        try {
            const p = req.call(el);
            if (p && typeof p.catch === 'function') p.catch(() => {});
        } catch (e) {}
    }

    function onClick(e) {
        if (triggered) return;
        // 只在「明確的互動元素」上觸發，避免空白點擊也進全螢幕
        const t = e.target.closest('button, .big-btn, a.card, .card, [data-fullscreen]');
        if (!t) return;
        // 忽略「回首頁」等返回按鈕
        if (t.classList.contains('top-back') || t.classList.contains('nav-top')) return;
        triggered = true;
        enter();
    }

    function init() {
        document.addEventListener('click', onClick, true);
        document.addEventListener('pointerdown', onClick, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
