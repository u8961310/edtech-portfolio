# 給 Gemini 的生成規格（滑鼠島）

規劃：`docs/plans/2026-11-22-mouse-island-plan.html`；設計規範：`.interface-design/mouse-island-system.md`；外殼：`assets/js/mouse-ui.js`＋`assets/css/mouse-island.css`；範本：`assets/mouse/demo.html`。
組提示詞：`python tools/build-mouse-island-prompt.py <unit33> <輸出檔>`（共用段＋本關段＋設計規範＋範本）。
交件後：`tools/agy-extract.py` 拆出 HTML → 存成 `units/<資料夾>/index.html` → `python tools/build-mouse-font.py <BpmfHuninn ttf>` → 抽出注音句（`extract_zy.py` 做法）核對教育部《重編國語辭典修訂本》→ `python tools/test-mouse-scenes.py units/<資料夾>/` → 真的用滑鼠玩一次、對照本關「學習能力」與「鷹架檢核」。
教學理論：使用者 11-22 選「對應學習能力＋鷹架／難度漸進」（Gagné、ARCS 沒選，不硬加）；另要求「規劃也要有趣好玩」。

## 共用提示詞

```
【回覆方式】不要使用任何工具：不要建立或寫入檔案、不要執行指令、不要讀取資料夾。
直接把完整程式碼寫在你的文字回覆裡，用一個 ```html 區塊包住整個檔案，區塊後面附「鷹架檢核表」與「自檢表」。

你要為台灣國小（1–4 年級）滑鼠操作練習遊戲「滑鼠島」寫其中一關的網頁 index.html。
滑鼠島是一張海島尋寶地圖：7 關各練一個滑鼠技能（指向單擊→雙擊→拖拉→總複習→右鍵→滾輪→框選），練會一個技能，寶箱亮一顆寶石。吉祥物是戴船長帽的小寄居蟹「寄寄」。
這次你只負責「遊戲場景」：畫面、目標、操作偵測後的反應、好玩的效果。開始畫面、頂欄（首頁、段落名、三段進度膠囊、音效鈕）、寄寄與對話泡泡、
逐層提示的時機、手指示範動畫、結算畫面（星星、寶石落槽、成功率、圖鑑、交成績）、存檔，全部由已經寫好的共用程式 mouse-ui.js 處理，你不要重寫它們，也不要改它們的樣式。
你的工作是把這一關做得「好玩、一看就懂、目標清楚」，並且正確地接上共用程式。

【頁面結構 — 一定照這個骨架】
<!doctype html><html lang="zh-Hant"><head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>（本關名稱）- 滑鼠島</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap">
  <link rel="stylesheet" href="../../assets/css/mouse-island.css">
  <style> /* 只放場景樣式，class 一律用 sc- 開頭 */ </style>
</head><body>
  <script src="../../assets/js/mouse-ui.js"></script>
  <script> MouseIsland.mount({ ...見【本關設定】..., scene: function (api) { ...你的場景... } }); </script>
  <script defer src="../../assets/js/beacon.js"></script>
</body></html>
body 裡不要放其他 HTML：畫面由 MouseIsland.mount 產生。

【mount 要填的欄位】
unit、title、skill、gem、grade、zhuyin、howto、teach、hints、dex 照【本關設定】一字不改；
hero：開始畫面左邊的主角插圖（inline SVG 字串，約 400×400，畫這關的主題，可愛、簡單幾何、線條 #33261B 或 #6E4125）。

【共用程式給你的 api（scene 函式收到的參數）】
- api.field：場景容器 div，固定 1366×581 px（在 76px 頂欄下方），舞台會自動等比縮放，用 px 絕對定位
    ⚠️ 左下角「寄寄區」x < 560 且 y > 400 有寄寄和對話泡泡，目標、按鈕、文字都不要放進去
- api.cfg()：{ stage, big, assist, size, speed }。stage＝第幾段（0、1、2）；big＝3–4 年級在玩 1–4 年級的關；
    size／speed＝外殼建議的大小、速度倍率（第三段且 big 時 0.8／1.3；連續失手 6 次後 assist=true，變 1.4／0.6）。你的目標大小、移動速度要乘上它們
- api.stage()：目前第幾段
- api.hit()：操作對了（每個目標呼叫一次）
- api.miss()：操作錯了／沒按到（外殼會算連續失手次數，2 次、4 次、6 次自動呼叫你的 hint／assist，寄寄也會說提示句）
- api.stageDone()：這一段的目標都做完了（外殼會放「完成！」再進下一段，第三段做完就結算）
- api.demo(el, kind, opts) → Promise：外殼的手指示範動畫（白色大游標），不擋點擊。kind：
    'point'｜'click'｜'dblclick'｜'right'｜'drag'（opts.to＝要拖到的元素）｜'wheel'（opts.up=true 往上）｜'box'（opts.from、opts.to＝框的兩角 {x,y}，場景座標）
