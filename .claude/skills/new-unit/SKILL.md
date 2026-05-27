---
name: new-unit
description: 在 edtech-portfolio 新增教材遊戲單元，或大改既有單元時觸發。當使用者說「新單元」「新教材」「新遊戲」「加遊戲」「edtech 新增」「新增單元」「做遊戲」「改 unit2/3/4/5/6/7」「優化單元」「單元命名」「SDD 對齊」「同步首頁卡片」時自動進入。專案層 skill，只在 D:\code\repos\edtech-portfolio 內有效。
---

# 新單元開發 SKILL

當使用者在 edtech-portfolio repo 要新增或大改教材單元時觸發此 skill。會引導完成從設計到部署的完整流程，並確保 SDD 規範對齊。

## 6 步驟工作流（嚴格依序）

1. **需求釐清**（先問完才動手）
   - 目標年級？（🎒 一年級 / 📘 中年級 / 🎓 高年級）
   - 主題與玩法概念？
   - 主要練習技能（滑鼠 / 鍵盤 / 打字 / 拖曳 / 邏輯 / 創作 / ...）？
   - 跟既有單元的差異化？

2. **設計藍圖**（純文字、不寫 code）
   - 場景與主角（含 emoji）
   - 關卡數量與漸進設計
   - 計分機制與證書稱號
   - 配色（從色彩系統挑未用色）
   - 預估行數
   - **使用者確認後才進入步驟 3**

3. **建立資料夾**
   - `mkdir -p units/unit{N}-{kebab-theme}/`
   - 新單元 N = 現有最大編號 +1（目前 1-6 已用，下一個 unit7）
   - 主進入點固定 `index.html`，CSS/JS 內嵌

4. **撰寫單檔 HTML**（依下方範本骨架）

5. **同步 4 處（不能漏，少一個畫面就會壞）**
   - ① `index.html` 新增卡片（放對 grade-section，套用 `--c` 配色變數）
   - ② `index.html` 底部 `[1,2,3,4,5,6].forEach` 加新 unitId（徽章自動顯示用）
   - ③ `README.md` 單元表加一列（含年級、資料夾、主題、教學目標）
   - ④ `README.md` 目錄樹加一行

6. **Commit + Push**（依 SDD §6.2 規範）
   ```bash
   git add .
   git commit -m "feat: add unitN-name (X年級 主題)

   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
   git push
   ```
   push 後 GitHub Actions 自動 deploy，約 1 分鐘上線 https://u8961310.github.io/edtech-portfolio/

## SDD 規範速查（讀 SDD.md 太慢就看這）

| 項目 | 規定 |
|------|------|
| 命名 | kebab-case，`unit{N}-{主題英文}` 例 `unit7-block-coding` |
| 進入點 | 每個資料夾必有 `index.html` |
| LocalStorage key | 統一 `edtech-unit{N}-score` |
| 相對路徑 | 一律 `./`，禁 `/` |
| RWD 斷點 | 手機 1 欄 / iPad 2 欄 / 桌機 3 欄、gap 24px、max-width 1200px |
| 字型 | `Noto Sans TC` 400/700/900 從 Google Fonts CDN |
| Tailwind | 可選擇用 CDN，不強制 |

## 配色系統（避免重複）

| Unit | 主題 | 色碼 | 狀態 |
|------|------|------|------|
| unit2 滑鼠 | 綠 | `#16a34a` | ✓ 已用 |
| unit4 鍵盤 | 橘 | `#f59e0b` | ✓ 已用 |
| unit3 太空 | 紫 | `#9333ea` | ✓ 已用 |
| unit5 像素 | 桃紅 | `#ec4899` | ✓ 已用 |
| unit6 烏龜 | 青 | `#14b8a6` | ✓ 已用 |
| unit1 中文 | 紅 | `#ef4444` | ✓ 已用 |
| 候選 | 黃 | `#eab308` | 可用 |
| 候選 | 藍 | `#3b82f6` | 可用 |
| 候選 | 深棕 | `#92400e` | 可用 |
| 候選 | 灰紫 | `#6366f1` | 可用 |

新單元優先挑未用色。如何套用：卡片 `style="--c: #xxxxxx;"`，CSS 內 `border-color: var(--c); box-shadow: 0 5px 0 var(--c); .play-btn { background: var(--c); }`。

## 範本骨架

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>單元名稱 - 副標</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;700;900&display=swap" rel="stylesheet">
<style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; min-height: 100%; }
    body {
        font-family: 'Noto Sans TC', sans-serif;
        user-select: none;
        -webkit-user-select: none;
        /* 背景漸層依主題 */
    }
    .screen {
        min-height: 100vh;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        padding: 20px;
    }
    .hidden { display: none !important; }

    /* 大按鈕 .big-btn 與變體 .gold / .secondary / .green / .gray */
    /* 過關證書 .certificate + @media print 列印樣式 */
