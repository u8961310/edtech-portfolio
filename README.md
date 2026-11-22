# 資訊教育互動教材地圖

> 國小資訊教育互動教材作品集 —— 整合多單元遊戲化教材的一站式闖關平台

## 🎯 專案定位

本專案是**個人教學作品集**，集結為不同教學情境設計的互動教材，學生透過統一的課程地圖進入各單元闖關。

* **使用對象：** 國小中、高年級學生
* **使用情境：** 課堂示範、自主學習、家中複習
* **設計理念：** 教材即遊戲；用互動降低抽象概念門檻

## 🛠️ 技術棧

* **架構：** 純靜態網站（HTML + CSS + Vanilla JS），沒有資料庫。另有兩支 Cloudflare Worker 輔助，都不存學生個資：
  * `analytics-worker/`：造訪統計（來源學校、不重複裝置）
  * `duel-worker/`：打字擂台（unit23）兩台電腦連線對戰；一個房號一個 Durable Object，不留對戰紀錄。連不上時遊戲仍可對電腦練習
* **首頁：** 「學習樂園島」插畫版——用 three.js r160（CDN）把 3D 玩具模型**預先算成分層 WebP**，網頁只疊圖＋HTML 熱區，舊電腦也順
* **產圖：** `python tools/render-island.py`（需 Python Playwright），改了關卡或場景後重跑
* **資料儲存：** 瀏覽器 `localStorage`（學生成績本機保存）
* **響應式：** CSS Grid + Flexbox，支援手機 / iPad / 桌機
* **部署：** GitHub Pages（綁定 `main` 分支自動部署）
* **AI 協作：**
  * **Gemini Canvas** — 互動原型與視覺迭代
  * **Claude Code** — 跨檔案結構整合、SDD 維護、自動化部署

## 📚 教材單元

