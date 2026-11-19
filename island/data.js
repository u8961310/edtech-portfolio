// 學習樂園島的關卡資料：index.html（插畫版）與 island-3d.html（3D 版／產圖工具）共用。
// 新增單元：在對應島的 units 加一列，然後跑 `python tools/render-island.py` 重新產圖。
//
// 每列：[短名, emoji, 3D 小物, 連結, 完整名稱, 年級, 分數來源]
//   分數來源：數字＝讀 edtech-unit{N}-score（unit11/12 存成 -best-score，兩個都讀）
//             'board:<zoneId>'＝讀 edtech-board-certs 的證書
//   3D 小物：island-3d.html 裡 PROPS 的 key，決定地塊上擺什麼小模型
// ⚠️ 一座島最多 8 關（第一圈 6 格＋第二圈補位），超過要改 island-3d.html 的排位。
//    small:true 的島（節慶島）只有第一圈，最多 6 關。
// 島的位置：前 6 座照 island-3d.html 的 CENTERS 順序；之後新增的島要自己給 at:[q,r]（六角座標）
// 與 from:'<島 id>'（吊橋從哪座島接過來），不然會沒有位置。

const G1 = '🎒 一年級', GM = '📘 中年級', G3 = '🎓 三年級', GA = '🎲 都能玩';

export const ISLANDS = [
  { id:'mouse', name:'滑鼠島', icon:'🖱️', color:0x5fd38d, units:[
    ['小兔勇者','🐰','bunny','units/unit2-mouse-adventure/','小兔勇者大冒險',G1,2],
    ['滑鼠勇士','🖱️','mouse','units/unit21-mouse-challenge/','滑鼠小勇士大冒險',G1,21],
    ['拔蔬菜','🥕','carrots','units/unit19-farm-harvest/','快樂農場：蔬菜拔拔樂',G1,19] ] },
  { id:'type', name:'打字島', icon:'⌨️', color:0xffc94d, units:[
    ['打地鼠','🐹','moles','units/unit4-whack-keyboard/','鍵盤打地鼠',G1,4],
    ['太空打字','🚀','rocket','units/unit3-space-typing/','太空打字防衛戰',G1,3],
    ['恐龍打字','🦖','dino','units/unit16-dino-typing/','恐龍打字大冒險',G1,16],
    ['雷射森林','🌲','pines','units/unit13-forest-typing-defense/','極速雷射森林戰',G1,13],
    ['中文打字','🔤','keyboard','units/unit1-typing-adventure/','中文打字冒險王',GM,1],
    ['英打特攻','🛸','ufo','units/unit11-space-typing-pro/','英打太空特攻',GM,11],
    ['中打特攻','🌙','rocket2','units/unit12-space-typing-zh/','中打太空特攻',GM,12],
    ['魔法字彈','✨','crystal','units/unit14-magic-word-bullet/','魔法字彈極速覺醒',G3,14] ] },
  { id:'think', name:'思考島', icon:'🧩', color:0x6fb3ff, units:[
    ['烏龜指揮','🐢','turtle','units/unit6-turtle-commander/','烏龜小指揮官',G1,6],
    ['指令法師','🧙','mushroom','units/unit7-spell-commander/','指令小法師',G1,7],
    ['思考營','🧠','tent','units/unit15-computational-thinking/','運算思維挑戰營',G1,15],
    ['萌寵尋寶','🐶','chest','units/unit17-pet-treasure-coding/','程式小勇士：萌寵尋寶',G1,17],
    ['分類隊長','🧺','buckets','units/unit10-classifier-captain/','分類大隊長',G1,10],
    ['襪子配對','🧦','line','units/unit20-sock-matching/','瘋狂襪子配對線',G1,20] ] },
  { id:'art', name:'畫畫島', icon:'🎨', color:0xff8fc4, units:[
    ['像素畫家','👾','pixels','units/unit5-pixel-art/','像素藝術小畫家',G1,5],
    ['魔法畫畫','🖌️','easel','units/unit18-magic-paint/','魔法簡約畫畫屋',G1,18] ] },
  { id:'smart', name:'小常識島', icon:'📁', color:0xb69bff, units:[
    ['桌面整理','🗂️','folders','units/unit8-desktop-organizer/','桌面整理大師',G1,8],
    ['網路警察','👮','siren','units/unit9-net-detective/','網路小警察',G1,9] ] },
  { id:'board', name:'大富翁港', icon:'🎲', color:0xff9f5a, units:[
    ['森林大富翁','🌳','dice','board/index.html','資訊大富翁：森林大冒險',GA,'board:forest'],
    ['海洋大富翁','🐳','boat','board/ocean.html','資訊大富翁：海洋大探索',GA,'board:ocean'] ] },
  // 第 7 座（2026-11-19）：節慶遊戲專用。外圈 6 個位置已滿，放在思考島與打字島之間的前方，
  // 吊橋從打字島接過來（from）；small＝只用中心＋第一圈，最多 6 關（春節、兒童節等之後放這裡）
  //   at [-5,10]：離思考島、打字島各 5 格（跟其他島同間距），island-3d.html 的底座為此放大到 21.5
  //   theme:'xmas'：雪地、拐杖糖塔、燈泡、聖誕樹／雪人／禮物堆（換節慶時改這裡，island-3d.html 的 THEMES 加對應裝飾）
  { id:'fest', name:'節慶島', icon:'🎄', color:0xe0524a, at:[-5,10], from:'type', small:true, theme:'xmas', units:[
    ['聖誕工坊','🎄','xtree','units/unit22-xmas-workshop/','聖誕工坊大救援',GM,22] ] },
  // 第 8 座（2026-11-19）：雙人連線對戰。打字島已滿 8 關，另開一座放對戰類（之後班級競賽也放這裡）
  //   at [5,5]：打字島與滑鼠島之間的右前方，離兩島各 5 格、離中心 15（跟節慶島對稱）；吊橋從打字島接過來
  //   theme:'duel'：帆布地面、紅藍圍繩塔、獎盃、拳擊手套、旗子（island-3d.html 的 THEMES.duel）
  //   unit23 的分數是歷史最快「每分鐘字數」，地圖上顯示成 🏆 數字
  { id:'duel', name:'對戰島', icon:'⚔️', color:0x5b7cff, at:[5,5], from:'type', small:true, theme:'duel', units:[
    ['打字擂台','🏆','ring','units/unit23-typing-duel/','打字擂台：雙人連線對戰',GA,23] ] },
];