- api.glow(el, on)：目標發光（金色光暈＋深色虛線外圈），on=false 關掉
- api.say(text, { zy })：讓寄寄說話（say('') 收起）；注音關預設用注音字型，3–4 年級的句子給 { zy:false }。句子要短（≤ 14 字）
- api.wob(el)：讓元素晃一晃（失手的搞笑反應）
- api.sfx(name)：'pop'｜'ok'｜'giggle'｜'boing'｜'gem'（使用者打開音效才有聲音，預設關）
- api.collect(id)：收集到圖鑑的某一項（id 是 dex.items 的 key），第一次收到回傳 true；結算畫面會秀「新朋友」
- api.collected()：這台電腦已收集的 id 陣列
- api.later(fn, ms)：跟 setTimeout 一樣，但離開這一段時外殼會自動清掉
- api.zy：這關是否用注音；場景裡給 1–2 年級讀的字加 class="mi-zy"（字寬約 1.35em，不要擠）
- api.on(el, type, handlers, opts) → off()：**操作偵測一律用這個，不要自己寫 click／dblclick／contextmenu／wheel 事件**（7 關判斷標準要一致）
    'point'   游標停在 el 上 opts.dwell 毫秒（預設 300）→ handlers.ok(pos)；handlers.leave() 移開
    'click'   左鍵按一下 → ok(pos, e)（e.ctrlKey＝有按 Ctrl）；按到右鍵 → wrong('right')
    'dblclick' 雙擊 → ok(pos)；第一下 → first(pos)（讓目標晃一下）；只按一下等不到第二下 → single(pos)（算失手）；雙擊速度由老師設定
    'drag'    按住拖動放開 → start(pos)、move(pos, dx, dy)、drop(pos, target)（target＝opts.targets 裡放開位置的元素，沒有就 null）；
              沒拖就放開 → tap(pos)。拖動中 el 會自動跟著游標（opts.follow=false 可關掉自己處理）；放開後 el 會回原位，放對了要你自己把它移過去
    'right'   右鍵 → ok(pos)；按到左鍵 → wrong('left')；觸控是長按
    'wheel'   滾輪 → wheel(dy, e)（往下為正，單位 px）；觸控是手指上下滑
    'box'     在 el（容器）空白處拖出框 → move(rect)、select(items, rect, e)（items＝opts.items() 裡中心點在框內的元素）；框太小 → empty()；
              opts.background(target) 可自訂「哪裡算空白處」
    pos、rect 都是 el 內的 px（已換算舞台縮放）

【scene 函式要回傳的物件】
{ start(stage, cfg),   // 進入某一段時呼叫：清空 api.field，畫這一段的場景與目標
  hint(level),         // 外殼在連續失手 2 次呼叫 hint(1)：讓目前的目標 api.glow；4 次呼叫 hint(2)：再發光＋api.demo 重播示範
  assist(),            // 連續失手 6 次：把目前的目標放大、停下來或放慢（cfg.assist 已經是 true）
  stop() }             // 離開這段時呼叫：停掉所有 requestAnimationFrame、setInterval、移除 api.on 回傳的 off()、移除 document 上的監聽
同一個 scene 物件會被重複 start 不同段，每次 start 都要從乾淨的狀態開始。

【三段鷹架（一定照做，交件時要附鷹架檢核表）】
- 第一段「看我示範」：只有 1 個目標，大（約 200px 以上）、不會動、放在畫面中間偏上；start 時先 api.glow(目標) 再 api.demo(目標, 本關動作)；畫面乾淨，不放干擾物、不放搞笑元素
- 第二段「自己來」：3–5 個目標，一次出現一個，中等大小（約 120–160px），可以慢慢動；不主動提示
- 第三段「小挑戰」：5–6 個目標，小（約 70–100px），會動或有干擾物（干擾物點到不算失手，只是沒效果）；大小、速度乘 cfg.size／cfg.speed
- 失手的反應要好笑、不罵人：目標晃一晃（api.wob）、做鬼臉、彈回去、咯咯笑（api.sfx('giggle')），然後 api.miss()；不要用紅色叉叉、不要用「錯了」「失敗」這種字
- 對了的反應要有成就感：目標有動畫（打開、飛走、變成星星）＋ api.hit()

