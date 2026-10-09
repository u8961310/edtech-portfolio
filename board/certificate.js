/* ================= 資訊大富翁：四區共用的證書系統 =================
 * 四個區域各一張「區域證書」，四區都拿到再給一張「總證書」。
 * 每區是一個獨立 HTML（index.html＝森林、ocean.html、space.html、castle.html），
 * 都引用這一份，才不會四份證書程式各改各的。
 *
 * 用法（各區在自己的 <script> 裡）：
 *   BoardCert.init({ zoneId: 'ocean', showAlert: showCustomAlert, closeAlert: closeModal });
 *   BoardCert.showZoneCertificate(BoardCert.starsFor(coins), coins);
 *
 * showAlert(title, html, buttons) 用各區自己的彈出視窗，證書問名字時借用。
 * 樣式在 certificate.css。零 build，直接 <script src> 載入。
 */
(function () {
    // 區域清單：新區做好就把 ready 改 true，「前往下一區」按鈕才會出現
    const ZONES = [
        { id: 'forest', name: '森林大冒險', seal: '🌲', url: 'index.html',  ready: true },
        { id: 'ocean',  name: '海洋大探索', seal: '🌊', url: 'ocean.html',  ready: true },
        { id: 'space',  name: '太空大挑戰', seal: '🚀', url: 'space.html',  ready: false },
        { id: 'castle', name: '城堡大決戰', seal: '🏰', url: 'castle.html', ready: false },
    ];

    const STORAGE_KEY_CERT = 'edtech-board-certs';

    // 稱號：依星等給，避免用「BOSS／闖關」這類抽象詞（SDD 圖形化優先原則）
    const RANKS = ['資訊小學徒', '資訊小高手', '資訊小達人'];

    // 星等門檻：滿分 90（4*10 + 50）。錯一題（少踩一格）仍可拿三星，
    // 四區共用同一組門檻，總證書的平均星等才有意義。
    function starsFor(coins) {
        if (coins >= 80) return 3;
        if (coins >= 60) return 2;
        return 1;
    }

    let cfg = null;
    let currentZone = null;
    let elCertLayer = null;

    /** 目前這張證書的資料，存圖時要用 */
    let certPayload = null;

    function loadCerts() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY_CERT);
            const obj = raw ? JSON.parse(raw) : null;
            if (obj && typeof obj === 'object') {
                return { name: obj.name || '', school: obj.school || '', zones: obj.zones || {} };
            }
        } catch (e) { /* 壞掉就當新的 */ }
        return { name: '', school: '', zones: {} };
    }

    function saveCerts(data) {
        try { localStorage.setItem(STORAGE_KEY_CERT, JSON.stringify(data)); } catch (e) {}
    }

    function rocDate(d) {
        return `中華民國 ${d.getFullYear() - 1911} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    }

    /** 下一個區域（不論做好沒），最後一區回傳 null */
    function nextZone() {
        const i = ZONES.indexOf(currentZone);
        return i >= 0 && i < ZONES.length - 1 ? ZONES[i + 1] : null;
    }

    /** 證書層的 HTML。放在 body 最前面（game-wrapper 之外），才不會被 #game-container 的縮放影響 */
    function injectMarkup() {
        const wrap = document.createElement('div');
        wrap.innerHTML = `
    <div id="cert-layer" role="dialog" aria-modal="true" aria-label="過關證書">
        <div class="certificate" id="cert-card">
            <div class="cert-seal" id="cert-seal"></div>
            <div class="cert-kicker" id="cert-kicker">區域通關證書</div>
            <h2 class="cert-title" id="cert-title"></h2>

            <p class="cert-line">茲證明</p>
            <p><span class="cert-name" id="cert-name">小朋友</span></p>
            <p class="cert-line" id="cert-desc"></p>

            <div class="cert-stars" id="cert-stars"></div>
            <div><span class="cert-rank" id="cert-rank"></span></div>
            <div class="cert-badges" id="cert-badges" hidden></div>

            <div class="cert-meta">
                <span>學校：<span class="cert-school" id="cert-school" contenteditable="true"
                    role="textbox" aria-label="學校名稱，可編輯"></span></span>
                <span id="cert-date">中華民國 --- 年 -- 月 -- 日</span>
            </div>

            <div class="cert-actions">
                <button class="cert-btn" id="cert-print">🖨️ 列印</button>
                <button class="cert-btn alt" id="cert-save">🖼️ 存成圖片</button>
                <a class="cert-btn next" id="cert-next" hidden></a>
                <button class="cert-btn ghost" id="cert-close">關閉</button>
            </div>
        </div>
    </div>`;
        document.body.insertBefore(wrap.firstElementChild, document.body.firstChild);
        elCertLayer = document.getElementById('cert-layer');

        document.getElementById('cert-print').onclick = () => window.print();
        document.getElementById('cert-save').onclick = exportCertificatePNG;
        document.getElementById('cert-close').onclick = () => elCertLayer.classList.remove('active');

        // 校名編輯後即時存起來，下次不用重打
        document.getElementById('cert-school').addEventListener('input', (e) => {
            const d = loadCerts();
            d.school = e.target.textContent.trim().slice(0, 20);
            saveCerts(d);
        });
    }

    /** 「前往下一區」：做好了是連結，還沒做好顯示敬請期待（不可點），最後一區與總證書不顯示 */
    function updateNextButton(isFinal) {
        const btn = document.getElementById('cert-next');
        const next = nextZone();
        if (isFinal || !next) { btn.hidden = true; return; }

        btn.hidden = false;
        if (next.ready) {
            btn.textContent = `${next.seal} 前往${next.name}`;
            btn.href = next.url;
            btn.classList.remove('disabled');
            btn.removeAttribute('aria-disabled');
            btn.removeAttribute('tabindex');
        } else {
            btn.textContent = `${next.seal} ${next.name}：敬請期待`;
            btn.removeAttribute('href');
            btn.classList.add('disabled');
            btn.setAttribute('aria-disabled', 'true');
        }
    }

    /** 拿到證書前先問名字；已填過就不再問 */
    function ensureName(cb) {
        const data = loadCerts();
        if (data.name) { cb(data.name); return; }

        cfg.showAlert('✏️ 你叫什麼名字？', '填上名字，證書就是你的囉！' +
            '<br><br><input id="cert-name-input" maxlength="10" ' +
            'style="font-family:inherit;font-size:22px;font-weight:700;text-align:center;' +
            'padding:10px 14px;border:3px solid var(--primary-dark);border-radius:12px;' +
            'width:220px;" placeholder="你的名字">', [
            { text: '好了', style: 'background: var(--primary-dark); color: white;', action: () => {
                const input = document.getElementById('cert-name-input');
                const val = (input && input.value.trim()) || '小朋友';
                const d = loadCerts();
                d.name = val;
                saveCerts(d);
                cfg.closeAlert();
                cb(val);
            }}
        ]);
        setTimeout(() => {
            const input = document.getElementById('cert-name-input');
            if (input) input.focus();
        }, 350);
    }

    function renderCertificate(opts) {
        certPayload = opts;
        const card = document.getElementById('cert-card');
        card.classList.toggle('final', !!opts.isFinal);

        document.getElementById('cert-seal').textContent = opts.seal;
        document.getElementById('cert-kicker').textContent = opts.kicker;
        document.getElementById('cert-title').textContent = opts.title;
        document.getElementById('cert-name').textContent = opts.name;
        document.getElementById('cert-desc').textContent = opts.desc;
        document.getElementById('cert-stars').textContent = '⭐'.repeat(opts.stars);
        document.getElementById('cert-rank').textContent = opts.rank;
        document.getElementById('cert-date').textContent = opts.date;

        const badges = document.getElementById('cert-badges');
        if (opts.badges) {
            badges.textContent = opts.badges;
            badges.hidden = false;
        } else {
            badges.hidden = true;
        }

        const school = document.getElementById('cert-school');
        school.textContent = loadCerts().school || '';

        updateNextButton(!!opts.isFinal);
        elCertLayer.classList.add('active');
    }

    /** 區域通關證書 */
    function showZoneCertificate(stars, coins) {
        ensureName((name) => {
            const data = loadCerts();
            const now = new Date();
            data.zones[currentZone.id] = {
                stars, coins, date: now.toISOString().slice(0, 10),
            };
            saveCerts(data);

            renderCertificate({
                seal: currentZone.seal,
                kicker: '區域通關證書',
                title: currentZone.name,
                name,
                desc: `完成${currentZone.name}的所有挑戰，收集 ${coins} 個金幣`,
                stars,
                rank: RANKS[stars - 1] || RANKS[0],
                date: rocDate(now),
            });

            // 四區都拿到就再給一張總證書
            const allDone = ZONES.every((z) => data.zones[z.id]);
            if (allDone) setTimeout(showFinalCertificate, 900);
        });
    }

    /** 四區全通關的總證書 */
    function showFinalCertificate() {
        const data = loadCerts();
        const now = new Date();
        const totalCoins = ZONES.reduce((s, z) => s + ((data.zones[z.id] || {}).coins || 0), 0);
        const totalStars = ZONES.reduce((s, z) => s + ((data.zones[z.id] || {}).stars || 0), 0);

        renderCertificate({
            isFinal: true,
            seal: '🏆',
            kicker: '全區通關總證書',
            title: '資訊大富翁',
            name: data.name || '小朋友',
            desc: `走完四個區域，總共收集 ${totalCoins} 個金幣、${totalStars} 顆星`,
            stars: Math.max(1, Math.round(totalStars / ZONES.length)),
            rank: '資訊大富翁',
            badges: ZONES.map((z) => z.seal).join(''),
            date: rocDate(now),
        });
    }

    /** 存成 PNG：用 canvas 重畫一次（不引入任何外部函式庫） */
    function exportCertificatePNG() {
        if (!certPayload) return;
        const W = 1000, H = 720;
        const cv = document.createElement('canvas');
        cv.width = W; cv.height = H;
        const g = cv.getContext('2d');
        const accent = certPayload.isFinal ? '#7c3aed' : '#b45309';

        g.fillStyle = certPayload.isFinal ? '#fdfaff' : '#fffdf6';
        g.fillRect(0, 0, W, H);
        g.strokeStyle = accent;
        g.lineWidth = 10;
        g.strokeRect(24, 24, W - 48, H - 48);
        g.lineWidth = 2;
        g.strokeRect(44, 44, W - 88, H - 88);

        g.textAlign = 'center';
        const f = (size, weight) => `${weight} ${size}px "Noto Sans TC", sans-serif`;

        g.font = f(64, 400); g.fillText(certPayload.seal, W / 2, 140);
        g.fillStyle = accent; g.font = f(22, 700);
        g.fillText(certPayload.kicker, W / 2, 190);
        g.fillStyle = '#3f2d16'; g.font = f(46, 900);
        g.fillText(certPayload.title, W / 2, 250);

        g.font = f(22, 400); g.fillText('茲證明', W / 2, 310);
        g.font = f(46, 900); g.fillText(certPayload.name, W / 2, 372);
        g.strokeStyle = accent; g.lineWidth = 3;
        const nw = Math.max(200, g.measureText(certPayload.name).width + 80);
        g.beginPath(); g.moveTo((W - nw) / 2, 386); g.lineTo((W + nw) / 2, 386); g.stroke();

        g.font = f(22, 400); g.fillText(certPayload.desc, W / 2, 436);
        g.font = f(44, 400); g.fillText('⭐'.repeat(certPayload.stars), W / 2, 500);
        if (certPayload.badges) { g.font = f(40, 400); g.fillText(certPayload.badges, W / 2, 556); }
        g.font = f(28, 900); g.fillText(certPayload.rank, W / 2, certPayload.badges ? 606 : 566);

        const school = (document.getElementById('cert-school').textContent || '').trim();
        g.font = f(20, 400); g.textAlign = 'left';
        g.fillText(school ? '學校：' + school : '', 80, H - 70);
        g.textAlign = 'right';
        g.fillText(certPayload.date, W - 80, H - 70);

        const a = document.createElement('a');
        a.download = `資訊大富翁-${certPayload.title}-${certPayload.name}.png`;
        a.href = cv.toDataURL('image/png');
        a.click();
    }

    /** 各區開場呼叫一次 */
    function init(options) {
        cfg = options;
        currentZone = ZONES.find((z) => z.id === options.zoneId);
        if (!currentZone) throw new Error('BoardCert：不認得的 zoneId ' + options.zoneId);
        injectMarkup();
    }

    window.BoardCert = { init, starsFor, showZoneCertificate, ZONES };
})();