// ---------- 成績（只讀 localStorage，讀不到就當沒玩過） ----------
const ls = k => { try { return localStorage.getItem(k); } catch { return null; } };
let certs = {};
try { certs = (JSON.parse(ls('edtech-board-certs') || '{}') || {}).zones || {}; } catch { /* 壞資料就當沒證書 */ }

function record(src) {
  if (typeof src === 'string') { const c = certs[src.split(':')[1]]; return c ? { stars:c.stars || 1, coins:c.coins || 0 } : null; }
  const s = ls(`edtech-unit${src}-score`) ?? ls(`edtech-unit${src}-best-score`);
  return s ? { score:s } : null;
}

// 攤平成關卡清單；每座島也掛一份 list 方便逐島處理
export const UNITS = [];
ISLANDS.forEach((isl, ii) => isl.units.forEach(u => UNITS.push({
  id:`${isl.id}-${UNITS.filter(x => x.ii === ii).length}`, isl, ii,
  short:u[0], emoji:u[1], prop:u[2], url:u[3], full:u[4], grade:u[5], rec:record(u[6]),
})));
ISLANDS.forEach((isl, ii) => { isl.list = UNITS.filter(u => u.ii === ii); });

export const recText = u => !u.rec ? '🆕 還沒玩' : u.rec.stars ? '⭐'.repeat(u.rec.stars) : `🏆 ${u.rec.score}`;
export const hex = c => '#' + c.toString(16).padStart(6, '0');
export const pastelHex = (c, a = .3) => {
  const r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255, m = v => Math.round(v + (255 - v) * a);
  return '#' + [m(r), m(g), m(b)].map(v => v.toString(16).padStart(2, '0')).join('');
};