【好玩設計】
- 好玩的東西放在操作的結果上（按對、按錯都有可愛反應），不要放在目標旁邊搶眼睛；目標要永遠是畫面上最清楚的東西
- 每關有本關設定裡的「收集」：隨機出現、第一次收到用 api.collect(id)，讓孩子想重玩
- 第三段可以偶爾（約每 4 個目標一次）出現一個閃亮的「彩虹目標」，按到一樣 api.hit()，額外 api.collect 彩虹那一項
- 動畫不連續閃爍（每秒 ≤ 3 次）；尊重 prefers-reduced-motion（把位移動畫關掉，直接顯示結果）

【畫面規則】
- 照附件設計規範的色票：沙 #F6E7BE、羊皮紙 #FFF8E4、海 #BFE1EA、海藍 #236F96、珊瑚 #C2432A／#E8704F、棕櫚綠 #2F7A49、金 #F2B134、字 #33261B／#6B5A48、木 #9A5F36／#6E4125
- 圖案全部 inline SVG，簡單幾何組合，原創角色（不能像任何現有遊戲或卡通角色）；**不要用 emoji 當主要圖案**（Windows 上很醜）
- 文字對比 ≥ 4.5:1；不用純白大面積底、不用純黑字
- 右上角可以放一個小計數（例「蛋 2／5」），羊皮紙底＋木頭色框，跟範本一樣
- 不要另外畫首頁按鈕、段落膠囊、寄寄、結算畫面（外殼都有了）

【注音（只有 zhuyin: true 的關）】
- 1–2 年級會看到的字（計數、物品名、場景裡的字）加 class="mi-zy"；寄寄的話用 api.say（外殼自動用注音字型）
- 本關設定裡列出的注音句已經核對過讀音，**一字不改**；你自己新加的注音句要短，而且避開這些常讀錯的字：
  著、得、地、的（非句尾）、長、樂、重、行、還、背、教、數、只、為、什麼、怎麼、這麼、試試、看看、拖曳
- 不要用 <ruby>，不要自己排注音

【自檢表（附在程式碼後面，每項回答「有／沒有」並說明）】
1. 骨架、mount 欄位照規定，沒有改共用程式
2. 操作偵測全部用 api.on，沒有自己寫 click／dblclick／contextmenu／wheel
3. 三段各有幾個目標、大小、會不會動；第一段有 glow＋demo
4. hint(1)、hint(2)、assist、stop 各做了什麼
5. 失手的搞笑反應是什麼；有沒有用到紅叉或「錯」字（要沒有）
6. 收集怎麼出現；彩虹目標怎麼出現
7. 寄寄區（左下 x<560、y>400）有沒有放東西（要沒有）
8. 列出你新加的每一句注音字（注音關才要）
```

### unit33

```
【本關設定】敲敲蛋寶寶（新關）
資料夾：units/unit33-egg-tap/
mount 欄位：
  unit: 33, title: '敲敲蛋寶寶', skill: 'dblclick', gem: '雙擊', grade: '14', zhuyin: true,
  howto: '快快按兩下，把蛋敲開！',
  teach: '雙擊（快速連按兩下左鍵）｜生活 2-I-5、資E1',
  hints: ['按兩下要快一點喔！', '再看一次示範。'],
  dex: { name: '蛋寶寶圖鑑', total: 12, tip: '快去找彩虹蛋！', items: {
    chick: 小雞, duck: 小鴨, penguin: 小企鵝, turtle: 小烏龜, dino: 小恐龍, parrot: 小鸚鵡,
    ostrich: 小鴕鳥, owl: 小貓頭鷹, croc: 小鱷魚, lizard: 小蜥蜴, seaturtle: 小海龜, unicorn: 彩虹獨角獸 } }
  （items 寫成 { chick: { name: '小雞', svg: '<svg…>' }, … }，每隻一個 60×60 的可愛 SVG，unicorn 只從彩虹蛋孵出來）
學習能力：能快速連按兩下左鍵（雙擊），知道雙擊是用來「打開」東西（真的電腦上，雙擊可以打開資料夾和程式）。
操作：每顆蛋用 api.on(蛋, 'dblclick', { ok, first, single })。
  first：蛋晃一下（像被敲到）；single（只按一下就停了）：蛋咯咯笑、晃兩下 → api.miss()
  ok：蛋殼裂開、小動物蹦出來打招呼（隨機從還沒收集的優先）→ api.collect(id)＋api.hit()
  點到蛋以外的沙灘：不算失手（雙擊練習不要因為手抖點偏就扣）
