# unit23 打字擂台：介面與連線規格

> 2026-11-19 M2。計畫頁：https://claude.ai/artifact/SCJBZjKWhCjew1VHfqG7iE
> 程式：`units/unit23-typing-duel/`（`duel-rules.js` 規則、`duel-core.js` 核心、`passages.js` 題庫）；測試 `node tools/test-duel-core.js`

## 0. 分層

```
index.html（Gemini 產：畫面、動畫、音效、輸入事件）
   │  只呼叫 DuelCore，不自己算分、不自己連網
duel-core.js（Claude：對手介面、打字比對器、按鍵提示）
   │                        │
createBotTransport          createNetTransport（M4，duel-net.js）
   │ 本機當裁判               │ WebSocket
duel-rules.js  ◄────同一份────►  duel-worker（Cloudflare Durable Object）
```

規則只寫在 `duel-rules.js`，本機練習與伺服器對戰算法一致。重叫 Gemini 產 `index.html` 不會動到遊戲邏輯。

## 1. 頁面要載入的檔案（順序固定）

```html
<script src="passages.js"></script>
<script src="duel-rules.js"></script>
<script src="duel-core.js"></script>
<script src="duel-net.js" onerror="void 0"></script>  <!-- M4 才有；沒有時 DuelCore.netAvailable() 回 false -->
```

字型：`@font-face { font-family: 'Bpmf Huninn'; src: url('fonts/bpmf-huninn-duel.woff2') format('woff2'); }`，只套在目標文章與錯字回顧。

## 2. 對手介面（transport）

`DuelCore.createBotTransport({ level })`（level：easy／normal／hard）與 `DuelCore.createNetTransport({ url })` 長得一樣：

| 方法 | 說明 |
|---|---|
| `on(type, fn)`／`off(type, fn)` | 訂閱事件 |
| `create({ nick, best })` | 開房（best＝本機個人最佳 CPM，讓分用，沒有就 0） |
| `join(code, { nick, best })` | 用 4 位數房號加入（對電腦不適用，會發 error） |
| `setSettings({ lang, grade, domain, duration, handicap })` | 房主改設定，會再發一次 `room` |
| `start()` | 房主開打 |
| `progress(pos, miss)` | 回報累計打對字數／打錯次數（直接傳 tracker.pos、tracker.miss） |
| `rematch()` | 結算後回房間 |
| `leave()` | 離開 |
| `now()` | 跟裁判同步的時間（ms），倒數與計時都用它 |

| 事件 | 資料 | 畫面該做什麼 |
|---|---|---|
| `room` | `{ code, mode:'bot'\|'net', capacity, settings, you:{id,isHost}, players:[{id,nick,role,connected,isBot}] }` | 顯示大廳、房號、雙方座位；非房主的設定按鈕鎖住 |
| `countdown` | `{ startsAt, duration, settings, seed, seq:[文章 id], players:[{id,nick}], maxHp:{id:{hp,maxHp}} }` | 用 `seq` 建 tracker，倒數到 `startsAt` 才能打 |
| `state` | `{ remaining, players:{ id:{hp,maxHp,pos,combo} } }` | 更新血條、對手進度、剩餘秒數、連擊（約每 0.2 秒） |
| `hit` | `{ from, to, damage, combo }` | 攻擊動畫、受擊震動、傷害數字 |
| `end` | `{ winner: id\|null, players:[{id,nick,chars,miss,cpm,acc,hp,maxHp,maxCombo}] }` | 結算頁（winner 為 null＝平手） |
| `left` | `{ id }` | 對手離開提示（M4） |
| `error` | `{ code, message }` | 顯示 message |

## 3. 打字比對器（tracker）

`DuelCore.createTracker(seq, lang)`：