</style>
</head>
<body>
<div id="app">
    <div id="start-screen" class="screen">...</div>
    <div id="game-screen" class="hidden">...</div>
    <div id="end-screen" class="screen hidden">
        <div class="certificate">...</div>
        <button onclick="location.reload()">🔄 再玩一次</button>
        <button onclick="window.print()">🖨️ 列印證書</button>
    </div>
</div>
<script>
'use strict';

// === Audio (Web Audio API 純合成) ===
let audioCtx = null;
function getAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
}
function beep(freq, duration, type = 'square', volume = 0.12) {
    try {
        const ctx = getAudio();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {}
}

// === State ===
const state = { /* ... */ };

// === Game Logic ===
// ...

// === Save best score (SDD §5) ===
function saveScore(score) {
    try {
        const prev = parseInt(localStorage.getItem('edtech-unit{N}-score') || '0', 10);
        if (score > prev) localStorage.setItem('edtech-unit{N}-score', score);
    } catch (e) {}
}
</script>
</body>
</html>
```

## 圖形化優先原則（2026-05-27 確立）

**所有年級的單元一律以圖形/emoji/icon 為主，國字要簡單少量。**

- ❌ 不要加注音 `<ruby><rt>` 標示（試過失敗）
- ❌ 不要引入任何中文注音函式庫
- ✅ 指令/提示/按鈕儘量用 emoji（「🚀」勝過「開始挑戰」）
- ✅ 必要國字用一年級識字量範圍（你/我/他/好/玩/看/走/上/下/左/右/大/小/紅/綠/藍...）
- ✅ 避免「咒語/指揮官/BOSS/闖關」這類抽象詞，改用「魔法/老大/最後/過關」
- ✅ 一句話不超過 6 個字
- ✅ 教學提示用動畫（手指點擊示範）勝過文字（「請點下面按鈕」）

## 一年級設計守則

- ✅ 點擊目標 ≥ 60px，建議 80-100px
- ✅ 0 文字閱讀依賴 — emoji + 短句 + 動畫指引
- ✅ 慢節奏（敵人出現 1.5-2 秒一次起步）
- ✅ 容錯：按錯不扣分，最多「不前進」
- ✅ 3 條心或無 HP 系統，失誤友善
- ✅ Web Audio 純合成音效（無外部檔案）
- ✅ Pointer Events 支援滑鼠 + 觸控（iPad / Chromebook）
- ✅ 過關證書可列印（@media print）
- ✅ 開發 dev 快捷鍵用 F8 等功能鍵（避開 Ctrl+Shift+W 等瀏覽器衝突）

## 中年級設計守則

- 比一年級多 1-2 個機制（如連擊、combo）
- 文字密度可提升但仍以圖示為主
- 節奏稍快、容錯仍要保留
- 證書稱號可有 4-5 級分

## 高年級守則（未來方向待議）

- 可能改走教材呈現而非遊戲（使用者 2026-05-26 暫停 unit7 遊戲開發決議）
- 若做遊戲：加入策略、規劃、最佳化要素
- 可考慮多種解法允許

## 不要做的事

- ❌ 不要用 hardcoded 顏色（用 `--c` CSS variable）
- ❌ 不要漏掉 4 處同步（首頁卡片、徽章 script 陣列、README 單元表、README 目錄樹）
- ❌ 不要用短編號 `units/unitN/`（改用 `units/unitN-描述/`）
- ❌ 不要忘記 SDD §7.2 相對路徑（`./` 而非 `/`）
- ❌ 不要建議改為含後端設計（純靜態定位不變）
- ❌ 不要在 mv 用 `*.html` glob（會吸到根 index.html，請用 absolute path）

## 容易踩雷（從 2026-05-26 開發實錄整理）

- **overflow:hidden + 文字溢出容器頂部**：例 unit4 地鼠字牌位於 emoji 上方被切。對策：移除 overflow:hidden，改用 opacity + transform 控制顯隱
- **grid + 矮螢幕被擠出視窗**：例 unit6 烏龜下方按鈕看不到。對策：`#game-screen { height: 100vh; overflow: hidden }` + `.grid-area { flex:1; min-height:0 }` + JS 動態 sizeGrid()
- **動畫 transform 互相衝突**：例 shake 用 `translate(-50%, -50%)` 蓋過 mole 原本的 `translateX(-50%)`，瞬移 50% 高度。對策：keyframes 保留原本 transform 基準
- **證書內容撐爆框框**：注意 letter-spacing + font-size 在連續字元的乘積。對策：減少字級或允許 wrap，必要時按段分行
- **路徑驗算錯誤 minSteps**：手算最短路徑容易少算轉彎成本。對策：寫完關卡後實際走一次確認

## 相關檔案

- `SDD.md` — 軟體設計規範（必讀）
- `README.md` — 專案說明與單元表
- `index.html` — 學生樂園入口
- `portfolio.html` — 老師作品集頁
- `.claude/skills/new-unit/SKILL.md` — 本檔
