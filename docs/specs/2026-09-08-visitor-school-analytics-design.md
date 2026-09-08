# 訪客學校來源統計 — 設計文件

- **日期**：2026-09-08
- **狀態**：設計已核准，待實作
- **範圍**：edtech-portfolio（GitHub Pages 靜態站）+ 新增 Cloudflare Worker 收集端

## 1. 背景與目標

edtech-portfolio 已對外公開 21 個教材遊戲，但目前**零分析工具**，完全不知道有沒有其他學校在用。

**目標**：辨識出「有哪些學校／教育單位的網路曾造訪本站」，產出來源單位清單。
粒度視該單位有無自行登記網段而定（見 3.2），能到校名就到校名，否則到所屬縣市。

## 2. 非目標

明確不做，避免範圍膨脹：

- 不做完整流量分析（停留時間、跳出率、轉換漏斗）
- 不做個別使用者追蹤（不設可跨日識別的 cookie／指紋）
- 不建全國學校域名對照表（TANet whois 直接回中文單位名，不需要）
- 不改動 GitHub Pages 部署方式（站台原地不動）

## 3. 事實基礎（2026-09-08 實測）

設計建立在**實測結果**上，不是推論。未來若要改架構，先重讀這節。

### 3.1 TANet 官方 whois 是主力訊號

教育部提供公開查詢：`GET https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=<IP>`
（純 GET，無驗證碼，回傳 HTML）

回應含三層，由粗到細：

| 層級 | 內容 | 用途 |
|------|------|------|
| IP 代理發放單位網段 | 永遠是「教育部」 | 無用 |
| IP 管理單位網段 | 區網中心（成大／台大／政大區網…） | 參考 |
| **用戶單位網段** | **真實單位中文名** | **本設計取用此層** |

實測：

| 查詢位址 | 用戶單位 Chinese Name |
|---------|---------------------|
| 163.21.100.32 | 新北市私立醒吾高級中學 ✅ 到校 |
| 140.112.8.116 | 國立臺灣大學 ✅ 到校 |
| 140.127.40.154 | 國立高雄師範大學 ✅ 到校 |
| 120.116.3.214 | 臺南市政府教育局資訊中心 ⚠️ 縣市層級 |
| 163.21.241.35 | 臺北市教育網路中心 ⚠️ 縣市層級 |

### 3.2 粒度取決於該校有無自行登記網段

**有自己登記網段的學校 → whois 直接給校名；沒有的 → 落到所屬縣市網路中心。**

⚠️ **本次測試存在系統性偏差，請勿據此估算命中率**：上表中判定為「縣市層級」的樣本，
查的都是**學校網站主機 IP**，而中小學網站多半託管於縣市網機房，自然只查得到縣市網。

實際訪客來自學校的**對外出口 IP**，通常落在該校自己登記的網段（醒吾即為此例）。
真實命中率應高於上表，但**無法在開發階段估算，須上線後以實際資料校準**。

### 3.3 APNIC RDAP 不可用（已排除）

APNIC 的 RDAP 將 TANet 整段登記在教育部電算中心名下，不細分：

```
120.116.3.214 -> netname: TANET-NET, remark: Ministry of Education Computer Center
140.112.8.116 -> netname: TANET,     remark: Taiwan Academic Network
```

只能判斷「是不是學術網路」，回答不了「是哪個單位」。**改用 TANet 官方 whois 取代。**

### 3.4 PTR 反查為輔助訊號

抽測 6 個 TANet 位址，4 個有 PTR 且吐出 `.edu.tw` 域名（`www.tp.edu.tw`、`www.ntu.edu.tw`、
`www.tc.edu.tw`、`www.kh.edu.tw`），臺南市網那筆無 PTR。命中率約 2/3。

**保留為輔助**：當某校自設 PTR 時，可能給出比 whois 更細的校級域名（`xxx.tn.edu.tw`）。
兩個訊號並存，報表取較細者。

## 4. 架構

```
GitHub Pages（原地不動，每頁多一行 script）
      │  navigator.sendBeacon('https://<name>.workers.dev/c', {path})
      ▼
Cloudflare Worker（免費方案，workers.dev 子網域，不需自訂網域）
      ├─ 讀 CF-Connecting-IP、request.cf.asn、request.cf.asOrganization
      ├─ 立刻回 204，其餘工作丟 ctx.waitUntil() 背景做
      ├─ 查 org_cache（以 /24 為 key）
      │     └─ 未命中 → TANet whois 查詢 → 解析「用戶單位網段」→ 寫入快取
      ├─ DoH 反查 PTR（輔助訊號）
      └─ INSERT OR IGNORE 寫入 D1 visits
      ▼
GET /stats?token=xxx → JSON 彙總 → 報表頁讀取渲染
```

**為何選 Cloudflare Worker**：
- 免費方案就提供 `request.cf.asn` / `asOrganization`，不必付費計畫
- 用 `*.workers.dev` 子網域，不必買網域、站台不必搬家
- 部署走 `wrangler` CLI，符合「CLI 優先於 API 優先於 MCP」原則
- Zeabur 帳號停用至 2026-10 左右，該路線目前不可行

