# 給 Gemini 的生成規格（打字島 8 關重生）

用法：`python tools/build-typing-island-prompt.py <關卡代號> <輸出 txt>` 組出：下方【共用提示詞】＋該關【本關設定】＋ `.interface-design/system.md` 全文＋ `assets/typing/demo.html` 全文（場景範本），
再 `python tools/agy-ndjson.py <txt> <ndjson>`、`agy --input-format stream-json --output-format stream-json "-p=" < <ndjson> > gen.jsonl`（cwd 設 scratchpad），
`python tools/agy-extract.py gen.jsonl <index.html> <自檢表.txt>` 擷取，存成 `units/<資料夾>/index.html`。

驗收：只開 `assets/`＋`units/` 的本機伺服器、1366×657 打完一局（含打錯 3 層、休息、結算、獎狀）、console 0 錯、`node tools/test-typing-core.js`。

---

## 共用提示詞

```
【回覆方式】不要使用任何工具：不要建立或寫入檔案、不要執行指令、不要讀取資料夾。
直接把完整程式碼寫在你的文字回覆裡，用一個 ```html 區塊包住整個檔案，區塊後面附一張「自檢表」逐條回答最後的檢查清單。

你要為台灣國小打字遊戲「打字島」寫其中一關的網頁 index.html。
這次你只負責「遊戲場景」：設定畫面、打字判斷、提示、計時、休息、結算、獎狀，全部由已經寫好的共用程式處理，
你不要重寫它們，也不要改它們的樣式。你的工作是把場景畫得可愛、好玩、動起來，並且正確地接上共用程式。

【頁面結構 — 一定照這個骨架】
<!doctype html><html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>（本關名稱）- 打字島</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&family=Fredoka:wght@500;600&display=swap">
  <link rel="stylesheet" href="../../assets/css/typing-island.css">
  <style> /* 只放場景樣式，class 一律用 sc- 開頭 */ </style>
</head><body>
  <script src="../../assets/typing/passages.js"></script>
  <script src="../../assets/typing/en-items.js"></script>
  <script src="../../assets/js/typing-core.js"></script>
  <script src="../../assets/js/typing-ui.js"></script>
  <script> TypingIsland.mount({ ...見【本關設定】..., scene: function (api) { ...你的場景... } }); </script>
  <script defer src="../../assets/js/beacon.js"></script>
</body></html>
body 裡不要放其他 HTML：畫面由 TypingIsland.mount 產生。

【共用程式給你的 api（scene 函式收到的參數）】
- api.field：場景容器 div（已經是紙片圓角卡片，寬約 1330px、高約 300px，會隨視窗變；用 clientWidth/clientHeight 量，不要寫死）
- api.current()：目前要打的字 { ch, display, zhuyin, passage, index, tier }
- api.upcoming(n)：從目前字起算的 n 個要打的字陣列，每個 { ch, display, zhuyin, passageIndex, index }；第 0 個就是目前要打的字
  ※ 顯示國字一律用 display（裡面可能接了破音字選擇器，字型才會畫出正確讀音），絕對不要自己拿 ch 顯示或寫死國字
  ※ 字的字型用 font-family: var(--f-zh)；英打時（api.settings.lang === 'en'）見技術約束第 10 條，空白字元顯示成 ␣
- api.loseLife()：扣一顆愛心（目標掉到底線、怪獸反擊時呼叫）；愛心用完共用程式會自己結束該回合
- api.lives()、api.combo()：目前愛心數、連擊數
- api.settings：{ lang:'zh'|'en', tier:'t1'|'t2'|'t3', minutes, set, zhuyin }；依 tier 調難度（初階慢、高階快）

