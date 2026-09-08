# 訪客學校來源統計 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 edtech-portfolio 能辨識造訪者所屬的學校／教育單位，產出來源單位清單。

**Architecture:** GitHub Pages 站台維持純靜態，每頁以 `navigator.sendBeacon` 打一個新建的 Cloudflare Worker。Worker 讀取訪客 IP，查詢 TANet 官方 whois 取得用戶單位中文名（結果以 /24 快取），輔以 PTR 反查，將結果寫入 D1。原始 IP 不落地。

**Tech Stack:** Cloudflare Workers（JavaScript，ES modules）、Cloudflare D1（SQLite）、wrangler CLI、Node 內建 `node:test`（不引入測試框架相依）

**Spec:** `docs/specs/2026-09-08-visitor-school-analytics-design.md`

## Global Constraints

- **相依最小化**：`analytics-worker/` 的 devDependency 只有 `wrangler` 一個。測試一律用 Node 內建 `node:test` + `node:assert/strict`。雜湊用平台內建 Web Crypto（`crypto.subtle`），不引入加密函式庫。
- **日期一律台北時區**：禁用 `new Date().toISOString()` 取日曆日，一律走 `taipeiDay()`（`Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei' })`）。
- **原始 IP 絕不寫入資料庫**：僅用於當下查詢與雜湊，`visits` 表無 IP 欄位。
- **對教育部服務的禮貌**：whois 查詢一律先查 `org_cache`，同一 /24 只查一次；查無結果也寫入快取，不重試；逾時 5 秒；請求帶可辨識 User-Agent。
- **秘密不進 repo**：`SALT`、`STATS_TOKEN` 一律 `wrangler secret put`。
- **GitHub Pages 相對路徑**：依 `SDD.md`，單元頁引用資源用 `../../`，入口頁用相對路徑，不得用絕對路徑 `/`。
- **繁體中文台灣用語**：所有面向使用者的文案與註解。

---

### Task 1: Worker 專案骨架與資料庫 schema

**Files:**
- Create: `analytics-worker/package.json`
- Create: `analytics-worker/wrangler.jsonc`
- Create: `analytics-worker/schema.sql`
- Create: `analytics-worker/.gitignore`

**Interfaces:**
- Consumes: 無（起始任務）
- Produces: D1 binding 名稱 `DB`；資料表 `visits`、`org_cache`（欄位見 schema.sql）；Worker 名稱 `edtech-analytics`

- [ ] **Step 1: 建立 package.json**

```json
{
  "name": "edtech-analytics",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/",
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

- [ ] **Step 2: 建立 .gitignore**

```
node_modules/
.wrangler/
.dev.vars
```

- [ ] **Step 3: 建立 schema.sql**

```sql
CREATE TABLE IF NOT EXISTS visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  day          TEXT    NOT NULL,
  path         TEXT    NOT NULL,
  source_type  TEXT    NOT NULL,
  org_name     TEXT,
  ptr_domain   TEXT,
  asn          INTEGER,
  as_org       TEXT,
  visitor_key  TEXT    NOT NULL,
  created_at   TEXT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_dedup
  ON visits(day, path, visitor_key);

CREATE TABLE IF NOT EXISTS org_cache (
  ip24        TEXT PRIMARY KEY,
  org_name    TEXT,
  org_name_en TEXT,
  net_block   TEXT,
  fetched_at  TEXT NOT NULL
);
```

- [ ] **Step 4: 安裝相依並建立 D1 資料庫**

```bash
cd analytics-worker
npm install
npx wrangler d1 create edtech-analytics
```

記下輸出的 `database_id`，下一步要填入設定檔。

- [ ] **Step 5: 建立 wrangler.jsonc**

把上一步取得的 id 填入 `database_id`：

```jsonc
{
  "name": "edtech-analytics",
  "main": "src/index.js",
  "compatibility_date": "2026-09-08",
  "observability": { "enabled": true },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "edtech-analytics",
      "database_id": "貼上上一步輸出的 id"
    }
  ]
}
```

- [ ] **Step 6: 套用 schema 到本機資料庫並驗證**

```bash
npx wrangler d1 execute edtech-analytics --local --file=./schema.sql
npx wrangler d1 execute edtech-analytics --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Expected: 輸出包含 `visits` 與 `org_cache` 兩張表。

