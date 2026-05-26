# 資訊教育互動教材地圖

> 國小資訊教育互動教材作品集 —— 整合多單元遊戲化教材的一站式闖關平台

## 🎯 專案定位

本專案是**個人教學作品集**，集結為不同教學情境設計的互動教材，學生透過統一的課程地圖進入各單元闖關。

* **使用對象：** 國小中、高年級學生
* **使用情境：** 課堂示範、自主學習、家中複習
* **設計理念：** 教材即遊戲；用互動降低抽象概念門檻

## 🛠️ 技術棧

* **架構：** 純靜態網站（HTML + CSS + Vanilla JS），無後端、無資料庫
* **資料儲存：** 瀏覽器 `localStorage`（學生成績本機保存）
* **響應式：** CSS Grid + Flexbox，支援手機 / iPad / 桌機
* **部署：** GitHub Pages（綁定 `main` 分支自動部署）
* **AI 協作：**
  * **Gemini Canvas** — 互動原型與視覺迭代
  * **Claude Code** — 跨檔案結構整合、SDD 維護、自動化部署

## 📚 教材單元

| 年級 | 資料夾 | 主題 | 教學目標 |
|------|--------|------|---------|
| 🎒 一年級 | `unit2-mouse-adventure` | 小兔勇者大冒險 | 滑鼠點擊 / 移動 / 拖曳 / 雙擊 |
| 🎒 一年級 | `unit4-whack-keyboard` | 鍵盤打地鼠 | 鍵盤入門：數字 / 方向鍵 / 英文字母位置認識 |
| 🎒 一年級 | `unit3-space-typing` | 太空打字防衛戰 | 英文打字入門：字母 → 短詞 → 3 字母單字 |
| 🎒 一年級 | `unit5-pixel-art` | 像素藝術小畫家 | 數位創作、像素概念、滑鼠精準 |
| 🎒 一年級 | `unit6-turtle-commander` | 烏龜小指揮官 | 運算思維入門：序列、除錯、最少步數 |
| 📘 中年級 | `unit1-typing-adventure` | 中文打字冒險王 | 注音輸入、中文識讀、闖關成就感 |

## 🚀 快速開始

### 本機預覽

直接雙擊 `index.html` 用瀏覽器開啟即可，無需任何安裝。

### 部署到 GitHub Pages

1. Push 程式碼到 GitHub repo 的 `main` 分支
2. Repo Settings → Pages → Source 選擇 `main` 分支根目錄
3. 等待約 1 分鐘，網站上線於 `https://<username>.github.io/<repo>/`

## 📂 目錄結構

```text
edtech-portfolio/
├── index.html       # 課程地圖首頁
├── SDD.md           # 軟體設計說明書（規範與設計細節）
├── README.md        # 本檔案
└── units/                      # 各單元教材
    ├── unit1-typing-adventure/
    │   └── index.html
    ├── unit2-mouse-adventure/
    │   └── index.html
    ├── unit3-space-typing/
    │   └── index.html
    ├── unit4-whack-keyboard/
    │   └── index.html
    ├── unit5-pixel-art/
    │   └── index.html
    └── unit6-turtle-commander/
        └── index.html
```

完整規範請見 [`SDD.md`](./SDD.md)。

## 🤝 教學理念

* **教材應該好玩** —— 用遊戲化降低學習挫折感
* **資訊素養 ≠ 學程式** —— 重點在運算思維、邏輯推理、媒體識讀
* **AI 是放大器** —— 善用 AI 工具讓單人教師也能產出高品質教材
* **作品集即履歷** —— 教學成果用可互動的網站呈現，比 PPT 更有說服力

## 📝 授權

本專案採用 [MIT License](./LICENSE) 開源授權。

歡迎其他教師、學生、開發者自由使用、修改、再散布。如果你拿來改編成自己的教材，
標註原作者即可（不強制但歡迎）。