【scene 函式要回傳的物件 — 共用程式會在對的時機呼叫】
{ start(),            // 第一回合開始前呼叫一次：建立場景元素
  roundStart(n),      // 每回合開始（第 n 回合）：重置目標／怪獸
  resume(), pause(),  // 開始動／停止動：所有 requestAnimationFrame、setTimeout、setInterval 都要在 pause 停掉、resume 再開
  stop(),             // 整局結束：停掉一切動畫
  hit(res, cur),      // 打對：res.correct＝這次打對幾個字、res.combo＝連擊；打對的字已經從 upcoming 前面移走
  miss(res, cur),     // 打錯：res.tier＝這個字錯第幾次（1、2、3）；第 3 次共用程式會自動暫停並蓋上大鍵盤
  resize() }          // 視窗大小改變
暫停（含學生按暫停、切到別的視窗、第 3 層大鍵盤）期間場景必須完全靜止，目標不能繼續掉、怪獸不能反擊。
附件最後的 demo.html 是一個能動的最小範本（帶字蘋果往下掉），請參考它怎麼對齊 upcoming 與畫面元素，再做出完整好看的版本。

【畫面風格 — 一定照附件的設計規範 system.md】
溫暖繪本／紙張剪貼風：米色紙、白卡紙、略不規則的邊、疊層紙影、Q 版童書角色（小狐狸是打字島島主）。
用 system.md 的色票變數（var(--sky-dk) 等），不要另外發明主色；目標物上的字要深色字配淺色底，對比 7:1 以上，字至少 40px（含注音）。
目前要打的那個目標要明顯標出來（天藍虛線瞄準圈或天藍粗框），其他目標樸素一點。
角色、目標物、背景都用 inline SVG 或 CSS 畫，不要外部圖片；emoji 只能用 Windows 10 有的，盡量不用。

【護眼與無障礙（老師特別要求）】
- 不要純白大面積、不要暗色底；高彩度只用在小東西
- 閃爍每秒不超過 3 次；打錯的回饋用輕輕晃動或小音效般的視覺，不要整個場景閃紅
- prefers-reduced-motion 時：目標改成淡入淡出、沒有晃動與粒子
- 打對要有讓小朋友開心的回饋（小星星、+1、角色跳一下），但不能擋住要打的字

【技術約束】
1. 單一 HTML，只能引用骨架裡那些檔案和 Google Fonts；不要 import 其他函式庫
2. 場景所有元素都放在 api.field 裡面；不要動 document.body 的其他內容，不要改 .ti- 開頭的任何樣式
3. 不要自己監聽鍵盤或做輸入框，不要自己計時、存分數、做結算或獎狀（共用程式都做了）
4. 動畫用 requestAnimationFrame，用時間差（dt）算位置，不要用固定每幀移動量；dt 上限 0.1 秒
5. pause() 之後不能有任何計時器或動畫還在跑（老師會檢查）
6. 目標數量依 tier：初階 3 個、進階 4 個、高階 5 個同時在畫面上；速度：初階最慢，到底線至少 14 秒；進階 10 秒；高階 7 秒
7. 字的位置與畫面元素要跟 upcoming 對齊：hit 之後把前面 res.correct 個目標移走，再用 upcoming 補上
8. 程式碼加中文註解，數值（速度、數量、顏色）集中成檔案開頭的具名常數 SCENE_CONFIG
9. 還沒輪到的目標不能先跑到底線（或角色）附近：它們速度約目前目標的 1/3，最多只前進全程的 1/3；
   這樣輪到它變成目前目標時，還有至少 2/3 的時間可以打（不然打字慢的低年級會連續扣愛心）
10. 英打（api.settings.lang === 'en'）：每個要打的單位是一個字母、數字、標點或空白（空白顯示成 ␣）；
   大小寫照原樣顯示，不要轉換；字用 font-family: 'Fredoka', Consolas, monospace，至少 44px
11. 回合開始（roundStart）要清空上一回合留下的所有目標、粒子、倒數，重新從 api.upcoming 建立；
   第一回合時 start() 會先被呼叫、再呼叫 roundStart(1)