## 5. 資料模型（D1）

```sql
CREATE TABLE visits (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  day          TEXT    NOT NULL,  -- YYYY-MM-DD，台北時區
  path         TEXT    NOT NULL,  -- /units/unit2-mouse-adventure/
  source_type  TEXT    NOT NULL,  -- school | tanet_unknown | other
  org_name     TEXT,              -- 新北市私立醒吾高級中學（whois 用戶單位）
  ptr_domain   TEXT,              -- xxx.tn.edu.tw（PTR 輔助訊號，可能為 NULL）
  asn          INTEGER,
  as_org       TEXT,
  visitor_key  TEXT    NOT NULL,  -- SHA-256(ip + day + salt)，逐日輪替
  created_at   TEXT    NOT NULL
);

CREATE UNIQUE INDEX idx_visits_dedup ON visits(day, path, visitor_key);

-- whois 查詢快取，避免重複打教育部的公共服務
CREATE TABLE org_cache (
  ip24        TEXT PRIMARY KEY,  -- 163.21.100（IP 前三段）
  org_name    TEXT,              -- 用戶單位中文名，查無為 NULL
  org_name_en TEXT,
  net_block   TEXT,              -- whois 回傳的用戶單位網段
  fetched_at  TEXT NOT NULL
);
```

**去重**：同一天、同一訪客、同一頁只留一列（`INSERT OR IGNORE`）。既符合隱私原則，
也把寫入量壓在免費額度內。

**快取以 /24 為 key**：多數用戶單位網段等於或小於 /24。若實際網段較大（如 /16），
底下各 /24 會各查一次 whois，得到相同答案，屬可接受的少量重複。

## 6. Worker 判定流程

```
1. ip    = request.headers.get('CF-Connecting-IP')
   asn   = request.cf.asn
   asOrg = request.cf.asOrganization

2. ip24 = ip 前三段
   org = SELECT org_name FROM org_cache WHERE ip24 = ?
   if 未命中:
       org = TANet whois 查詢(ip)      // 見 6.1，失敗 → NULL
       INSERT INTO org_cache           // 含查無結果也寫入，避免反覆查詢

3. ptr = DoH PTR 反查(ip)               // 輔助，失敗或逾時 → NULL

4. 分類：
   if org 非空:                   source_type = 'school'
   elif asn == 1659 或 asOrg 含 'TANET':  source_type = 'tanet_unknown'
   else:                          source_type = 'other'

5. visitor_key = SHA-256(ip + day + SALT)   // SALT 存 Worker secret，不進 repo

6. INSERT OR IGNORE 寫入 visits             // 原始 IP 到此為止，不落地
```

### 6.1 whois 解析規則

請求：`GET https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=<IP>`

回應為 HTML。解析方式：剝除標籤後，取字串 `用戶單位網段` 之後的第一個 `Chinese Name`
欄位值，即為單位中文名；同時取該行的網段字串存入 `net_block`。

**注意**：回應中「IP 代理發放單位網段」與「IP 管理單位網段」也各有一個 `Chinese Name`，
必須定位到 `用戶單位網段` 之後才取值，否則會誤取到「教育部」或區網中心名稱。

### 6.2 對教育部服務的使用禮貌

whois 是教育部的公共服務，**不得每次瀏覽都查詢**：

- 一律先查 `org_cache`，同一個 /24 只查一次（查無結果也寫入快取，不重試）
- 查詢在 `ctx.waitUntil()` 背景執行，不阻塞訪客
- 設定逾時（建議 5 秒），失敗即放棄，該筆記為 `tanet_unknown`，不排隊重試
- 請求帶可辨識的 User-Agent，註明用途與聯絡信箱
- 服務不可用時**不得阻塞或重試風暴**，降級為僅記錄 ASN 層級資訊

### 6.3 PTR 輔助路徑的域名切分

當 PTR 命中且以 `.edu.tw` 結尾時，切出機構域名存入 `ptr_domain`：

- 從右取 3 段 → `tn.edu.tw` 或 `ntu.edu.tw`
- 若第 3 段是已知縣市代碼（見下表），再往左多取一段 → `dxes.tn.edu.tw`（校級）
- 否則 3 段即為機構域名 → `ntu.edu.tw`

已查證縣市代碼（僅供此切分判斷使用，非顯示用途）：

| 代碼 | 縣市 | 代碼 | 縣市 | 代碼 | 縣市 |
|------|------|------|------|------|------|
| tp | 臺北市 | ntpc | 新北市 | tyc | 桃園市 |
| kl | 基隆市 | ilc | 宜蘭縣 | hc | 新竹市 |
| hcc | 新竹縣 | mlc | 苗栗縣 | tc | 臺中市 |
| chc | 彰化縣 | ylc | 雲林縣 | cy | 嘉義市 |
| cyc | 嘉義縣 | tn | 臺南市 | kh | 高雄市 |
| ptc | 屏東縣 | ttct | 臺東縣 | phc | 澎湖縣 |