三段：
  第一段 1 顆大蛋（約 240px）在巢裡、不動；start 時 glow＋demo('dblclick')
  第二段 4 顆蛋，一次出現一顆（約 150px），在沙灘上輕輕左右搖
  第三段 5 顆蛋同時在畫面上（約 90px），只有發光的那顆要敲（其他蛋是干擾物，點到它們只會眨眼，不算失手）；
         每敲開一顆換另一顆發光；約每 4 顆出現一次彩虹蛋（敲開孵出 unicorn）
hint(1)：目前的蛋 glow；hint(2)：glow＋demo('dblclick')；assist：蛋放大到 1.4 倍、停止搖動
好玩：孵出來的小動物會揮手、跳一下再走到畫面右側排隊（第三段結束時大家一起歡呼）；蛋只按一下會咯咯笑
場景：海邊沙灘＋一個稻草巢（第一段），右上角計數「蛋 1／5」（mi-zy）
```

### unit34

```
【本關設定】右鍵魔法師（新關，3–4 年級，不用注音）
資料夾：units/unit34-right-click-wizard/
mount 欄位：
  unit: 34, title: '右鍵魔法師', skill: 'right', gem: '右鍵', grade: '34', zhuyin: false,
  howto: '在魔法道具上按右鍵，從選單選出正確的魔法！',
  teach: '右鍵選單（按右鍵看看能對它做什麼）｜資E1、資E2',
  hints: ['在道具上按滑鼠右邊的鍵', '再看一次示範'],
  dex: { name: '魔法道具圖鑑', total: 8, tip: '每次玩都有機會找到新道具', items: 8 種魔法道具（魔法書、藥水瓶、水晶球、魔杖、魔法帽、星星燈、飛天掃帚、彩虹藥水；彩虹藥水只從彩虹目標出現） }
學習能力：能在物件上按右鍵叫出選單並選對指令，知道右鍵是「看看能對這個東西做什麼」；最後一段的選單跟電腦一樣（開啟、複製、重新命名、刪除）。
操作：道具用 api.on(道具, 'right', { ok, wrong })。ok → 在游標位置跳出你自己畫的「右鍵選單」（像電腦的選單：白底、細灰框、陰影、每項 44px 高，滑鼠移上去反白）；
  wrong('left')（按了左鍵）→ 道具彈一下、魔法師說「要按右邊的鍵喔」（api.say(…, { zy:false })）→ api.miss()
  選單項目用 api.on(項目, 'click', { ok }) 選：選對 → 魔法生效＋api.hit()；選錯 → 發生好笑的魔法（藥水變超大塞滿畫面、魔法書長出翅膀亂飛、帽子變出一隻青蛙呱一聲）1 秒後自動變回來 → api.miss()
  每題畫面上方有任務條（你自己的 sc- 樣式），例「把藥水瓶變大」
三段：
  第一段 1 個大道具（魔法書）＋任務「打開魔法書」，選單只有 2 項（打開、關上）；start 時 glow＋demo('right')
  第二段 4 題，道具中等，選單 3 項（變大、變色、收起來 這類魔法）
  第三段 4 題，畫面上 3–4 個道具，要先找對道具再按右鍵；選單換成電腦的樣子：開啟、複製、重新命名、刪除（任務例「幫魔法書改名字」→ 重新命名、「把空瓶子丟掉」→ 刪除、「再多一瓶藥水」→ 複製）；
         第三段做完寄寄說「電腦上也可以這樣按喔」（api.say(…, { zy:false })）
hint(1)：目前的道具 glow；hint(2)：glow＋demo('right')；assist：道具放大、選單項目字放大到 22px
好玩：選錯的魔法要好笑但 1 秒內變回來；選對有閃光和音效
場景：魔法帳篷裡的木頭桌（暖色、亮），道具放在桌上
```

### unit35

```
【本關設定】海底捲捲探險（新關，3–4 年級，不用注音）
資料夾：units/unit35-scroll-sea/
mount 欄位：
  unit: 35, title: '海底捲捲探險', skill: 'wheel', gem: '滾輪', grade: '34', zhuyin: false,
  howto: '轉動滑鼠滾輪，開著潛水艇往深海找寶物！',
  teach: '滾輪捲動與縮放｜資E1、資E2',
  hints: ['用食指轉動滑鼠中間的滾輪', '再看一次示範'],
  dex: { name: '海底寶箱', total: 10, tip: '越深的地方寶物越稀有', items: 10 種海底寶物（珍珠、海星、貝殼、珊瑚、金幣、古老的鑰匙、發光水母、小章魚、船錨、彩虹珍珠；彩虹珍珠只從彩虹目標出現） }
