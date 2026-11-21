// 小常識島寵物模組測試：node tools/test-smart-pet.js
// 驗：領養多隻、切換、過關給點心（同關不重給）、長大、服裝解鎖、穿衣只能穿已解鎖、4×3×表情×服裝都畫得出來
const fs = require('fs'), path = require('path'), vm = require('vm');
const mem = {};
const ctx = { window: {}, localStorage: { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } }, console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../assets/js/smart-pet.js'), 'utf8'), ctx);
const P = ctx.window.SmartPet;
let n = 0, bad = 0;
function ok(cond, msg) { n++; if (!cond) { bad++; console.log('✗', msg); } }

ok(P && typeof P.adopt === 'function', '有 SmartPet');
ok(P.current() === null && P.list().length === 0, '一開始沒有寵物');
ok(P.award(29, 0) === null, '訪客過關不存點心');

const a = P.adopt({ seat: '12', owner: '王小明', name: '小雲', type: 'bunny' });
const b = P.adopt({ seat: '7', owner: '林<b>小美', name: '', type: 'nope' });
ok(P.list().length === 2, '一台電腦可以有兩隻');
ok(P.current().id === b.id, '剛領養的變成目前這隻');
ok(b.type === 'bunny' && b.name === '雲朵兔', '亂填種類退回雲朵兔、沒取名用種類名');
ok(!/[<>]/.test(b.owner), '名字去掉角括號');
ok(P.setCurrent(a.id) && P.current().id === a.id, '可以切換');

let r = P.award(29, 0);
ok(r.snack && r.after === 1 && r.outfit === 'scarf', '第一次過關：點心 +1、解鎖圍巾');
r = P.award(29, 0);
ok(!r.snack && r.after === 1 && r.outfit === null, '同一關重玩不重給點心、不重給服裝');
r = P.award(29, 1);
ok(r.snack && r.after === 2 && r.outfit === null, '同單元第 2 關給點心，服裝已拿過');
for (let i = 0; i < 6; i++) r = P.award(30, i);
ok(r.after === 8 && r.stageUp && P.stageOf(8) === 1, '第 8 個點心長大成小朋友');
ok(P.current().outfits.join() === 'scarf,hat', '解鎖圍巾、帽子');
ok(P.setWear(a.id, ['scarf', 'glasses']).wear.join() === 'scarf', '沒解鎖的眼鏡穿不上');
ok(P.stageOf(15) === 1 && P.stageOf(16) === 2, '16 個點心變大朋友');
ok(P.list().find(p => p.id === b.id).snacks === 0, '另一隻的點心沒被動到');

let svgs = 0, broken = 0;
for (const t of ['bunny', 'turtle', 'cat', 'chick']) for (const st of [0, 1, 2]) for (const m of ['happy', 'normal', 'worried', 'surprised'])
  for (const w of [[], ['scarf', 'hat', 'glasses'], ['bow', 'medal', 'headset']]) {
    const s = P.svg(t, st, m, { wear: w, snack: m === 'happy', q: m === 'surprised', sweat: m === 'worried' });
    svgs++; if (!/^<svg[\s\S]*<\/svg>$/.test(s) || /NaN|undefined/.test(s)) broken++;
  }
ok(broken === 0, `寵物圖都畫得出來（${svgs} 種，壞 ${broken}）`);
ok(/<svg viewBox="0 0 48 48"/.test(P.svg('bunny', 1, 'happy', { snack: true })), '吃點心的餅乾是內嵌圖，不靠頁面 symbol');

P.remove(a.id);
ok(P.list().length === 1 && P.current().id === b.id, '刪掉目前這隻會切到另一隻');

console.log(bad ? `✗ ${bad}／${n} 項失敗` : `✓ ${n} 項全過`);
process.exit(bad ? 1 : 0);