- [ ] **Step 7: Commit**

```bash
git add analytics-worker/package.json analytics-worker/wrangler.jsonc analytics-worker/schema.sql analytics-worker/.gitignore
git commit -m "feat(analytics): Worker 專案骨架與 D1 schema"
```

---

### Task 2: 純函式解析模組

把所有不需要網路的判斷邏輯集中在此，可用 Node 內建 test runner 完整測試。

**Files:**
- Create: `analytics-worker/src/parse.js`
- Create: `analytics-worker/test/parse.test.js`
- Create: `analytics-worker/test/fixtures/whois-hsingwu.html`
- Create: `analytics-worker/test/fixtures/whois-nontanet.html`

**Interfaces:**
- Consumes: 無
- Produces:
  - `parseWhoisUserOrg(html) -> {orgName: string, orgNameEn: string|null, netBlock: string|null} | null`
  - `eduDomainFromPtr(ptr: string|null) -> string|null`
  - `classify({orgName, asn, asOrg}) -> 'school' | 'tanet_unknown' | 'other'`
  - `ip24(ip: string) -> string|null`
  - `taipeiDay(date?: Date) -> string`（`YYYY-MM-DD`）

- [ ] **Step 1: 抓取兩份真實 whois 回應當測試 fixture**

```bash
cd analytics-worker
mkdir -p test/fixtures
curl -s "https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=163.21.100.32" -o test/fixtures/whois-hsingwu.html
curl -s "https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=8.8.8.8" -o test/fixtures/whois-nontanet.html
grep -c "用戶單位網段" test/fixtures/whois-hsingwu.html
grep -c "用戶單位網段" test/fixtures/whois-nontanet.html
```

Expected: 第一個檔案回 `1`，第二個回 `0`。若不符，代表服務回應已改版，先停下來確認格式再繼續。

- [ ] **Step 2: 寫失敗的測試**

建立 `test/parse.test.js`：

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWhoisUserOrg, eduDomainFromPtr, classify, ip24, taipeiDay } from '../src/parse.js';

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('parseWhoisUserOrg 取用戶單位，不是代理發放單位或區網中心', () => {
  const r = parseWhoisUserOrg(fixture('whois-hsingwu.html'));
  assert.equal(r.orgName, '新北市私立醒吾高級中學');
  assert.notEqual(r.orgName, '教育部');
  assert.notEqual(r.orgName, '政大區網中心');
  assert.equal(r.netBlock, '163.21.100.0/24');
});

test('parseWhoisUserOrg 對非 TANet 位址回 null', () => {
  assert.equal(parseWhoisUserOrg(fixture('whois-nontanet.html')), null);
});

test('parseWhoisUserOrg 對空輸入回 null', () => {
  assert.equal(parseWhoisUserOrg(''), null);
  assert.equal(parseWhoisUserOrg(null), null);
});

test('eduDomainFromPtr 大專取三段', () => {
  assert.equal(eduDomainFromPtr('www.ntu.edu.tw.'), 'ntu.edu.tw');
});

test('eduDomainFromPtr 縣市網本身取三段，不把主機名當成學校', () => {
  assert.equal(eduDomainFromPtr('www.tp.edu.tw.'), 'tp.edu.tw');
});

test('eduDomainFromPtr 縣市網底下的學校取四段', () => {
  assert.equal(eduDomainFromPtr('www.dxes.tn.edu.tw.'), 'dxes.tn.edu.tw');
  assert.equal(eduDomainFromPtr('host-1.dxes.tn.edu.tw'), 'dxes.tn.edu.tw');
});

test('eduDomainFromPtr 非 edu.tw 回 null', () => {
  assert.equal(eduDomainFromPtr('218-35-132-72.cm.dynamic.apol.com.tw.'), null);
  assert.equal(eduDomainFromPtr(null), null);
});