學習能力：能用滾輪上下捲動找到內容，並知道滾輪也能放大縮小（真的電腦上，看長長的網頁、地圖都會用到）。
操作：用 api.on(海的視窗, 'wheel', { wheel(dy) }) 控制「海的捲動位置」（自己算 scrollY，畫面上的海底場景整片往上下移；不要用瀏覽器原生捲動）。
  寶物用 api.on(寶物, 'click', { ok }) 撿：撿到 → api.collect＋api.hit()。
  失手判斷：捲過頭（寶物已經捲出畫面還沒撿）不算失手；**點到沒有寶物的海水**才算 api.miss()（水泡泡一圈、魚嚇一跳）
三段：
  第一段 只要往下捲：深度 1 個畫面高，寶物在最下面一個（大）；start 時 glow 寶物方向的箭頭＋demo('wheel')
  第二段 要上下來回：深度 3 個畫面高，4 個寶物分散，有 1 個在上面要往回捲（畫面右側有一條深度尺顯示現在多深、寶物在哪一層）
  第三段 放大縮小：一張海圖，用滾輪放大（往上滾＝放大、往下滾＝縮小，畫面寫清楚），找到躲在石頭後面的 5 隻小章魚（縮小時看不到，放大才看得到）
hint(1)：下一個寶物所在方向的箭頭 glow；hint(2)：glow＋demo('wheel', { up: 寶物在上面時 })；assist：捲動一次移動距離變 2 倍、寶物放大
好玩：越往下光線越暗，深海有發光的魚（但寶物一定清楚）；捲太快（一次 dy 很大）潛水艇會轉一圈頭暈；撿到寶物潛水艇吐泡泡
場景：海面→淺海（藍）→深海（深藍，但字和寶物要看得清楚，對比 ≥ 4.5:1）
```

### unit36

```
【本關設定】牧場圍圍樂（新關，3–4 年級，不用注音）
資料夾：units/unit36-box-farm/
mount 欄位：
  unit: 36, title: '牧場圍圍樂', skill: 'box', gem: '框選', grade: '34', zhuyin: false,
  howto: '按住滑鼠拉出框框，把羊群圍進柵欄！',
  teach: '框選與 Ctrl 多選（一次選好幾個）｜資E1、資E8',
  hints: ['在空地按住滑鼠左鍵，拉出一個框', '再看一次示範'],
  dex: { name: '牧場朋友', total: 8, tip: '有些朋友很少出現喔', items: 8 種農場動物（白羊、黑羊、捲毛羊、小羊、牧羊犬、母雞、小豬、彩虹羊；彩虹羊只從彩虹目標出現） }
學習能力：能在空白處拖出框一次選很多個、按住 Ctrl 點選挑出幾個，整理一群東西（真的電腦上，一次選好幾個檔案也是這樣做）。
操作：草地用 api.on(草地, 'box', { select(items, rect, e), empty }, { items: () => 目前的羊 })。
  select：items 全部是任務要的羊 → 這群羊走進柵欄＋api.hit()；框到了不該框的（例：小狼）→ 小狼「嗷」一聲掀開羊皮、羊群嚇得散開 → api.miss()；
  框到 0 隻 → 不算失手（羊歪頭看你）
  第三段的 Ctrl 多選：每隻羊用 api.on(羊, 'click', { ok(pos, e) })，e.ctrlKey 才算加選（被選的羊頭上出現勾勾）；沒按 Ctrl 點第二隻 → 前面選的取消（跟電腦一樣）＋寄寄提示「按住 Ctrl 再點」（api.say(…, { zy:false })）
  選好按畫面上的「趕進柵欄」按鈕（你自己畫，api.on(按鈕, 'click')）
三段：
  第一段 3 隻羊站在一起、不動，框起來就好；start 時 glow 羊群＋demo('box', { from: 羊群左上外面, to: 羊群右下外面 })
  第二段 4 題，羊群（4–6 隻）旁邊混了一隻披羊皮的小狼（耳朵尖尖、尾巴露出來看得出來），框的時候要避開牠；羊會慢慢走動
  第三段 4 題，白羊黑羊混在一起，任務「只把白羊趕進柵欄」：要按住 Ctrl 一隻一隻點白羊；做完寄寄說「電腦上選好幾個檔案也是這樣」（api.say(…, { zy:false })）