【回覆最後的自檢表 — 逐條寫「有／沒有」並說明】
- 是否完全照骨架、只寫場景？
- 顯示國字是否一律用 display？
- pause 後是否所有動畫與計時器都停了？
- 目標掉到底線／怪獸反擊是否呼叫 api.loseLife()？
- 是否支援 prefers-reduced-motion？
- 是否沒有每秒超過 3 次的閃爍？
- 是否沒有寫死 api.field 的寬高？
```

---

## 本關設定

### unit12（中打特攻）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 12, title: '中打特攻', subtitle: '射擊類・中打', langs: ['zh'], homeUrl: '../../index.html'
玩法：射擊類。
場景：晴朗藍天雲海，小狐狸駕駛紙飛機停在畫面底部中央（可以左右滑到目標下方），
上方飄下來帶字的紙氣球（不同柔和顏色）；打對一個字，紙飛機就發射一顆橡果彈打破最前面的氣球，氣球變成小紙片飄散。
氣球掉到底部雲層線就扣一顆愛心，並在雲層線上畫一個小小的「噗」。
連擊每 10 下，小狐狸戴上一副飛行護目鏡並說「好準！」（小對話框，2 秒後消失）。
回合開始時氣球從上方陸續飄入，不要一次全部出現。
```

### unit1（中文打字冒險王）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 1, title: '中文打字冒險王', subtitle: '怪獸對打・中打', langs: ['zh'], homeUrl: '../../index.html'
玩法：怪獸對打類。
場景：森林小路，左邊是 Q 版小勇者（小狐狸戴紙頭盔、拿木劍），右邊是圓滾滾的森林怪獸，
怪獸頭上有一個對話框，裡面大大顯示「目前要打的字」（api.current().display，字 64px 以上），下面小字顯示下一個字。
場景上方有雙方血條：小勇者血條＝api.lives()（5 格愛心），怪獸血條＝怪獸 HP（場景自己算）。
打對一個字：小勇者揮劍、怪獸被打退一步，怪獸 HP 減少（連擊越高傷害越高：連擊 10 以上 ×1.5，顯示「傷害 ×1.5」小牌子）。
怪獸 HP 歸零：怪獸變成小葉子飄走，下一隻怪獸跳出來（三種輪流：蘑菇怪、橡果怪、雲朵怪），HP 依 tier：初階 12、進階 18、高階 24。
怪獸反擊：如果太久沒打對（初階 9 秒、進階 7 秒、高階 5 秒），怪獸撞小勇者一下並呼叫 api.loseLife()；
場景要畫一條「反擊倒數」小進度條讓學生知道還有多久；每打對一個字倒數重新開始。打錯不扣血，只讓怪獸做鬼臉。
```

### unit4（打地鼠 → 怪獸冒冒頭）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 4, title: '鍵盤怪獸冒冒頭', subtitle: '怪獸對打・英打入門', langs: ['en'], homeUrl: '../../index.html'
玩法：怪獸對打類（打地鼠的玩法，但打的是可愛小怪獸，不是地鼠）。
場景：草地上一排剪紙土洞（初階 5 個、進階 7 個、高階 9 個，橫排置中，用 clientWidth 等分），
每次只有一隻小怪獸從某個洞冒出來，雙手舉著一塊小木牌，木牌上大大寫著目前要打的字母（api.current().display）；
旁邊另一個洞可以露出半顆頭、木牌淡淡顯示「下一個」字母（api.upcoming(2)[1]），讓學生預備。
打對：小狐狸從畫面左下角揮一下紙槌，怪獸頭上冒小星星、咻地縮回洞裡，換下一隻從別的洞冒出（不要連續同一個洞）。
畫面右上角有「怪獸大王」血條：每打對一個字扣 1，扣完大王出來投降揮白旗 1.5 秒，再換一隻新大王（血量：初階 20、進階 30、高階 40）。
太慢：怪獸冒頭後超過時間（初階 6 秒、進階 4.5 秒、高階 3.5 秒）還沒打對，怪獸吐舌頭偷走一顆橡果並呼叫 api.loseLife()，
然後同一個字換另一個洞重新冒出（字不變）。木牌下方要有一條小小的倒數條。打錯只讓怪獸歪頭眨眼，不扣血。
空白字元（␣）的木牌要寫「空白鍵」三個字（這三個字是介面文字，不是選文，可以直接寫）。
```