test('classify 有單位名就是 school', () => {
  assert.equal(classify({ orgName: '國立臺灣大學', asn: 1659, asOrg: 'TANET' }), 'school');
});

test('classify 無單位名但屬 TANet 為 tanet_unknown', () => {
  assert.equal(classify({ orgName: null, asn: 1659, asOrg: 'TANET-TW' }), 'tanet_unknown');
  assert.equal(classify({ orgName: null, asn: 9999, asOrg: 'Taiwan Academic Network TANet' }), 'tanet_unknown');
});

test('classify 其他來源為 other', () => {
  assert.equal(classify({ orgName: null, asn: 3462, asOrg: 'Chunghwa Telecom' }), 'other');
});

test('ip24 取前三段', () => {
  assert.equal(ip24('163.21.100.32'), '163.21.100');
  assert.equal(ip24('2001:db8::1'), null);
  assert.equal(ip24(null), null);
});

test('taipeiDay 回台北時區日曆日', () => {
  // 2026-09-08T16:30:00Z = 台北時間 2026-09-09 00:30
  assert.equal(taipeiDay(new Date('2026-09-08T16:30:00Z')), '2026-09-09');
});
```

- [ ] **Step 3: 執行測試確認失敗**

Run: `cd analytics-worker && npm test`
Expected: FAIL，錯誤訊息為找不到模組 `../src/parse.js`

- [ ] **Step 4: 實作 parse.js**

```javascript
// 台灣各縣市教育網路中心的網域代碼。僅用於 PTR 域名切分判斷，非顯示用途。
// 花蓮、南投、金門、連江未查證；查無時退回三段切法，不猜測。
const COUNTY_CODES = new Set([
  'tp', 'ntpc', 'tyc', 'kl', 'ilc', 'hc', 'hcc', 'mlc', 'tc',
  'chc', 'ylc', 'cy', 'cyc', 'tn', 'kh', 'ptc', 'ttct', 'phc',
]);

// 常見主機名前綴，避免把 www.tp.edu.tw 誤切成「www 這間學校」
const HOST_PREFIXES = new Set([
  'www', 'mail', 'host', 'ns', 'ns1', 'ns2', 'gw', 'nat',
  'proxy', 'fw', 'dns', 'smtp', 'web',
]);

/**
 * 解析 TANet whois 回應，取出「用戶單位」層的資訊。
 *
 * 回應含三層：IP 代理發放單位網段（永遠是教育部）、IP 管理單位網段（區網中心）、
 * 用戶單位網段（真實單位）。三層各有一個 Chinese Name 欄位，必須定位到
 * 「用戶單位網段」之後才取值，否則會誤取到「教育部」或區網中心名稱。
 *
 * 非 TANet 配發的位址，回應不含「用戶單位網段」區塊，回 null。
 */
export function parseWhoisUserOrg(html) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, '|')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  const idx = text.indexOf('用戶單位網段');
  if (idx === -1) return null;
  const tail = text.slice(idx);

  const orgName = firstField(tail, 'Chinese Name');
  if (!orgName) return null;

  const blockMatch = tail.match(/用戶單位網段[：:]\s*([\d.]+\/\d+)/);
  return {
    orgName,
    orgNameEn: firstField(tail, 'Organization Name'),
    netBlock: blockMatch ? blockMatch[1] : null,
  };
}

function firstField(text, label) {
  const m = text.match(new RegExp(label + '\\s*\\|+\\s*([^|]+)'));
  if (!m) return null;
  return m[1].trim() || null;
}

/**
 * 從 PTR 主機名切出教育機構域名。輔助訊號，用於補足 whois 只到縣市層級的情況。
 */