hint(1)：要選的羊 glow；hint(2)：glow＋demo（第一、二段 'box'，第三段 'click'）；assist：羊停止走動、羊變大
好玩：羊會吃草、互相推擠、偶爾咩一聲；全部圍好羊群一起咩咩合唱（音符飄起來）
場景：綠色草地＋木頭柵欄（右邊），天空藍
```

## 舊 3 關（M4：換新外殼重做，整檔取代舊版）

注音句 11-22 萌典核過；`蘿蔔` 的 蔔、`泡泡` 兩字要補 IVS（U+E01E1，第二讀音），交件後我自己補，Gemini 照一般字寫。玉米（米 輕聲畫不出）改番茄、蘑菇（菇 輕聲畫不出）改香菇。
舊版拿掉的內容：unit21 的手電筒探險、吸塵器大掃除（垃圾分類改由 unit19 第三段的分類拖拉接手）；unit19 的鍵盤字母拔菜（打字島已有 8 關）；unit2 的血條、計時、紅蘿蔔補血。

### unit21

```
【本關設定】滑鼠勇士（重做舊關，1–2 年級，注音）
資料夾：units/unit21-mouse-challenge/（整檔取代舊版，舊版的東西都不要留）
mount 欄位：
  unit: 21, title: '滑鼠勇士', skill: 'click', gem: '指向單擊', grade: '12', zhuyin: true,
  howto: '移過去叫醒貓咪，再按一下餵牠！',
  teach: '指向與單擊（移動游標、按一下左鍵）｜生活 2-I-5、資E1',
  hints: ['把游標移到目標上，按一下左鍵', '再看一次示範。'],
  dex: { name: '貓咪點心圖鑑', total: 8, tip: '快去找彩虹魚！', items: {
    fish: 小魚乾, milk: 牛奶, salmon: 鮭魚, shrimp: 小蝦, chicken: 雞肉, cheese: 起司, cookie: 餅乾, rainbow: 彩虹魚 } }
  （items 寫成 { fish: { name: '小魚乾', svg: '<svg…>' }, … }，每樣一個 60×60 的可愛 SVG，rainbow 只從彩虹目標出現）
學習能力：能移動游標指到目標（指向），並在目標上按一下左鍵（單擊）；知道電腦上的按鈕、圖示都是這樣按。
操作：
  指向：api.on(貓咪, 'point', { ok }, { dwell: 400 })：游標停在貓咪身上 → 貓咪睜眼伸懶腰「喵～」醒來
  單擊：api.on(點心, 'click', { ok, wrong })：ok → 點心飛進貓咪嘴裡、貓咪開心吃（嚼嚼、愛心飄起）→ api.collect（隨機，還沒收集的優先）＋api.hit()；
        wrong('right')（按到右鍵）→ 點心晃一下 → api.miss()
  點到地板空白處（api.on(地板, 'click')，只算地板本身，不算點心或貓咪）→ 貓咪歪頭「喵？」、點心彈一下 → api.miss()
  第三段的魚骨頭是干擾物：點到 → 貓咪做鬼臉吐舌頭，不算失手、也不算對
三段：
  第一段 1 隻大貓（約 260px）睡在畫面中間偏上的墊子上、不動。先 glow 貓咪＋demo('point') → 指向叫醒後，貓咪面前出現一大碗點心（約 200px）→ glow 碗＋demo('click') → 按一下就吃 → stageDone
  第二段 4 份點心，一次出現一份（約 130px），出現在貓咪旁邊不同位置、慢慢左右飄；貓咪醒著，頭會跟著游標轉
  第三段 5 份點心放在一張「冰冰滑滑」的大盤子上會滑來滑去（約 80px，速度乘 cfg.speed、大小乘 cfg.size），另有 2 根魚骨頭一起滑；
         約每 4 份出現一次彩虹魚（按到 api.collect('rainbow')）；做完寄寄說「電腦上的按鈕，也是這樣按！」再 stageDone（延 3 秒）