- `current()` → `{ passage, passageIndex, index, ch, zhuyin, tier }`，tier＝這個字已錯幾次
- 中打：`compositionend` 之後、或沒在組字時的 `input`，把輸入框整串丟 `commit(text)`，然後清空輸入框
- 英打：`keydown` 時 `e.key.length === 1` 就丟 `key(e.key)`，並 `preventDefault()`
- 兩者回傳 `{ correct, wrong, tier, passageDone }`
- 中打標點、空白自動跳過（不用打、不算分）；英打空白與標點都要打
- `mistakes()` → 錯字回顧 `[{ ch, zhuyin, count }]`

分層提示依 `tier`：1＝字框紅閃；2＝顯示按鍵（中打 `DuelCore.zhKeys(zhuyin)`，英打 `DuelCore.enKey(ch)`）；3 以上＝鍵盤圖標出要按的鍵。打對就回到 0。

文章顯示：逐字用 `DuelCore.displayChar(passage, i)`（破音字會補異體字選擇器，注音粉圓才畫得出正確讀音）。

## 4. 選文格式（passages.js）

原稿 `passages-src.json` → `python tools/build-passages.py <phonic_table_Z.txt> units/unit23-typing-duel` 產生，不手改。

```js
{ id:'nat-m-01', lang:'zh', grade:'low'|'mid'|'high', domain:'自然科學', curriculum:'', source:'原創', title:'水的三態',
  text:'水有三種樣子。…',          // 純文字，比對用
  zhuyin:['ㄕㄨㄟˇ', …],           // 逐字注音，標點為 ''（只有中文）
  ivs:{ 5: 2 } }                   // 第 5 字用第 2 讀音（只有中文）
```

- 讀音表：ButTaiwan/bpmfvs `phonetic/phonic_table_Z.txt`，順序與字型 IVS 一致（U+E01E1＝第 2 讀音）
- 原稿破音字寫法：字後加 `[n]`，例 `樣子[2]`；建置時會印出所有沒指定的破音字供審稿
- 改了題庫要重跑 `tools/subset-bpmf-font.py <ttf> units/unit23-typing-duel bpmf-huninn-duel.woff2`

## 5. 連線協定（M4，client ↔ duel-worker）

WebSocket，JSON，一則訊息一個物件 `{ t: 類型, ...資料 }`。伺服器送的類型與第 2 節事件同名同欄位，`duel-net.js` 直接轉發成事件。

| 方向 | t | 欄位 | 說明 |
|---|---|---|---|
| → | `create` | `nick, best` | 開房，伺服器回 `room`（含 4 位數 code） |
| → | `join` | `code, nick, best, token?` | token＝斷線重連用，第一次進房 `room.you.token` 給 |
| → | `settings` | `settings` | 只有房主有效 |
| → | `start` | — | 只有房主有效，人數未滿回 error `not-enough-players` |
| → | `prog` | `pos, miss` | 打字進度；伺服器用 `DuelRules.applyProgress` 驗證 |
| → | `rematch`／`leave` | — | |
| ← | `room`／`countdown`／`state`／`hit`／`end`／`left`／`error` | 同第 2 節 | `welcome` 併在第一個 `room`，多帶 `serverNow` 給前端校時 |

- 房間：一個 4 位數房號一個 Durable Object；`capacity` 不寫死（1 對 1＝2），角色 `host`／`player`／`spectator`
- 名字只收暱稱（最多 8 字），不收姓名學號；房間閒置 30 分鐘清掉，不留對戰紀錄
- 伺服器每秒最多廣播 5 次 `state`；`hit` 即時送
- 防作弊：分數只在伺服器算；`prog` 速度超過 `MAX_CPS` 整筆不計；文章由 `seed` 決定，雙方相同

## 6. 未來：班級模式（25–30 人）

保留給之後，現在的設計已預留：`capacity` 可設 30、`spectator` 角色給老師投影、`state` 可改成每秒合併一次。
要另外加的：分組、STAD 進步分（以個人基準計）、老師控制台、座號重連。見計畫頁第 8 節。
