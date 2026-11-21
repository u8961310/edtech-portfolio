# 全班成績匯出（QR 收成績）mockup 共用 brief（2026-11-21）

## 一句話
學生打完打字島／對戰島，在結算或獎狀頁出現「交成績」QR code；老師拿手機開「老師收成績」頁逐台掃，掃完一鍵匯出 CSV。**全部不經過伺服器、不收個資**。

## 已定案（使用者 2026-11-21 選的）
- 傳遞方式：**QR code 掃描**（不做下載檔案）
- 資料：**座號＋名字＋成績**（名字只存在學生電腦，QR 只在教室當面掃）
- 範圍：**打字島 8 關＋對戰島 unit23**

## 風格（先覆述）
- **學生端**：沿用打字島 C 版「繪本剪紙」——讀 `D:\code\repos\edtech-portfolio\.interface-design\system.md`（色票、字級、護眼規則全照做；不用純白底／純黑字、打字區對比 ≥ 7:1、介面字 ≥ 16px）
- **老師端**：平實工具風，表格走「銀行對帳單」：深藍表頭、數字靠右、後綴（%、字/分）固定寬度、不用大卡片＋膠囊＋漸層；資訊文字對比 ≥ 4.5:1。底色可以用 system.md 的 --paper／--card 讓兩端像同一家，但不要可愛裝飾
- 三版之間的差異：版面與互動方式（下面各版有指定方向），不是換色

## 要畫的畫面（一個 HTML 檔放全部，畫面之間用分頁或上下排都可以）
1. **學生端・交成績面板**（1366×657，不捲動）：放在打字島結算頁／獎狀頁旁邊。內容：座號（1–40，大按鈕或數字鍵盤，記住上次）、名字（沿用獎狀上的名字 `edtech-typing-name`，可改）、**真的 QR code**、QR 下方用大字列出 QR 裡的內容讓學生自己核對（關卡、階別、正確率、每分鐘字數、星等）。座號沒填時 QR 不出現，改提示「先選座號」
2. **老師端・掃描中**（手機 390×844）：上方班級／節次名稱（可改）、相機取景框、「已收 N 人」、剛掃到的那一位（座號＋名字＋成績，綠色 ✓ 約 1 秒）、重複掃同一人時提示「已更新」而不是新增一筆
3. **老師端・成績表**（手機 390×844 一版＋平板／筆電 1024 寬一版）：依座號排序；欄位 座號／名字／關卡／階別／正確率／每分鐘字數／星等／時間；**還沒交的座號**列出來（老師先設班級人數，例如 28）；按鈕：匯出 CSV、繼續掃、清空本節（要二次確認）

## QR 內容格式（三版共用，照抄）
```
ETS1|<unit>|<tier>|<lang>|<seat>|<name>|<acc>|<cpm>|<stars>|<min>|<yyyymmddHHMM>
例：ETS1|unit12|t2|zh|7|王小明|96|28|3|10|202611211030
```
- unit：unit1/3/4/11/12/13/14/16/23；tier：t1/t2/t3（unit23 填 -）；lang：zh/en；acc 整數 %；cpm 每分鐘字數；stars 0–3；min 選的分鐘數
- 名字裡的 `|` 要拿掉；QR 用 UTF-8：`qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8']`
- 開頭不是 `ETS1|` 的 QR 一律不收（避免掃到別的東西）
- CSV 要加 UTF-8 BOM（Excel 開中文才不會亂碼），欄位用中文表頭

## 素材（一定要用真的，不准畫假的 QR 圖或假字型）
- QR 產生：`docs/plans/mockups/vendor/qrcode-generator-2.0.4.js`（MIT）
- QR 解碼：`docs/plans/mockups/vendor/jsQR-1.4.0.js`（Apache-2.0）。mockup 裡做一顆「模擬掃描」鈕：把學生端產生的 QR 畫到 canvas 再用 jsQR 解出來塞進成績表——證明格式真的能來回
- 注音字型：`docs/plans/mockups/fonts/bpmf-huninn-typing.woff2`（學生端標題可以用；任何國字顯示要沿用 system.md 的規則）
- 用 3～5 筆假學生資料（座號＋常見假名如「小明」「小美」），**不要用真實學生姓名**

## 技術限制
- 單一 HTML（可引用上面 vendor／fonts 的相對路徑），不用 CDN、不用框架
- 檔名：`docs/plans/mockups/class-scores-<你的 skill 名>.html`
- 預覽：只能用 `python -m http.server <port> --bind 127.0.0.1 --directory D:\code\repos\edtech-portfolio\docs\plans\mockups`（不要開 repo 根目錄，那裡有 .dev.vars 會被擋）
- 截圖存到 `D:\code\repos\edtech-portfolio\.playwright-mcp\`，**不要丟在 D:\agent 根目錄**；用完把 http.server 關掉
- 不要 commit、不要動 mockups 以外的檔案

## 交回來要附
1. 檔案路徑
2. 每個畫面的截圖路徑
3. 自檢：學生端 1366×657 不捲動？QR 真的能被 jsQR 解回原字串（列出解出來的字串）？重複掃同一座號只更新不新增？CSV 有 BOM、Excel 表頭中文？老師端表格數字靠右？對比有沒有算過（列出最低的那組）？