| 年級 | 資料夾 | 主題 | 教學目標 |
|------|--------|------|---------|
| 🎒 1–2 年級 | `unit21-mouse-challenge` | 滑鼠勇士 | 滑鼠島①：指向與單擊（叫醒貓咪、餵點心；注音）｜生活 2-I-5、資E1 |
| 🖱️ 1–4 年級 | `unit33-egg-tap` | 敲敲蛋寶寶 | 滑鼠島②：雙擊（孵蛋、蛋寶寶圖鑑；雙擊速度老師可調；注音）｜生活 2-I-5、資E1 |
| 🖱️ 1–4 年級 | `unit19-farm-harvest` | 拔蔬菜 | 滑鼠島③：拖拉（拔起來拖進菜籃、分類；原鍵盤版已改成滑鼠版；注音）｜生活 2-I-5、資E1 |
| 🖱️ 1–4 年級 | `unit2-mouse-adventure` | 小兔勇者 | 滑鼠島④：總複習（招式卡選對操作、魔王戰、證書；注音）｜生活 2-I-5、3-I-3、資E13 |
| 📘 3–4 年級 | `unit34-right-click-wizard` | 右鍵魔法師 | 滑鼠島⑤：右鍵選單（開啟／複製／重新命名／刪除；平板長按）｜資E1、資E2 |
| 📘 3–4 年級 | `unit35-scroll-sea` | 海底捲捲探險 | 滑鼠島⑥：滾輪捲動與縮放（平板手指滑）｜資E1、資E2 |
| 📘 3–4 年級 | `unit36-box-farm` | 牧場圍圍樂 | 滑鼠島⑦：框選與 Ctrl 多選｜資E1、資E8 |
| 🎒 一年級 | `unit4-whack-keyboard` | 鍵盤打地鼠 | 鍵盤入門：數字 / 方向鍵 / 英文字母位置認識 |
| 🎒 一年級 | `unit3-space-typing` | 太空打字防衛戰 | 英文打字入門：字母 → 短詞 → 3 字母單字 |
| 🎨 1–4 年級 | `unit5-pixel-art` | 像素小畫家 | 畫畫島：低年級數字填色、中年級座標畫圖、像素概念與自由創作 |
| 🎒 一年級 | `unit6-turtle-commander` | 烏龜小指揮官 | 運算思維入門：序列、除錯、最少步數 |
| 🎒 一年級 | `unit7-spell-commander` | 指令小法師 | 滑鼠+鍵盤整合、運算思維：順序、重複、條件 |
| ⭐ 1–4 年級 | `smart-pet-house` | 寵物小屋 | 小常識島大廳：領養寵物（座號＋名字，一台電腦多隻）、換裝、6 關進度（注音） |
| 🎒 1–2 年級 | `unit29-pet-computer` | 寵物的新電腦 | 小常識島：電腦設備名稱與用途、生活中的資訊產品（資E1，注音） |
| 🎒 1–2 年級 | `unit30-pet-schedule` | 寵物作息表 | 小常識島：坐姿、護眼、3C 作息（資E11，注音） |
| ⭐ 1–4 年級 | `unit8-desktop-organizer` | 寵物房間大整理（原桌面整理大師） | 小常識島：依圖示把檔案拖進資料夾、看圖示不看檔名（資E8，注音） |
| 📘 3–4 年級 | `unit31-pet-message` | 寵物收到怪訊息 | 小常識島：陌生人訊息、釣魚與假訊息、群組禮儀（資E12、資E7） |
| 📘 3–4 年級 | `unit32-pet-ai-homework` | 寵物的 AI 作業 | 小常識島：合宜使用生成式 AI——誠實、查證、保護個資（資E12、資E2） |
| 📘 3–4 年級 | `unit9-net-detective` | 寵物警察訓練（原網路小警察） | 小常識島：5 關 25 題情境判斷安全或危險（資E12） |
| 🎒 一年級 | `unit10-classifier-captain` | 分類大隊長 | 觀察分類、依特徵歸組（資料概念入門） |
| 📘 中年級 | `unit1-typing-adventure` | 中文打字冒險王 | 注音輸入、中文識讀、闖關成就感 |
| 📘 中年級 | `unit11-space-typing-pro` | 英打太空特攻 | 計時英打練習、漸進難度、WPM 計分 |
| 📘 中年級 | `unit12-space-typing-zh` | 中打太空特攻 | 計時注音輸入練習、IME 比對、漸進難度 |
| 🎒 一年級 | `unit13-forest-typing-defense` | 極速雷射森林戰 | 注音／英打雙模式切換、霓虹雷射射擊、小一友善慢速版 |
| 🎓 三年級 | `unit14-magic-word-bullet` | 魔法字彈極速覺醒 | 英文打字、時間模式（2/10 分）、RPG 魔法主題 |
| 🎒 一年級 | `unit15-computational-thinking` | 運算思維挑戰營 | 四階段運算思維（拆解／模式／抽象／演算法），小一友善關卡 |
| 🎒 一年級 | `unit16-dino-typing` | 恐龍打字大冒險 | 橫向跑酷打字、字母輸入、邊跑邊練（小一友善） |
| 🎒 一年級 | `unit17-pet-treasure-coding` | 程式小勇士：萌寵尋寶 | 運算思維啟蒙：指令序列、拆解步驟、找規律 |
| 🎒 1–2 年級 | `unit18-magic-paint` | 魔法畫畫屋 | 畫畫島：主題卡自由畫畫、彩虹筆、印章，按魔法讓畫動起來（注音） |
| 🎒 1–2 年級 | `unit24-color-cauldron` | 調色魔法鍋 | 畫畫島：三原色混色（減色查表）、加白變淺、拖曳放開（注音） |
| 🎒 1–2 年級 | `unit25-line-train` | 線條小火車 | 畫畫島：直線／波浪線／鋸齒線與感覺、按住拖曳精細動作（注音） |
| 🎨 1–4 年級 | `unit28-sparkle-fireworks` | 閃亮亮煙火畫 | 畫畫島：自由發揮、不評分，煙火／亮粉／霓虹／泡泡／彩虹筆與煙火秀特效（音效預設關） |
| 📘 3–4 年級 | `unit26-mirror-workshop` | 對稱魔鏡工坊 | 畫畫島：左右／上下／萬花筒／雪花對稱創作（視E-II-1、視E-II-3） |
| 📘 3–4 年級 | `unit27-paint-mission` | 小畫家任務局 | 畫畫島：繪圖工具（圖形、填色、選取、複製貼上）、步數與標準桿（視E-II-2） |
| 🎒 一年級 | `unit20-sock-matching` | 瘋狂襪子配對線 | 連線配對、觀察規律、運算思維邏輯 |
| 📘 中年級 | `unit22-xmas-workshop` | 聖誕工坊大救援 | 聖誕節慶：主線四關（分類、程式序列、網路安全、打字＋快問快答）＋畫畫屋與 4 個小遊戲，全站唯一附注音字型 |
| ⚔️ 跨年級 | `unit23-typing-duel` | 打字擂台 | 兩台電腦 1 對 1 連線打字對戰（英打／注音中打）、國小 9 領域 57 篇原創選文（注音字型＋破音字）、分層提示、結算看進步 |
| 🎲 跨年級 | `board/` | 資訊大富翁：森林大冒險 | 資安 / 護眼 / 密碼 / 個資 / 硬體常識；過關發證書可列印 |
| 🎲 跨年級 | `board/ocean.html` | 資訊大富翁：海洋大探索 | 檔案管理：存放位置 / 資料夾 / 資源回收桶 / 檔名 / 備份 |