export function eduDomainFromPtr(ptr) {
  if (!ptr) return null;
  const host = ptr.replace(/\.$/, '').toLowerCase();
  if (!host.endsWith('.edu.tw')) return null;

  const parts = host.split('.');
  if (parts.length < 3) return null;

  // 預設取三段（ntu.edu.tw / tn.edu.tw）
  let take = 3;
  // 若倒數第三段是縣市代碼，代表這是縣市網底下的學校，多取一段
  if (parts.length >= 4 && COUNTY_CODES.has(parts[parts.length - 3])) {
    const candidate = parts[parts.length - 4];
    // 但那一段若是主機名前綴，代表這其實是縣市網自己的主機，退回三段
    if (!HOST_PREFIXES.has(candidate)) take = 4;
  }
  return parts.slice(-take).join('.');
}

export function classify({ orgName, asn, asOrg }) {
  if (orgName) return 'school';
  const org = (asOrg || '').toUpperCase();
  if (asn === 1659 || org.includes('TANET') || org.includes('TAIWAN ACADEMIC')) {
    return 'tanet_unknown';
  }
  return 'other';
}

export function ip24(ip) {
  if (!ip) return null;
  const m = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  return m ? m[1] : null;
}

/** 台北時區的日曆日（YYYY-MM-DD）。禁用 toISOString().slice(0,10)，那會落到前一天。 */
export function taipeiDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
```

- [ ] **Step 5: 執行測試確認全數通過**

Run: `cd analytics-worker && npm test`
Expected: PASS，12 個測試全綠

- [ ] **Step 6: Commit**

```bash
git add analytics-worker/src/parse.js analytics-worker/test/
git commit -m "feat(analytics): whois 解析、PTR 域名切分與來源分類純函式"
```

---

### Task 3: 外部查詢模組

**Files:**
- Create: `analytics-worker/src/lookup.js`

**Interfaces:**
- Consumes: `parseWhoisUserOrg` from `src/parse.js`
- Produces:
  - `fetchWhoisOrg(ip: string) -> Promise<{orgName, orgNameEn, netBlock} | null>`
  - `fetchPtr(ip: string) -> Promise<string|null>`

- [ ] **Step 1: 實作 lookup.js**

此模組全是網路 I/O，不寫單元測試（會打到外部服務），行為在 Task 7 的端對端驗證確認。

```javascript
import { parseWhoisUserOrg } from './parse.js';

const TIMEOUT_MS = 5000;
const UA = 'edtech-portfolio-analytics/1.0 (教學作品集造訪單位統計; u8961310@gmail.com)';

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查詢 TANet 官方 whois。這是教育部的公共服務，呼叫端必須先查快取，
 * 確保同一網段只查一次。失敗一律回 null，不重試。
 */
export async function fetchWhoisOrg(ip) {
  try {
    const url = `https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=${encodeURIComponent(ip)}`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    return parseWhoisUserOrg(await res.text());
  } catch {
    return null;
  }
}

