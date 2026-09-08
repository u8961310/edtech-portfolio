# 訪客學校來源統計 — 設計文件

- **日期**：2026-09-08
- **狀態**：設計已核准，待實作
- **範圍**：edtech-portfolio（GitHub Pages 靜態站）+ 新增 Cloudflare Worker 收集端

## 1. 背景與目標

edtech-portfolio 已對外公開 21 個教材遊戲，但目前**零分析工具**，完全不知道有沒有其他學校在用。

**目標**：辨識出「有哪些學校的網路曾造訪本站」，產出校名清單。

## 2. 非目標

明確不做，避免範圍膨脹：

- 不做完整流量分析（停留時間、跳出率、轉換漏斗）
- 不做個別使用者追蹤（不設可跨日識別的 cookie／指紋）
- 不建全國學校域名對照表（等實際有資料進來再逐筆補）
- 不改動 GitHub Pages 部署方式（站台原地不動）

## 3. 事實基礎（2026-09-08 實測）

設計建立在以下**實測結果**上，不是推論。未來若要改架構，先重讀這節。

### 3.1 PTR 反查是唯一能到校名的路

抽測 6 個 TANet 位址，4 個有 PTR 且直接吐出 `.edu.tw` 域名：

| 測試位址 | PTR 結果 |
|---------|---------|
| 163.21.249.220 | `www.tp.edu.tw` ✅ |
| 140.112.8.116 | `www.ntu.edu.tw` ✅ |
| 140.128.53.66 | `www.tc.edu.tw` ✅ |
| 163.31.250.11 | `www.kh.edu.tw` ✅ |
| 120.116.3.214（臺南市網） | 無 PTR ❌ |
| 61.60.98.242 | 非教育網域 ❌ |

**命中率約 2/3。**

### 3.2 RDAP／ASN 推不出校名

TANet 位址整段登記在**教育部電算中心**名下，不細分到各校：

```
120.116.3.214 -> netname: TANET-NET, remark: Ministry of Education Computer Center
140.112.8.116 -> netname: TANET,     remark: Taiwan Academic Network
163.31.250.11 -> netname: TANET-B,   remark: imported inetnum object for MOEC
```

**結論**：ASN／RDAP 只能回答「是不是學術網路」（這點幾乎 100% 準），回答不了「是哪一間學校」。

### 3.3 尚未驗證的變數

上述測的是**學校伺服器 IP**。實際訪客來的是**學校 NAT 出口 IP**，其 PTR 設定率可能更低。
**待辦**：實作前在校內辦公室實測一次自家出口 IP 的 PTR，校準預期。

## 4. 架構

```
GitHub Pages（原地不動，每頁多一行 script）
      │  navigator.sendBeacon('https://<name>.workers.dev/c', {path})
      ▼
Cloudflare Worker（免費方案，workers.dev 子網域，不需自訂網域）
      ├─ 讀 CF-Connecting-IP、request.cf.asn、request.cf.asOrganization
      ├─ 立刻回 204，其餘工作丟 ctx.waitUntil() 背景做
      ├─ DoH 反查 PTR（cloudflare-dns.com/dns-query）
      ├─ 域名 → 縣市代碼對照 → 來源分類
      └─ INSERT OR IGNORE 寫入 D1
      ▼
GET /stats?token=xxx → JSON 彙總 → 作品集報表頁讀取渲染
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
  domain       TEXT,              -- dxes.tn.edu.tw，僅 school 有值
  county       TEXT,              -- 臺南市，查不到代碼時為 NULL
  asn          INTEGER,
  as_org       TEXT,
  visitor_key  TEXT    NOT NULL,  -- SHA-256(ip + day + salt)，逐日輪替
  created_at   TEXT    NOT NULL
);

CREATE UNIQUE INDEX idx_visits_dedup ON visits(day, path, visitor_key);
```

**去重**：同一天、同一訪客、同一頁只留一列（`INSERT OR IGNORE`）。既符合隱私原則，也把寫入量壓在免費額度內。

## 6. Worker 判定流程

