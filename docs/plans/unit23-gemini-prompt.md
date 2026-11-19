# 給 Gemini 的生成規格（unit23 打字擂台）

用法：Claude 用 Antigravity CLI（`agy`，唯讀模式）送出「提示詞」，**後面接著附上 `docs/plans/mockups/unit23-mockup-b.html` 全文**（使用者 11-19 選定的 B 版），
擷取回傳的 HTML 存成 `units/unit23-typing-duel/index.html`，再跑：
- `python board/verify-canvas.py units/unit23-typing-duel/index.html --unit 23`（QUESTIONS 兩項 FAIL 屬預期：本單元沒有選擇題）
- `python tools/check-no-scroll.py`（1366×657 等尺寸不捲動）
- 瀏覽器實測：對電腦練習打完一局（中打、英打各一次），console 0 錯誤

技術約束沿用 `board/CANVAS_PROMPT.md` v3 與 unit22 回寫的缺陷；本單元新增「遊戲邏輯一律呼叫 DuelCore」。
介面規格：`docs/specs/unit23-duel-protocol.md`（第 2、3 節原文已併進提示詞）。

---

## 提示詞

```
【回覆方式】不要使用任何工具：不要建立或寫入檔案、不要執行指令、不要讀取資料夾。
直接把完整程式碼寫在你的文字回覆裡。

請做一個給台灣國小學生（主要三、四年級）的雙人打字對戰網頁遊戲「打字擂台」，單一 HTML 檔。
訊息最後附了一份設計稿 unit23-mockup-b.html（老師已選定的版面），請照它的視覺風格、配色、
版面配置與元件造型來做，但它只是靜態示意，程式要你重新完整寫出可以玩的版本。

【主要使用情境 — 先讀這段再設計版面】
學生在學校電腦教室，一人一台筆電（可視區約 1366×657），兩個人各用自己的電腦連線對打；
沒有對手時也可以「對電腦練習」。橫向寬螢幕是唯一主版面，每個畫面都要一屏放得下、不能上下捲動。
平板或手機（沒有實體鍵盤）進來時，顯示一張提示卡「打字擂台要用有鍵盤的電腦玩」即可，不用做直立版。

【畫面風格 — 照設計稿】
卡通格鬥擂台風：米黃底、深靛墨色粗描邊、硬陰影、黃黑警示斜條紋、藍（自己）紅（對手）兩角、
金黃主按鈕。角色頭像沿用設計稿裡的 SVG 小人（頭巾藍／紅），要會眨眼，被打中時會皺眉晃一下。
字體：介面用 Noto Sans TC，數字用 Fredoka（Google Fonts）。

【設計稿要改的兩點】
1. 打錯第 2 次的提示「不要」用浮在文章上方的黑色氣泡（會蓋住別的字和注音）。
   改成固定在文章框下緣的一條提示列：左邊寫「這個字唸 ㄧㄝˋ」，右邊把按鍵畫成鍵帽 [U] [,] [4]。
2. 已經打對的字不要用綠色底塊（整篇太花），改成字變淡綠色、底色不變。

【畫面流程】
① 開場大廳
   - 上方：標題「打字擂台」、目前暱稱與「換暱稱」（暱稱最多 8 個字，存瀏覽器）。
   - 兩個大入口：「連線對戰」與「對電腦練習」。
   - 連線對戰：
     「建立擂台」→ 顯示 4 格大房號，等對手進來；「有房號？來挑戰」→ 輸入 4 位數加入。
     ⚠️ 連線功能之後才開放：如果 DuelCore.netAvailable() 回傳 false，這兩個按鈕要變灰、
     顯示「連線對戰即將開放，先對電腦練習吧！」，不可以點了才報錯。
   - 對電腦練習：直接進房間，對手是「機器人」，另外可選機器人強度：慢慢來／普通／很厲害。
② 房間（房主看得到設定，非房主只能看）
   - 打字方式：英打 ABC／中打 ㄅㄆㄇ
   - 年級：低年級／中年級／高年級
   - 領域：從 DuelCore.domains(lang, grade) 取得清單，再加一個「隨機」（值為 'random'）
   - 時間：60／90／120 秒（預設 90）
   - 讓分：開關，說明「開啟：速度慢的人血量多一點，打起來更公平」
   - 雙方座位卡（藍角自己、紅角對手，VS），房主按「開始對戰！」
③ 倒數 3、2、1、開打（大字加擂台鐘聲）
④ 對戰中（照設計稿第 2 個畫面）
   - 上方：雙方頭像、暱稱、血條（分格）、中央圓形倒數秒數、領域與標題標籤、本局目標「正確率 90% 以上」
   - 雙方文章進度條（打對的字數／目前這篇總字數）
   - 中間：大面積文章，目前要打的字要明顯框起來（設計稿的紅框樣式）
   - 下方：輸入框、連擊數與傷害加成、提示階梯 ①字框紅閃 ②顯示按鍵 ③鍵盤圖
   - 打對：對手血條減少、我方頭像出拳、對手頭像晃動、飄出傷害數字；連擊 10 以上傷害數字變金色並加大
   - 打錯：字框紅閃（第 1 次）→ 提示列顯示讀音與鍵帽（第 2 次）→ 畫出一排簡化鍵盤，標亮要按的鍵（第 3 次以上）
⑤ 結算（照設計稿第 3 個畫面）
   - 最大的區塊是「你比上次進步了！」：打字速度（每分鐘字數）上一局 → 這一局、正確率上一局 → 這一局，
     用大數字加「+8」貼紙。第一次玩沒有上一局時，改寫「這是你的第一筆紀錄！」。
   - 本局目標有沒有達成、下一局目標建議（例如連擊 15 字）。
   - 勝負只用一條小緞帶（「小明 獲勝」或「平手」），雙方成績對照放右側小卡。
   - 錯字回顧：每個錯字一張小卡（字＋錯幾次），點了會顯示它的按鍵。
   - 按鈕：「再練這幾個字」（回房間並自動開對電腦練習）、「再來一局」、「回大廳」。

=============== 遊戲邏輯：一律呼叫 DuelCore，不要自己寫 ===============

頁面要依序載入這幾支同資料夾的 JS（它們已經寫好，你不用寫也不要把內容貼進來）：
  <script src="passages.js"></script>
  <script src="duel-rules.js"></script>
  <script src="duel-core.js"></script>
  <script src="duel-net.js" onerror="void 0"></script>
注音字型（同資料夾，已備好）：
  @font-face { font-family: 'Bpmf Huninn'; src: url('fonts/bpmf-huninn-duel.woff2') format('woff2'); font-display: swap; }
  只套在「目標文章」與「錯字回顧的字」：font-family: 'Bpmf Huninn', 'Noto Sans TC', sans-serif;
  字型會自動在每個字右側畫注音，不要再用 <ruby> 或自己標注音。
  文章字級 32～36px；因為注音在字的右側，字會比較寬，排版時要預留。

(1) 對手介面（對電腦與連線用法完全相同，畫面不用分兩套）
  const t = DuelCore.createBotTransport({ level: 'easy' | 'normal' | 'hard' });   // 對電腦
  const t = DuelCore.createNetTransport({});                                       // 連線（netAvailable() 為 true 時才用）
  方法：
    t.create({ nick, best })     開房（best＝本機個人最佳每分鐘字數，沒有就 0）
    t.join(code, { nick, best }) 用房號加入
    t.setSettings({ lang:'zh'|'en', grade:'low'|'mid'|'high', domain, duration:60|90|120, handicap:true|false })
    t.start()                    房主開打
    t.progress(pos, miss)        每次打字後回報（直接傳 tracker.pos、tracker.miss）
    t.rematch() / t.leave()
    t.now()                      倒數與計時一律用這個時間，不要用 Date.now()
    t.on(事件, fn)
  事件：
    'room'      { code, mode:'bot'|'net', settings, you:{id,isHost}, players:[{id,nick,role,connected,isBot}] }
    'countdown' { startsAt, duration, settings, seq:[文章id], players:[{id,nick}], maxHp:{ id:{hp,maxHp} } }
    'state'     { remaining, players:{ id:{hp,maxHp,pos,combo} } }        約每 0.2 秒一次，血條與秒數照這個畫
    'hit'       { from, to, damage, combo }                               播攻擊動畫用
    'end'       { winner: id 或 null（平手）, players:[{id,nick,chars,miss,cpm,acc,hp,maxHp,maxCombo}] }
    'left'      { id }                                                    對手離開
    'error'     { code, message }                                         把 message 顯示出來
  血量、傷害、勝負全部由 DuelCore 算，畫面只負責顯示，不要自己扣血或判勝負。

(2) 打字比對器（收到 countdown 後建立）
  const tr = DuelCore.createTracker(countdown.seq, settings.lang);
  tr.current() → { passage, index, ch, zhuyin, tier }    目前要打的字；passage.title、passage.domain、passage.text
  中打（lang 'zh'）：學生用 Windows 注音輸入法
    監聽 compositionstart / compositionend；組字中不要比對、不要清空。
    compositionend 之後（用 setTimeout 0 等值更新），或沒有在組字時的 input 事件，
    把輸入框整串丟 tr.commit(輸入框文字)，然後清空輸入框。
  英打（lang 'en'）：keydown 時 e.key.length === 1 就丟 tr.key(e.key) 並 preventDefault()。
  兩者都回傳 { correct, wrong, tier, passageDone }，接著呼叫 t.progress(tr.pos, tr.miss)。
    wrong 為 true → 依 tier 顯示提示：1＝字框紅閃；2＝提示列（讀音＋鍵帽）；3 以上＝鍵盤圖
    passageDone 為 true → 換下一篇（重畫文章、標題）
  中打的標點會自動跳過，學生不用打；英打的空白與標點都要打。
  顯示文章時每個字用 DuelCore.displayChar(passage, i) 取得要顯示的字串（破音字會多一個看不見的選字符號，
  不要把它濾掉，否則注音會標錯）；DuelCore.isAuto(passage, i) 為 true 的字（標點）照常顯示但不會成為目前字。
  鍵帽：中打 DuelCore.zhKeys(zhuyin) → [{ sym:'ㄧ', key:'U' }, …]；英打 DuelCore.enKey(ch) → { key:'W', shift:true }
  錯字回顧：tr.mistakes() → [{ ch, zhuyin, count }]

=============== 以下是技術約束，請務必遵守 ===============

1. 單一 HTML 檔，自己的 CSS / JS 全部內嵌；外部只允許上面那 4 支同資料夾 JS、同資料夾字型、Google Fonts。
   不要用任何建置工具或框架。
2. 不要引用任何外部圖片、音效、影片檔。插畫用 inline SVG 或 CSS；音效用 Web Audio API 即時合成
   （擂台鐘、出拳、受擊、連擊、勝利），預設開啟，右上角可以關閉。
3. emoji 只能用 2015 年以前就有的（例如 ⭐ 🔔 ⏰ 🎉 🔊 🔇 ✋），不要用 2016 年後的新 emoji（教室是舊版 Windows）。
4. 成績存 localStorage，key 一律用這個前綴，讀寫都包 try/catch，讀不到就當第一次玩：
       edtech-unit23-score   （數字：歷史最高「每分鐘字數」，只在打破紀錄時更新；首頁徽章讀這個）
       edtech-unit23-best    （JSON：{ zh:{cpm,acc}, en:{cpm,acc} } 各自的最佳）
       edtech-unit23-last    （JSON：{ zh:{cpm,acc}, en:{cpm,acc} } 上一局，結算頁「進步多少」用）
       edtech-unit23-nick    （字串：暱稱）
   create/join 時的 best 傳該語言的 best.cpm。
5. 必須支援 @media (prefers-reduced-motion: reduce)：關閉所有動畫，遊戲仍可玩。
6. 每個畫面在 1366×657、1280×720、1280×800 都要一屏放得下、不能捲動（高度不要寫死成 700px 之類的固定值，
   用 vh／clamp 或 flex 分配）。
7. 字級：文章 32～36px、說明文字至少 18px、按鈕文字至少 18px；資訊文字與背景對比至少 4.5:1。
8. 所有可點擊元素要有 cursor: pointer 與明顯的 hover／按下回饋；鍵盤 Tab 可以操作大廳與結算頁的按鈕。
9. 彈出視窗關閉時，不可以只用 opacity:0 + pointer-events:none，要一併 visibility:hidden（或 inert）。
10. 不要做姓名、學校、班級欄位，也不要做證書；只有暱稱。
11. SVG 的 points 屬性只接受數字，不接受百分比。
12. 若用 <span> 當方塊（鍵帽、字格）並設寬高，記得 display:inline-block 或 block（inline 不吃寬高）。
13. 交件前 console 不能有任何錯誤（包括 duel-net.js 不存在時）。
14. 程式碼加中文註解；面向使用者的文字（標題、按鈕、鼓勵語）集中成一個常數物件 TEXT，方便老師修改。
15. 左上角留 120×44px 的空白不要放東西（整合時會放「回首頁」按鈕）。
16. 對戰中輸入框要一直保持焦點（失焦 0.2 秒後自動拉回）；禁止貼上與拖放文字到輸入框（paste、drop 事件 preventDefault）。

=============== 交件格式 ===============

只回覆兩樣東西：
(1) 一個完整的 ```html 程式碼區塊（從 <!DOCTYPE html> 到 </html>，不要省略任何部分，不要寫「其餘同上」）
(2) 程式碼後面附自檢表，逐條列出上面 16 條技術約束是否做到，做不到的說明原因。

=============== 設計稿 unit23-mockup-b.html（照它的視覺，程式要重寫） ===============
```

（送出時在這裡接上 mockup-b.html 全文）