/** DoH 反查 PTR。輔助訊號，失敗回 null。 */
export async function fetchPtr(ip) {
  const parts = (ip || '').split('.');
  if (parts.length !== 4) return null;
  const name = `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
  try {
    const res = await fetchWithTimeout(
      `https://cloudflare-dns.com/dns-query?name=${name}&type=PTR`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const answer = (data.Answer || []).find((a) => a.type === 12);
    return answer ? answer.data : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 確認語法無誤**

Run: `cd analytics-worker && node --check src/lookup.js && node --check src/parse.js`
Expected: 無輸出（通過）

- [ ] **Step 3: 實際打一次外部服務，驗證成功與失敗兩條路徑**

Node 18+ 內建 fetch，可直接執行此模組：

```bash
cd analytics-worker
node -e "
import('./src/lookup.js').then(async (m) => {
  console.log('醒吾    :', await m.fetchWhoisOrg('163.21.100.32'));
  console.log('非TANet :', await m.fetchWhoisOrg('8.8.8.8'));
  console.log('無效IP  :', await m.fetchWhoisOrg('999.999.999.999'));
  console.log('PTR     :', await m.fetchPtr('140.112.8.116'));
});
"
```

Expected:
- 醒吾 → 物件，`orgName` 為 `新北市私立醒吾高級中學`
- 非 TANet → `null`
- 無效 IP → `null`
- PTR → `www.ntu.edu.tw.`

失敗路徑（逾時、連線錯誤、非 200）與此處的 `null` 走同一個 `catch`，由本步一併涵蓋。

- [ ] **Step 4: Commit**

```bash
git add analytics-worker/src/lookup.js
git commit -m "feat(analytics): TANet whois 與 DoH PTR 查詢模組"
```

---

### Task 4: Worker 收集端點 `/c`

**Files:**
- Create: `analytics-worker/src/index.js`

**Interfaces:**
- Consumes: `parse.js` 全部匯出、`lookup.js` 的 `fetchWhoisOrg` / `fetchPtr`
- Produces: `POST /c` 端點，接受 `{"p": "/units/xxx/"}`，回 204

- [ ] **Step 1: 實作 index.js 的 /c 路由**

```javascript
import { classify, eduDomainFromPtr, ip24, taipeiDay } from './parse.js';
import { fetchWhoisOrg, fetchPtr } from './lookup.js';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === '/c' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const path = typeof body.p === 'string' ? body.p.slice(0, 200) : '/';
      // 先回應，統計在背景做，絕不讓訪客等外部查詢
      ctx.waitUntil(record(request, env, path));
      return new Response(null, { status: 204, headers: CORS });
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function record(request, env, path) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return;

  const cf = request.cf || {};
  const asn = typeof cf.asn === 'number' ? cf.asn : null;
  const asOrg = cf.asOrganization || null;

  const org = await lookupOrgCached(env, ip);
  const ptrDomain = eduDomainFromPtr(await fetchPtr(ip));
  const day = taipeiDay();
  const sourceType = classify({ orgName: org && org.orgName, asn, asOrg });
  const visitorKey = await sha256(`${ip}|${day}|${env.SALT}`);

  await env.DB.prepare(
    `INSERT OR IGNORE INTO visits
       (day, path, source_type, org_name, ptr_domain, asn, as_org, visitor_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    day, path, sourceType,
    org ? org.orgName : null,
    ptrDomain, asn, asOrg, visitorKey,
    new Date().toISOString(),
  ).run();
}

/**
 * 以 /24 為單位快取 whois 結果。查無結果也寫入快取（org_name 為 NULL），
 * 避免對教育部的服務反覆查詢同一個網段。
 */
