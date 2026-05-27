/* edtech-portfolio 注音標示工具
 *
 * 用 pinyin-pro CDN 把所有中文字自動加上注音 ruby。
 * 支援靜態 HTML + 動態插入內容（banner/certificate）via MutationObserver。
 *
 * 用法：在 <head> 內加兩個 script tag（注意路徑）
 *   <script defer src="https://cdn.jsdelivr.net/npm/pinyin-pro@3/dist/index.js"></script>
 *   <script defer src="../../assets/zhuyin.js"></script>
 *
 * 老師若要關閉注音：在 console 輸入 document.body.classList.add('no-zhuyin')
 * 或在頁面加 <body class="no-zhuyin">（rt 仍存在於 DOM，僅視覺隱藏）。
 */
(function () {
    'use strict';

    const CJK = /[一-鿿]/;
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'RUBY', 'RT', 'RP', 'TEXTAREA', 'INPUT', 'CODE', 'PRE']);

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    function getZhuyin(chineseText) {
        if (!window.pinyinPro || !chineseText) return null;
        try {
            return window.pinyinPro.pinyin(chineseText, {
                pattern: 'zhuyin',
                toneType: 'symbol',
                type: 'array',
                nonZh: 'removed',
            });
        } catch (e) {
            return null;
        }
    }

    function buildRubyHtml(text) {
        if (!text || !CJK.test(text)) return null;
        const parts = text.match(/[一-鿿]+|[^一-鿿]+/g) || [];
        let html = '';
        for (const part of parts) {
            if (CJK.test(part)) {
                const zy = getZhuyin(part);
                if (!zy) {
                    html += escapeHtml(part);
                    continue;
                }
                for (let i = 0; i < part.length; i++) {
                    html += `<ruby>${escapeHtml(part[i])}<rt>${escapeHtml(zy[i] || '')}</rt></ruby>`;
                }
            } else {
                html += escapeHtml(part);
            }
        }
        return html;
    }

    function shouldSkip(node) {
        let p = node.parentElement;
        while (p) {
            if (SKIP_TAGS.has(p.tagName)) return true;
            if (p.dataset && p.dataset.noZhuyin === 'true') return true;
            p = p.parentElement;
        }
        return false;
    }

    let observerActive = false;

    function processTextNode(node) {
        if (!node || node.nodeType !== 3) return;
        if (!node.nodeValue || !CJK.test(node.nodeValue)) return;
        if (shouldSkip(node)) return;
        const html = buildRubyHtml(node.nodeValue);
        if (!html) return;
        const span = document.createElement('span');
        span.className = 'zy-wrap';
        span.innerHTML = html;
        const parent = node.parentNode;
        if (!parent) return;
        // Disable observer during replacement to avoid re-trigger loop
        const wasActive = observerActive;
        observerActive = false;
        parent.replaceChild(span, node);
        observerActive = wasActive;
    }

    function walk(root) {
        if (!root) return;
        if (root.nodeType === 3) {
            processTextNode(root);
            return;
        }
        if (root.nodeType !== 1) return;
        if (SKIP_TAGS.has(root.tagName)) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) {
            const n = walker.currentNode;
            if (n.nodeValue && CJK.test(n.nodeValue) && !shouldSkip(n)) {
                nodes.push(n);
            }
        }
        const wasActive = observerActive;
        observerActive = false;
        nodes.forEach(processTextNode);
        observerActive = wasActive;
    }

    function injectCss() {
        if (document.getElementById('zhuyin-style')) return;
        const s = document.createElement('style');
        s.id = 'zhuyin-style';
        s.textContent = `
            ruby {
                ruby-position: over;
                ruby-align: center;
            }
            rt {
                font-size: 0.5em;
                color: inherit;
                opacity: 0.75;
                font-weight: 400;
                line-height: 1;
                letter-spacing: -0.04em;
                font-family: 'Noto Sans TC', sans-serif;
                user-select: none;
            }
            /* Slightly expand line-height of containers to accommodate ruby */
            .zy-wrap { line-height: 1.7; }
            body.no-zhuyin rt { display: none; }
            @media print {
                rt { opacity: 1; }
            }
        `;
        document.head.appendChild(s);
    }

    function setupObserver() {
        const obs = new MutationObserver((muts) => {
            if (!observerActive) return;
            const pending = [];
            for (const m of muts) {
                if (m.type !== 'childList') continue;
                for (const node of m.addedNodes) {
                    if (node.nodeType === 1 && !SKIP_TAGS.has(node.tagName)) {
                        pending.push(node);
                    } else if (node.nodeType === 3) {
                        pending.push(node);
                    }
                }
            }
            if (pending.length) {
                observerActive = false;
                pending.forEach(walk);
                observerActive = true;
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    function waitForLib(cb, tries) {
        tries = tries || 0;
        if (window.pinyinPro) { cb(); return; }
        if (tries > 60) { cb(); return; } // give up, no-op
        setTimeout(() => waitForLib(cb, tries + 1), 50);
    }

    function init() {
        injectCss();
        waitForLib(() => {
            if (!window.pinyinPro) return; // CDN failed, skip silently
            walk(document.body);
            observerActive = true;
            setupObserver();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Public API for manual calls (optional)
    window.applyZhuyin = walk;
})();