## 🚀 快速開始

### 本機預覽

在專案根目錄跑 `python -m http.server`，再開 `http://localhost:8000/`（首頁用 ES module 讀 `island/data.js`，用本機伺服器最穩）。

### 部署到 GitHub Pages

1. Push 程式碼到 GitHub repo 的 `main` 分支
2. Repo Settings → Pages → Source 選擇 `main` 分支根目錄
3. 等待約 1 分鐘，網站上線於 `https://<username>.github.io/<repo>/`

## 📂 目錄結構

```text
edtech-portfolio/
├── index.html       # 🏝️ 學習樂園島首頁（插畫版：疊 island/img 的圖＋熱區，不跑 3D）
├── island-3d.html   # 🧊 即時 3D 版（電腦夠力才順）；也是產圖來源（?export=land／port）
├── island/
│   ├── data.js      # 關卡資料（兩個版本共用）——新增單元改這裡
│   ├── map-*.json   # 產圖工具輸出的熱區座標（橫向 land／直向 port）
│   └── img/         # 產圖工具輸出的分層 WebP
├── tools/render-island.py  # 產圖工具
├── list.html        # 🗂️ 卡片版首頁（舊版備案）
├── SDD.md           # 軟體設計說明書（規範與設計細節）
├── README.md        # 本檔案
├── board/                      # 資訊大富翁（跨區地圖遊戲，不屬於 units/）
│   ├── index.html              # 森林區（第一區）
│   ├── ocean.html              # 海洋區
│   ├── certificate.js / .css   # 四區共用：證書、星等門檻、前往下一區
│   ├── CANVAS_PROMPT.md        # 給 Gemini Canvas 的生成規格與契約
│   └── verify-canvas.py        # Canvas 產出的自動驗收腳本
└── units/                      # 各單元教材
    ├── unit1-typing-adventure/
    │   └── index.html
    ├── unit2-mouse-adventure/        # 滑鼠島④（滑鼠島 7 關共用外殼 assets/js/mouse-ui.js＋assets/css/mouse-island.css）
    │   └── index.html
    ├── unit3-space-typing/
    │   └── index.html
    ├── unit4-whack-keyboard/
    │   └── index.html
    ├── unit5-pixel-art/
    │   └── index.html
    ├── unit6-turtle-commander/
    │   └── index.html
    ├── unit7-spell-commander/
    │   └── index.html
    ├── unit8-desktop-organizer/      # 小常識島：寵物房間大整理
    │   └── index.html
    ├── unit9-net-detective/          # 小常識島：寵物警察訓練
    │   └── index.html
    ├── unit29-pet-computer/ … unit32-pet-ai-homework/   # 小常識島新 4 關
    ├── unit33-egg-tap/ … unit36-box-farm/              # 滑鼠島新 4 關（雙擊、右鍵、滾輪、框選）
    ├── smart-pet-house/              # 小常識島：寵物小屋
    ├── unit10-classifier-captain/
    │   └── index.html
    ├── unit11-space-typing-pro/
    │   └── index.html
    ├── unit12-space-typing-zh/
    │   └── index.html
    ├── unit13-forest-typing-defense/
    │   └── index.html
    ├── unit14-magic-word-bullet/
    │   └── index.html
    ├── unit15-computational-thinking/
    │   └── index.html
    ├── unit16-dino-typing/
    │   └── index.html
    ├── unit17-pet-treasure-coding/
    │   └── index.html
    ├── unit18-magic-paint/
        └── index.html
    ├── unit19-farm-harvest/
    │   └── index.html
    ├── unit20-sock-matching/
    │   └── index.html
    ├── unit21-mouse-challenge/
    │   └── index.html
    ├── unit22-xmas-workshop/       # 多頁單元：index.html 是工坊地圖
    │   ├── index.html / rescue.html（主線四關）
    │   ├── draw.html / catch.html / memory.html / tree.html / snowman.html
    │   └── fonts/bpmf-huninn-xmas.woff2（注音粉圓子集，SIL OFL 1.1）
    └── unit23-typing-duel/         # 打字擂台：index.html 只做畫面（Gemini 產），邏輯在下面幾支
        ├── duel-rules.js（規則，與 duel-worker 共用）/ duel-core.js / duel-net.js
        ├── passages-src.json → passages.js（tools/build-passages.py 產生）
        └── fonts/bpmf-huninn-duel.woff2
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