async function lookupOrgCached(env, ip) {
  const key = ip24(ip);
  if (!key) return null;

  const cached = await env.DB.prepare(
    'SELECT org_name, org_name_en, net_block FROM org_cache WHERE ip24 = ?',
  ).bind(key).first();

  if (cached) {
    return cached.org_name
      ? { orgName: cached.org_name, orgNameEn: cached.org_name_en, netBlock: cached.net_block }
      : null;
  }

  const org = await fetchWhoisOrg(ip);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO org_cache (ip24, org_name, org_name_en, net_block, fetched_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    key,
    org ? org.orgName : null,
    org ? org.orgNameEn : null,
    org ? org.netBlock : null,
    new Date().toISOString(),
  ).run();

  return org;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
```

- [ ] **Step 2: 設定本機開發用的 SALT**

建立 `analytics-worker/.dev.vars`（已在 .gitignore，不會進 repo）：

```
SALT=local-dev-salt-not-for-production
STATS_TOKEN=local-dev-token
```

- [ ] **Step 3: 本機啟動 Worker 並打端點**

```bash
cd analytics-worker
npx wrangler dev
```

另開一個終端機：

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://127.0.0.1:8787/c \
  -H "Content-Type: application/json" -d '{"p":"/units/unit2-mouse-adventure/"}'
```

Expected: `204`

- [ ] **Step 4: 確認資料真的寫進去**

```bash
npx wrangler d1 execute edtech-analytics --local \
  --command="SELECT day, path, source_type, org_name FROM visits"
```

Expected: 一列資料，`path` 為 `/units/unit2-mouse-adventure/`。
本機 `wrangler dev` 沒有真實 `CF-Connecting-IP`，若無資料屬預期，改在 Task 7 部署後驗證。

- [ ] **Step 5: 確認 visits 表沒有任何 IP 欄位**

```bash
npx wrangler d1 execute edtech-analytics --local --command="PRAGMA table_info(visits)"
```

Expected: 欄位清單中不存在任何 IP 相關欄位。

- [ ] **Step 6: Commit**

```bash
git add analytics-worker/src/index.js
git commit -m "feat(analytics): /c 收集端點與 whois 網段快取"
```

---

### Task 5: 報表端點 `/stats`

**Files:**
- Modify: `analytics-worker/src/index.js`（在 `/c` 路由後方新增 `/stats` 路由）

**Interfaces:**
- Consumes: Task 4 的 `env.DB`、`env.STATS_TOKEN`
- Produces: `GET /stats?token=<secret>` 回 JSON，結構如下

```json
{
  "orgs": [{ "org_name": "...", "ptr_domain": "...", "days": 3, "first_seen": "2026-09-08" }],
  "sources": [{ "source_type": "school", "n": 12 }],
  "paths": [{ "path": "/units/...", "n": 5 }],
  "hit_rate": { "school": 12, "tanet_unknown": 4, "rate": 0.75 }
}
```

- [ ] **Step 1: 在 index.js 的 `/c` 路由之後、404 之前插入 /stats 路由**

```javascript
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (url.searchParams.get('token') !== env.STATS_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      return Response.json(await stats(env));
    }
```

- [ ] **Step 2: 在檔案末端新增 stats 函式**

```javascript
async function stats(env) {
  const orgs = await env.DB.prepare(
    `SELECT COALESCE(org_name, ptr_domain) AS org_name,
            ptr_domain,
            COUNT(DISTINCT day) AS days,
            MIN(day) AS first_seen
       FROM visits
      WHERE source_type = 'school'
      GROUP BY COALESCE(org_name, ptr_domain)
      ORDER BY days DESC`,
  ).all();

  const sources = await env.DB.prepare(
    `SELECT source_type, COUNT(*) AS n FROM visits GROUP BY source_type`,
  ).all();

  const paths = await env.DB.prepare(
    `SELECT path, COUNT(*) AS n FROM visits GROUP BY path ORDER BY n DESC LIMIT 30`,
  ).all();

  const counts = Object.fromEntries(sources.results.map((r) => [r.source_type, r.n]));
  const school = counts.school || 0;
  const unknown = counts.tanet_unknown || 0;
  const academic = school + unknown;

  return {
    orgs: orgs.results,
    sources: sources.results,
    paths: paths.results,
    // 命中率自我監測：學術網路來源中，能辨識到單位名的比例
    hit_rate: { school, tanet_unknown: unknown, rate: academic ? school / academic : null },
  };
}
```

- [ ] **Step 3: 驗證未帶 token 被擋**

`wrangler dev` 執行中，另開終端機：

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8787/stats"
```

Expected: `401`

- [ ] **Step 4: 驗證帶正確 token 回 JSON**

```bash
curl -s "http://127.0.0.1:8787/stats?token=local-dev-token"
```

Expected: 回傳含 `orgs`、`sources`、`paths`、`hit_rate` 四個鍵的 JSON

- [ ] **Step 5: Commit**

```bash
git add analytics-worker/src/index.js
git commit -m "feat(analytics): /stats 報表端點與命中率監測"
```

---

### Task 6: 前端 beacon 與全站注入

**Files:**
- Create: `assets/js/beacon.js`
- Modify: `index.html`、`portfolio.html`、`units/*/index.html`（共 23 個檔案）
- Create: `scripts/inject-beacon.py`（一次性腳本，跑完自刪）

**Interfaces:**
- Consumes: Task 7 部署後取得的 Worker 網址
- Produces: 每頁在 `</body>` 前多一個 script 標籤

- [ ] **Step 1: 建立 assets/js/beacon.js**

`WORKER_URL` 先留本機位址，Task 7 部署後改為正式網址。

```javascript
// 造訪來源統計：只回報頁面路徑，不蒐集任何個人資訊。
// 失敗一律靜默忽略，絕不影響教材本身的運作。
(function () {
  var WORKER_URL = 'http://127.0.0.1:8787/c';
  try {
    var payload = JSON.stringify({ p: location.pathname });
    if (navigator.sendBeacon) {
      navigator.sendBeacon(WORKER_URL, new Blob([payload], { type: 'application/json' }));
    }
  } catch (e) {
    /* 統計失敗不影響頁面 */
  }
})();
```

- [ ] **Step 2: 寫注入腳本**

建立 `scripts/inject-beacon.py`。每個檔案都先確認錨點命中才寫入，命中數不等於 1 就中止，避免部分套用。

```python
# -*- coding: utf-8 -*-
"""一次性腳本：為全站 HTML 注入 beacon script 標籤。跑完請自行刪除。"""
import io, glob, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
targets = [('index.html', 'assets/js/beacon.js'),
           ('portfolio.html', 'assets/js/beacon.js')]