hint(1)：目前的目標 glow；hint(2)：glow＋demo（第一段叫醒前是 'point'，其他都是 'click'）；assist：目標放大 1.4 倍、停止滑動
好玩：睡著的貓咪會打呼（Zzz 飄起），游標靠近時耳朵會動；醒著的貓咪頭會跟著游標轉、偶爾伸手抓；第三段點心滑走時貓咪急得跳來跳去
場景：溫暖的小木屋地板＋貓咪墊子；右上角計數「點心 1／5」（mi-zy）
你新加的注音句只能從這些挑（已核過）：「貓咪醒來了」「點心」「喵」
```

### unit19

```
【本關設定】拔蔬菜（重做舊關：原本是鍵盤遊戲，改成滑鼠拖拉；1–4 年級，注音）
資料夾：units/unit19-farm-harvest/（整檔取代舊版，舊版的鍵盤玩法都不要留）
mount 欄位：
  unit: 19, title: '拔蔬菜', skill: 'drag', gem: '拖拉', grade: '14', zhuyin: true,
  howto: '按住蔬菜往上拉，拖進菜籃！',
  teach: '拖拉（按住左鍵移動再放開）｜生活 2-I-5、資E1',
  hints: ['按住不要放開，再移動滑鼠', '再看一次示範。'],
  dex: { name: '菜園圖鑑', total: 8, tip: '偶爾會拔到金蘿蔔！', items: {
    carrot: 紅蘿蔔, radish: 白蘿蔔, potato: 馬鈴薯, tomato: 番茄, onion: 洋蔥, pumpkin: 南瓜, hat: 戴帽蘿蔔, gold: 金蘿蔔 } }
  （items 寫成 { carrot: { name: '紅蘿蔔', svg: '<svg…>' }, … }，每樣一個 60×60 的可愛 SVG；gold 只從彩虹目標（金色發光的蔬菜）出現，hat 是隨機的小驚喜）
學習能力：能按住左鍵、移動、再放開（拖拉），把東西放到指定的位置；知道電腦上搬檔案、移動圖示也是用拖拉。
操作：每棵蔬菜用 api.on(蔬菜, 'drag', { start, move, drop, tap }, { targets: [菜籃們] })。
  拔：蔬菜一開始只露出葉子在土裡。start → 蔬菜被抓住；move 往上拉時蔬菜像橡皮筋被拉長，拉超過 80px 就「啵」一聲拔出來（拔出來後繼續跟著游標）
  drop(pos, target)：target 是對的菜籃 → 蔬菜跳進籃子 → api.collect＋api.hit()；
        放在別的地方（target 是 null）→ 蔬菜「咚」掉回原位、晃一晃 → api.miss()；
        放進錯的籃子（第三段）→ 蔬菜從籃子裡跳出來搖頭 → api.miss()
  tap（只按一下沒拖）→ 葉子抖一抖、咯咯笑 → api.miss()
三段：
  第一段 1 棵大紅蘿蔔（約 220px，含葉子）在畫面中間的土裡，菜籃（約 220px）在右邊；glow 蘿蔔＋demo('drag', { to: 菜籃 }) → 拔起來拖進籃子 → stageDone
  第二段 4 棵蔬菜，一次出現一棵（約 140px），種在不同位置；菜籃在右邊，菜籃會慢慢左右移動
  第三段 5 棵不同的蔬菜（約 90px，乘 cfg.size）同時種在田裡，右邊 3 個菜籃各貼一張蔬菜圖＋名字（紅蘿蔔籃、番茄籃、南瓜籃，mi-zy），
         每棵要拖進對的籃子（只出這 3 種蔬菜＋偶爾的戴帽蘿蔔算紅蘿蔔籃）；約每 4 棵出現一次金色發光的蔬菜（拖進任何籃子都算，api.collect('gold')）；
         有 1 隻小烏鴉在田邊走來走去當干擾物（拖到牠身上沒效果、不算失手）；做完寄寄說「電腦上搬檔案，也是這樣拖！」再 stageDone（延 3 秒）
hint(1)：目前的蔬菜 glow；hint(2)：glow＋demo('drag', { to: 對的菜籃 })；assist：蔬菜和菜籃放大、菜籃停止移動、拉出來的門檻變 40px
好玩：拉長像橡皮筋、啵一聲拔出來帶起一點土；偶爾拔出戴帽子的蘿蔔；放進籃子時籃子彈一下；第三段做完菜籃裡的蔬菜一起跳舞
場景：藍天＋菜園土壤（棕色田畦）＋木頭菜籃；右上角計數「菜 1／5」（mi-zy）
你新加的注音句只能從這些挑（已核過）：「菜籃」「紅蘿蔔籃」「番茄籃」「南瓜籃」「菜 1／5」
```

### unit2

```
【本關設定】小兔勇者（重做舊關：基本操作總複習；1–4 年級，注音）
資料夾：units/unit2-mouse-adventure/（整檔取代舊版，舊版的血條、計時、補血都不要留）
mount 欄位：
  unit: 2, title: '小兔勇者', skill: 'mix', gem: '總複習', grade: '14', zhuyin: true,
  howto: '看招式卡，用對動作打敗魔王！',
  teach: '綜合複習：指向、單擊、雙擊、拖拉（依情境選對操作）｜生活 2-I-5、3-I-3、資E13',
  hints: ['先看招式卡，再出招！', '再看一次示範。'],
  dex: { name: '怪物朋友圖鑑', total: 8, tip: '魔王也想當朋友！', items: {
    mushroom: 香菇怪, bat: 小蝙蝠, rock: 岩石怪, ghost: 小幽靈, dragon: 小火龍, cloud: 烏雲怪, boss: 魔王, rainbow: 彩虹泡泡怪 } }
  （items 寫成 { mushroom: { name: '香菇怪', svg: '<svg…>' }, … }，每隻一個 60×60 的可愛（不可怕）SVG；被打敗的怪物變成朋友收進圖鑑；boss 只在第三段打完魔王收到；rainbow 只從彩虹目標出現）
