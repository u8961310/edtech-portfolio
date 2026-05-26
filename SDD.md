# 軟體設計說明書 (Software Design Description, SDD)

## 1. 專案概述 (Project Overview)

* **專案名稱：** 資訊教育互動教材地圖 (EdTech Interactive Learning Dashboard)
* **設計目標：** 整合國小不同教學單元、多元互動機制的遊戲化教材，透過統一的 RWD 介面與系統化架構，提供學生「一站式闖關體驗」，並作為教師的專業 EdTech 作品集。
* **技術定位：** **純靜態網站**，無後端、無資料庫。每個單元為自包含的單一 HTML（CSS/JS 內嵌或同目錄），主要由 **Gemini Canvas** 迭代產出，搭配 GitHub Pages 一鍵部署。
* **AI 協作模式：** Gemini Canvas 負責互動原型與視覺，Claude Code 負責跨檔案結構維護、SDD 更新與部署設定。

---

## 2. 目錄結構規範 (Directory Spec)

```text
edtech-portfolio/          # 專案根目錄
│
├── index.html             # 入口網頁（課程地圖 Dashboard）
├── SDD.md                 # 本設計規範說明書
├── README.md              # 作品集說明（技術棧、教學理念）
│
└── units/                 # 互動教材單元總目錄
    ├── unit1/             # 單元一
    │   └── index.html     # Canvas 產出，CSS/JS 內嵌單檔
    ├── unit2/             # 單元二
    │   └── index.html
    └── unit3/             # 單元三
        └── index.html
```

* **單元自包含原則：** 每個單元一律一個資料夾、一個 `index.html` 為進入點。Canvas 產出的單檔 HTML（含 inline `<style>` 與 `<script>`）直接放進去即可，無需拆檔。
* **若單元需要多檔資源**（例如圖片、額外 JS）：在該單元資料夾下自由擴充，例如 `units/unit1/assets/`、`units/unit1/game.js`，不影響首頁。

---

## 3. 命名規範 (Naming Convention)

所有檔案與目錄一律 **kebab-case（小寫連字號）**：

* **單元資料夾：** `unit{編號}`（簡單編號制，例 `unit1`、`unit2`）。若需描述主題可擴充為 `unit{編號}-{主題}`，例 `unit1-imovie`，但需同步更新 `index.html` 的連結。
* **單元進入點：** 一律命名為 `index.html`，方便 GitHub Pages 直接讀取目錄。
* **附加資源：** CSS 用 `style.css`、JS 用 `main.js` 或 `game.js`、圖片放 `assets/`。

---

## 4. 響應式佈局 (Responsive Grid)

首頁 Dashboard 必須具備跨平台自適應能力，確保在桌機、筆電、iPad 直橫向、手機皆完整呈現。

### 4.1 CSS Grid 斷點

主頁關卡地圖採用 `display: grid;` 切版，依以下斷點自動調整欄數：

| 裝置 | 螢幕寬度 | 欄數 |
|------|---------|------|
| 手機 | < 768px | 1 欄 |
| iPad | 768px – 1023px | 2 欄 |
| PC/Mac | ≥ 1024px | 3 欄 |

* **間距：** `gap: 24px`
* **最大寬度：** 外層容器 `max-width: 1200px`，大螢幕自動置中

### 4.2 卡片容器

* `display: flex; flex-direction: column;` 確保按鈕在不同高度卡片中靠底對齊
* hover 微動效：放大或陰影加深，提升點擊感

---

## 5. 學習資料儲存規範 (Data Persistence)

純靜態網站不經後端，學生過關狀態與分數一律使用瀏覽器 `localStorage` 儲存。

* **命名空間：** `edtech-unit{編號}-score`
* **參考實作：**

```javascript
// 儲存學生成績至本地端
function saveLocalScore(unitId, score) {
    const storageKey = `edtech-unit${unitId}-score`;
    localStorage.setItem(storageKey, score);
}

// 讀取本地端成績以更新首頁 UI
function loadLocalScore(unitId) {
    return localStorage.getItem(`edtech-unit${unitId}-score`) || null;
}
```

* **首頁整合：** Dashboard 載入時讀取各 unit 的 score 顯示「最佳成績」徽章。
* **隱私說明：** 資料只存學生自己的瀏覽器，換裝置或清快取會消失，符合無後端設計。

---

## 6. 版本控制與提交規範 (Git Flow)

### 6.1 分支策略

* **`main` 為唯一生產分支**：GitHub Pages 綁此分支自動部署，所有進入 `main` 的程式碼需本機測試通過。
* **小型修改可直接 commit 到 `main`**；新增重大單元或大改版型時建議開 `feat-xxx` 分支，測試後再合併。

### 6.2 Commit 訊息格式

格式：`[單元/模組] 動作類型: 具體說明`

* **動作類型：**
  * `feat`：新增單元或功能
  * `fix`：修正 Bug 或跑版
  * `docs`：修改 SDD、README
  * `style`：純視覺調整（CSS、排版）
* **範例：**
  * `[unit1] feat: 新增 iMovie 拖拉分鏡成功判定與分數累加`
  * `[dashboard] style: 微調首頁卡片 hover 放大動畫`
  * `[docs] docs: 更新 SDD 單元命名規範`

---

## 7. 部署規範 (GitHub Pages Deployment)

### 7.1 入口配置

* 根目錄 `index.html` 為唯一靜態入口。
* GitHub repo Settings → Pages → Source 設為 `main` 分支根目錄。

### 7.2 相對路徑強制要求

GitHub Pages 部署網址為 `https://<username>.github.io/<repo>/`，所有資源引用**必須用相對路徑** `./`，禁用絕對路徑 `/`：

| 用法 | 範例 |
|------|------|
| ✅ 正確 | `<a href="./units/unit1/index.html">` |
| ❌ 錯誤 | `<a href="/units/unit1/index.html">` |

CSS、JS、圖片、`<iframe>` 連結同此規則。

### 7.3 部署檢查清單

每次推 `main` 前確認：

- [ ] 本機 `index.html` 直接雙擊開啟可正常運作
- [ ] 所有 `units/unitN/index.html` 個別開啟可運作
- [ ] 首頁卡片連結路徑為相對路徑
- [ ] 無 console error

---

## 8. 未來擴充原則 (Future Scope)

本 SDD 規範**純靜態網站**範圍。若未來需要：

* **真實後端整合**（API、資料庫、LINE Bot 真實串接）→ 另開獨立 repo 或子專案，不污染本作品集。
* **使用者帳號 / 跨裝置同步** → 同上，需另起架構。

保持本專案「Gemini Canvas 單檔互動 + GitHub Pages 一鍵部署」的輕量定位。