for p in sorted(glob.glob(os.path.join(ROOT, 'units', '*', 'index.html'))):
    targets.append((os.path.relpath(p, ROOT).replace('\\', '/'), '../../assets/js/beacon.js'))

print('目標檔案數：%d' % len(targets))
plan = []
for rel, src in targets:
    full = os.path.join(ROOT, rel)
    html = io.open(full, encoding='utf-8').read()
    if 'assets/js/beacon.js' in html:
        print('  跳過（已注入）：%s' % rel)
        continue
    n = html.count('</body>')
    if n != 1:
        sys.exit('中止：%s 的 </body> 命中數為 %d，預期 1' % (rel, n))
    tag = '<script defer src="%s"></script>\n</body>' % src
    plan.append((full, rel, html.replace('</body>', tag)))

print('待寫入：%d 個檔案' % len(plan))
for full, rel, out in plan:
    io.open(full, 'w', encoding='utf-8', newline='\n').write(out)
    print('  已注入：%s' % rel)

# 自我驗證：逐檔讀回確認
bad = [rel for full, rel, _ in plan
       if 'assets/js/beacon.js' not in io.open(full, encoding='utf-8').read()]
if bad:
    sys.exit('驗證失敗：%s' % bad)
print('全部驗證通過')
```

- [ ] **Step 3: 執行注入腳本**

```bash
cd /d/code/repos/edtech-portfolio
python scripts/inject-beacon.py
```

Expected: 目標檔案數 23、全部驗證通過

- [ ] **Step 4: 獨立複查注入結果**

不憑腳本輸出下結論，用另一個方法對帳：

```bash
grep -rl "assets/js/beacon.js" --include=index.html --include=portfolio.html . | wc -l
```

Expected: `23`

- [ ] **Step 5: 本機起站台，確認遊戲頁面沒被影響**

```bash
python -m http.server 8899 --bind 127.0.0.1
```

瀏覽器開 `http://127.0.0.1:8899/`，隨機點三個單元進去玩，確認：
- 遊戲可正常開始、計分正常
- Console 沒有紅色錯誤（beacon 連線失敗的警告可忽略，那是預期的）

- [ ] **Step 6: 刪除一次性腳本並 commit**

```bash
python -c "import os; os.remove('scripts/inject-beacon.py')"
git add assets/js/beacon.js index.html portfolio.html units/
git commit -m "feat(analytics): 全站注入造訪統計 beacon"
```

---

### Task 7: 部署與端對端驗證

**Files:**
- Modify: `assets/js/beacon.js`（換成正式 Worker 網址）
- Modify: `index.html`、`portfolio.html`（頁尾加隱私說明）

**Interfaces:**
- Consumes: Task 1-6 全部
- Produces: 上線的 Worker 與可查詢的報表

- [ ] **Step 1: 設定正式環境 secret**

```bash
cd analytics-worker
npx wrangler secret put SALT
npx wrangler secret put STATS_TOKEN
```