### unit3（太空打字）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 3, title: '太空打字防衛戰', subtitle: '射擊類・英打', langs: ['en'], homeUrl: '../../index.html'
玩法：射擊類。
場景：不要暗色夜空（護眼）。用「黃昏紙劇場」：淡薰衣草紫到淡桃色的紙張天空、剪紙的圓圓小行星和土星環、幾顆小星星貼紙（不閃爍）。
畫面底部是剪紙月球表面，小狐狸坐在紙捲成的小火箭砲台裡（可以左右滑到目標下方）。
上方慢慢落下帶字母的「紙流星」（圓角星形或圓形紙片，後面拖一條短短的紙條尾巴），目標數量與速度照技術約束第 6 條。
打對：火箭砲台射出一道彩色紙帶光束（不是刺眼雷射，0.25 秒），流星碎成小星星紙屑。
流星落到月球表面就扣一顆愛心（api.loseLife()），表面留下一個小小的坑並冒一朵小煙。
連擊每 10 下，月球上的小外星朋友跳出來舉牌「好厲害！」（2 秒後消失）。
```

### unit16（恐龍打字）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 16, title: '恐龍打字大冒險', subtitle: '怪獸對打・英打', langs: ['en'], homeUrl: '../../index.html'
玩法：怪獸對打類（橫向）。
場景：側面視角的剪紙草原小路（遠山、雲、矮樹三層紙片，緩慢視差捲動），
左邊是 Q 版綠色小恐龍（打字島的好朋友），面向右邊；右邊有一排「石頭怪」沿著小路從右往左走過來，
每隻石頭怪頭上舉著一張字卡，寫一個要打的字母（照 api.upcoming 順序，最前面那隻離恐龍最近）。
只有最前面那隻會朝恐龍走（從右邊走到恐龍面前：初階 12 秒、進階 8 秒、高階 6 秒），其他幾隻排隊慢慢跟（遵守技術約束第 9 條）。
最前面那隻要加天藍虛線圈。同時在畫面上：初階 3 隻、進階 4 隻、高階 5 隻。
打對：小恐龍用尾巴一甩，石頭怪變成小石子彈飛、落地變小花。
石頭怪走到恐龍面前：撞恐龍一下（恐龍眼睛變 > <），呼叫 api.loseLife()，石頭怪退回隊伍最前面的起點重走（字不變）。
畫面上方有一條「冒險進度」路線圖：每打對一個字小恐龍圖示往右走一格，每 15 字到一個「休息站」插旗（純鼓勵，不影響計分）。
打錯：最前面的石頭怪做鬼臉吐舌頭，不扣血。
```

### unit13（雷射森林）

```
【本關設定】
TypingIsland.mount 的參數：
  unit: 13, title: '極速雷射森林戰', subtitle: '射擊類・英打', langs: ['en'], homeUrl: '../../index.html'
玩法：射擊類。
場景：明亮的剪紙森林（淺綠、草綠、暖黃三層樹叢），上方是樹冠，地面是一排可愛的小蘑菇田（要保護的東西）。
小狐狸森林守衛站在畫面底部，手持一支紙做的手電筒「光束槍」（可以左右滑到目標下方）。
「葉子蟲」從樹冠垂著蜘蛛絲慢慢降下來，每隻身上背一片葉子寫著一個字母；目標數量與速度照技術約束第 6 條。
打對：光束槍射出一道柔和的暖黃色光柱（0.25 秒，不閃爍），葉子蟲被照到害羞地沿著絲爬回樹上消失、葉子飄落。
葉子蟲碰到蘑菇田就扣一顆愛心（api.loseLife()），那朵蘑菇被咬一小口（缺角），下一回合恢復。
連擊每 10 下，樹上的貓頭鷹睜眼說「守得好！」（2 秒後消失）。
```