```
1. ip     = request.headers.get('CF-Connecting-IP')
2. asn    = request.cf.asn
   asOrg  = request.cf.asOrganization
3. hostname = DoH PTR 反查(ip)          // 失敗或逾時 → null
4. 分類：
   if hostname 以 '.edu.tw' 結尾:
       source_type = 'school'
       domain      = 取學校域名（規則見 6.1）
       county      = 縣市代碼表查詢（查無 → NULL）
   elif asn == 1659 或 asOrg 含 'TANET':
       source_type = 'tanet_unknown'
   else:
       source_type = 'other'
5. visitor_key = SHA-256(ip + day + SALT)   // SALT 存 Worker secret，不進 repo
6. INSERT OR IGNORE 寫入 D1                  // 原始 IP 到此為止，不落地
```

### 6.1 學校域名切分規則

PTR 給的是完整主機名（`www.dxes.tn.edu.tw`），需切出機構域名：

- 從右取 3 段 → `tn.edu.tw` 或 `ntu.edu.tw`
- 若第 3 段是**已知縣市代碼**（見 6.2），再往左多取一段 → `dxes.tn.edu.tw`（國中小）
- 否則 3 段即為機構域名 → `ntu.edu.tw`（大專）

### 6.2 縣市代碼對照（已查證 18 個）

| 代碼 | 縣市 | 代碼 | 縣市 | 代碼 | 縣市 |
|------|------|------|------|------|------|
| tp | 臺北市 | ntpc | 新北市 | tyc | 桃園市 |
| kl | 基隆市 | ilc | 宜蘭縣 | hc | 新竹市 |
| hcc | 新竹縣 | mlc | 苗栗縣 | tc | 臺中市 |
| chc | 彰化縣 | ylc | 雲林縣 | cy | 嘉義市 |
| cyc | 嘉義縣 | tn | 臺南市 | kh | 高雄市 |
| ptc | 屏東縣 | ttct | 臺東縣 | phc | 澎湖縣 |

**未查證**：花蓮、南投、金門、連江尚未確認代碼，實作時補查。

**Fail-open 設計**：查不到代碼時**顯示原始域名**，不猜、不留空。缺漏只會少一層中文化，不會產生錯誤資料。

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

**預設為私有**：以 token 保護，只有自己看得到。理由：名單牽涉他校，先自用觀察一段時間，要公開隨時可改；反向（公開後收回）代價高。此決策可推翻，請於審閱時確認。

呈現內容：
1. 學校清單（校名／域名 + 縣市 + 首次造訪 + 造訪天數）
2. 來源分佈（school / tanet_unknown / other 三類佔比）
3. 各單元熱度排行

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

1. **名單不完整**：估計約 1/3 的學術網路來源沒設 PTR，只能歸「TANet（不明）」
2. **非學術來源無校名**：老師在家或用行動網路開啟，一律歸「其他」
3. **NAT 出口聚合**：整間學校共用出口 IP，只知「這間學校有人來過」，算不出幾個人
4. **縣市網層級模糊**：部分 PTR 只到 `tn.edu.tw` 這層，代表該縣市網底下某校，無法再細分
5. **廣告攔截器**：少數使用者的擋廣告外掛可能攔下 beacon 請求

**這是有覆蓋率限制的樣本，不是普查名單。** 報表頁需明白標示此點，避免日後自己誤讀數字。

## 12. 驗收標準

- [ ] 從家用網路開啟站台 → D1 出現一列 `source_type='other'`
- [ ] 從校內網路開啟站台 → 出現 `school`（含域名）或 `tanet_unknown`
- [ ] 同一天重複開啟同一頁 → 資料庫仍只有一列
- [ ] 資料庫中**不存在**任何原始 IP 欄位
- [ ] `/stats` 不帶 token → 回 401；帶正確 token → 回 JSON
- [ ] 23 個頁面全數注入成功（逐頁驗證，不憑腳本輸出宣稱）
- [ ] 遊戲頁面功能不受影響（beacon 失敗不得阻塞頁面）

## 13. 實作前待辦

1. 校內實測自家 NAT 出口 IP 的 PTR，校準命中率預期
2. 補查花蓮／南投／金門／連江的教育網路代碼
3. 註冊／登入 Cloudflare 帳號，安裝 `wrangler` CLI