各自貼上一組隨機字串。**不要把值貼進對話或任何檔案。**

- [ ] **Step 2: 套用 schema 到正式資料庫**

```bash
npx wrangler d1 execute edtech-analytics --remote --file=./schema.sql
npx wrangler d1 execute edtech-analytics --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

Expected: 輸出含 `visits` 與 `org_cache`

- [ ] **Step 3: 部署 Worker**

```bash
npx wrangler deploy
```

記下輸出的 `https://edtech-analytics.<你的子網域>.workers.dev` 網址。

- [ ] **Step 4: 直接打正式端點，確認能寫入真實 IP 的判斷結果**

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://edtech-analytics.<子網域>.workers.dev/c \
  -H "Content-Type: application/json" -d '{"p":"/e2e-test/"}'
```

Expected: `204`

- [ ] **Step 5: 等 5 秒後查資料，確認背景查詢有跑完**

```bash
sleep 5
npx wrangler d1 execute edtech-analytics --remote \
  --command="SELECT day, path, source_type, org_name, ptr_domain, as_org FROM visits WHERE path='/e2e-test/'"
```

Expected: 一列資料。從家用網路打的話 `source_type` 應為 `other`。

**這一步同時驗證了 spec 3.2 節那個未知數**：若你在校內執行，`org_name` 會顯示你們學校或所屬縣市網路中心 —— 這就是真實粒度的答案。

- [ ] **Step 6: 確認快取生效**

再打一次同樣的請求，然後檢查 `org_cache`：

```bash
npx wrangler d1 execute edtech-analytics --remote --command="SELECT ip24, org_name, net_block FROM org_cache"
```

Expected: 只有一列（同一個 /24 沒有重複查詢 whois）

- [ ] **Step 7: 把 beacon.js 換成正式網址**

編輯 `assets/js/beacon.js`，將 `WORKER_URL` 改為 Step 3 取得的正式網址。

- [ ] **Step 8: 加上隱私說明**

在 `index.html` 與 `portfolio.html` 的頁尾區塊加入一行：

```html
<p style="font-size:.75rem;opacity:.6;margin-top:.5rem;">
  本站統計造訪來源之網路所屬機構，不蒐集個人身分資訊。
</p>
```

- [ ] **Step 9: 推上 GitHub Pages**

```bash
git add assets/js/beacon.js index.html portfolio.html
git commit -m "feat(analytics): 指向正式 Worker 並加註隱私說明"
git push
```

- [ ] **Step 10: 等待 GitHub Pages 發佈完成後做真實驗證**

等 1-2 分鐘讓 Pages 重新發佈（**不要在舊版上測就宣告成功**）。用瀏覽器開 `https://u8961310.github.io/edtech-portfolio/`，進一個單元頁，然後：

```bash
npx wrangler d1 execute edtech-analytics --remote \
  --command="SELECT day, path, source_type, org_name FROM visits ORDER BY id DESC LIMIT 5"
```

Expected: 出現剛才瀏覽的真實頁面路徑

- [ ] **Step 11: 驗證去重**

在同一天重新整理同一頁三次，再查一次：

```bash
npx wrangler d1 execute edtech-analytics --remote \
  --command="SELECT path, COUNT(*) n FROM visits GROUP BY path ORDER BY n DESC LIMIT 5"
```

Expected: 該頁面的 `n` 仍為 `1`

- [ ] **Step 12: 驗證報表端點**

```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://edtech-analytics.<子網域>.workers.dev/stats"
curl -s "https://edtech-analytics.<子網域>.workers.dev/stats?token=<你的 token>"
```

Expected: 第一個回 `401`，第二個回完整 JSON

---

## 收尾

全部完成後，依全域規則走尾部三步：部署 prod → 端對端驗證 → 記憶沉澱（`/shutdown`）。

報表頁（`stats.html`）刻意不在本計畫內：先讓資料累積一兩週，看清楚真實的命中率與資料分佈，再決定報表要長什麼樣。此時直接讀 `/stats` 的 JSON 就夠用。