花蓮、南投、金門、連江代碼未查證。**Fail-open**：代碼查無時，直接取 3 段作為域名，
不猜測。此表僅影響 PTR 輔助訊號的切分精細度，不影響 whois 主訊號。

## 7. 前端注入

新增 `assets/js/beacon.js`（單一檔案，未來改邏輯只動一處）：

```js
navigator.sendBeacon('https://<name>.workers.dev/c',
  new Blob([JSON.stringify({ p: location.pathname })], { type: 'application/json' }));
```

23 個頁面（21 units + index + portfolio）各加一行 script 標籤。依 SDD.md 的相對路徑要求：

- 入口頁：`<script defer src="assets/js/beacon.js"></script>`
- 單元頁：`<script defer src="../../assets/js/beacon.js"></script>`

**注入方式**：依既有 SOP，用單一 Python 腳本一次做完，每步驗證錨點命中才寫入，跑完自刪。

## 8. 報表

- Worker 提供 `GET /stats?token=<secret>` 回 JSON 彙總
- 新增 `stats.html`（不從首頁連出）讀取並渲染

**預設為私有**：以 token 保護，只有自己看得到。理由：名單牽涉他校，先自用觀察一段時間，
要公開隨時可改；反向（公開後收回）代價高。

呈現內容：

1. **單位清單** — whois 用戶單位名 + PTR 域名（若有，取較細者）+ 首次造訪 + 造訪天數
2. **來源分佈** — school / tanet_unknown / other 三類佔比
3. **各單元熱度排行**
4. **命中率自我監測** — school 佔全部學術網路來源的比例，用於校準 3.2 節無法預估的實際粒度

## 9. 隱私與法遵

IP 在個資法下屬個人資料，處理原則：

- **原始 IP 不寫入資料庫**，僅用於當下反查與雜湊
- `visitor_key` 加入當日日期與 salt，**逐日輪替**，無法跨日連結同一人
- 不設追蹤 cookie、不做瀏覽器指紋
- `index.html` 與 `portfolio.html` 頁尾加一行說明：本站統計造訪來源之網路所屬機構，不蒐集個人身分資訊
- Worker secret（SALT、STATS_TOKEN）以 `wrangler secret put` 設定，不進 repo

## 10. 額度與成本

**全部在免費額度內**：

| 資源 | 免費額度 | 預估用量 |
|------|---------|---------|
| Workers 請求 | 100,000 / 日 | 遠低於 |
| D1 列寫入 | 100,000 / 日 | 去重後每訪客每頁每日 1 列 |
| D1 列讀取 | 5,000,000 / 日 | 僅報表查詢 |
| D1 儲存 | 5 GB | 每列數十位元組 |

注意：自 2026-09-01 起，超出 D1 免費額度的查詢會**直接回錯誤**，不再寬容降速。

## 11. 已知限制（誠實揭露）

1. **粒度因校而異** — 有自行登記網段的學校可到校名；沒有的只到所屬縣市網路中心。
   實際比例須上線後觀察（見 3.2），開發階段無法預估
2. **非學術來源無單位資訊** — 老師在家或用行動網路開啟，一律歸「其他」
3. **NAT 出口聚合** — 整間學校共用出口 IP，只知「這個單位有人來過」，算不出幾個人
4. **依賴外部公共服務** — TANet whois 若停用或改版，主訊號失效。解析採寬鬆比對，
   服務不可用時降級為 `tanet_unknown`，不影響站台運作
5. **廣告攔截器** — 少數使用者的擋廣告外掛可能攔下 beacon 請求

**這是有覆蓋率限制的樣本，不是普查名單。** 報表頁需明白標示此點，避免日後自己誤讀數字。

## 12. 驗收標準

- [ ] 從家用網路開啟站台 → visits 出現一列 `source_type='other'`
- [ ] 從校內網路開啟站台 → 出現 `school`（含 org_name）或 `tanet_unknown`
- [ ] whois 解析取到的是**用戶單位**，不是「教育部」或區網中心
      （以 163.21.100.32 驗證，應得「新北市私立醒吾高級中學」）
- [ ] 同一 /24 第二次造訪 → 不再打 whois，直接命中 org_cache
- [ ] whois 服務逾時 → 該筆記為 tanet_unknown，不重試、不阻塞
- [ ] 同一天重複開啟同一頁 → visits 仍只有一列
- [ ] 資料庫中**不存在**任何原始 IP 欄位
- [ ] `/stats` 不帶 token → 回 401；帶正確 token → 回 JSON
- [ ] 23 個頁面全數注入成功（逐頁驗證，不憑腳本輸出宣稱）
- [ ] 遊戲頁面功能不受影響（beacon 失敗不得阻塞頁面）

## 13. 實作前待辦

1. 校內實測自家 NAT 出口 IP 的 whois 用戶單位，確認是否到校名（校準 3.2 的未知數）
2. 註冊／登入 Cloudflare 帳號，安裝 `wrangler` CLI