學習能力：能看情境選對滑鼠操作（指向、單擊、雙擊、拖拉），把前三關練過的動作串起來用；感受到「我都學會了」的成就感。
招式卡（畫面上方中間一張大卡，圖示＋名字＋動作，mi-zy）：
  指指光（移過去）→ 怪物躲在草叢／暗處，api.on(怪物, 'point', { ok }, { dwell: 500 })：游標停在上面 = 小兔的燈照到牠 → 怪物嚇一跳現身投降
  點點拳（按一下）→ api.on(怪物, 'click', { ok, wrong })
  雙擊拳（按兩下）→ api.on(怪物, 'dblclick', { ok, first, single })；single（只按一下）→ 怪物咯咯笑 → api.miss()
  拖拖盾（拖拉）→ 小兔旁邊有一面盾牌，api.on(盾牌, 'drag', { drop, tap }, { targets: [怪物] })：把盾牌拖到怪物身上 → 怪物被彈飛（轉圈圈）；放錯地方 → 盾牌飛回 → api.miss()
  每個目標只掛「目前招式卡」那一種偵測；用錯招（例如該雙擊卻只按一下、該拖卻只點盾牌）→ 怪物做鬼臉 → api.miss()
  怪物被打中都不會受傷：打噴嚏、轉圈、帽子歪掉，然後變成朋友揮手 → api.collect（隨機，還沒收集的優先）＋api.hit()
三段（第一段的畫面右下要清楚，左下是寄寄區）：
  第一段「森林」4 隻大怪物（約 200px），一次一隻，招式依序 指指光 → 點點拳 → 雙擊拳 → 拖拖盾；每隻出現時先 glow＋demo 那一招（拖拖盾 demo('drag', { to: 怪物 })）；怪物不動
  第二段「山洞」5 隻怪物（約 130px），一次一隻，招式隨機（4 招都要出現至少 1 次），怪物慢慢飄；不主動示範
  第三段「魔王城」魔王（約 220px，戴歪歪的大帽子，可愛不可怕）有 6 顆愛心，每打中一次換一張招式卡（4 招都要出現），魔王在畫面上方左右移動（乘 cfg.speed）；
         中途約每 4 次出現一個彩虹泡泡怪飛過（按一下就好，api.collect('rainbow')，這隻也算 api.hit()）；
         魔王旁邊的小火球是干擾物（點到沒效果、不算失手）；最後一顆愛心打掉 → 魔王投降、摘下帽子鞠躬變成朋友（api.collect('boss')）
         → 畫面中間出現「小兔勇者證書」卡（寫「你學會指向、單擊、雙擊、拖拉」，下方「收下證書」按鈕用 api.on(按鈕, 'click')）→ 按了才 stageDone
hint(1)：目前的目標（拖拖盾是盾牌）glow；hint(2)：glow＋demo 目前那一招；assist：怪物放大 1.4 倍、停止移動；雙擊拳卡在 assist 時改成點點拳
好玩：招式卡翻牌動畫（像抽卡）；小兔每次出招喊一聲（招式名字飄起來）；魔王被打中會打噴嚏、帽子越來越歪；最後大家（收到的怪物朋友）一起出來歡呼
場景：三段背景不同：森林（綠）→ 山洞（暖棕＋油燈，不要黑暗）→ 魔王城（淡紫＋旗子，亮亮的不可怕）；小兔勇者（原創：白兔、紅披風、木劍）站在畫面右下方；
      右上角計數：第一、二段「1／4」「1／5」，第三段「魔王 6／6」（愛心數，mi-zy）
你新加的注音句只能從這些挑（已核過）：「點點拳」「雙擊拳」「拖拖盾」「指指光」「按一下」「按兩下」「拖拉」「移過去」「森林」「山洞」「魔王城」「魔王」「小兔勇者證書」「你學會指向、單擊、雙擊、拖拉」「收下證書」
```
