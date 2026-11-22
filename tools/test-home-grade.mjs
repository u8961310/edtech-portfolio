// 首頁年級入口邏輯測試：node tools/test-home-grade.mjs
// 驗：年級標籤換算、各年級關卡數與路線、下一站、當天記憶隔天失效、網址參數
import { GRADES, rangeOf, fits, route, nextStop, loadChoice, saveChoice, gradeFromUrl, today } from '../island/grade.js';

const mem = {};
globalThis.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
const { ISLANDS, UNITS } = await import('../island/data.js');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('✗', m); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

ok(eq(rangeOf('🎒 一年級'), [1, 1]) && eq(rangeOf('📘 中年級'), [3, 4]) && eq(rangeOf('🎲 都能玩'), [1, 6]), '一年級／中年級／都能玩');
ok(eq(rangeOf('🌱 初階 1–3 年級'), [1, 3]) && eq(rangeOf('🌿 進階 4–5 年級'), [4, 5]) && eq(rangeOf('🌳 高階 6 年級'), [6, 6]), '打字島三階');
ok(eq(rangeOf('⭐ 1–4 年級'), [1, 4]) && eq(rangeOf('奇怪的字'), [1, 6]), '1–4 年級、讀不懂當都能玩');

const count = g => UNITS.filter(u => fits(u, g)).length;
ok(count('12') === 26 && count('34') === 20 && count('56') === 8 && count('all') === UNITS.length, `各年級關卡數 ${count('12')}／${count('34')}／${count('56')}`);

const ids = g => route(ISLANDS, g).map(r => r.isl.id).join(',');
ok(ids('12') === 'mouse,type,fest,think,art,smart,board,duel', '1–2 年級路線：' + ids('12'));
ok(ids('34') === 'type,fest,art,smart,board,duel', '3–4 年級路線：' + ids('34'));
ok(ids('56') === 'type,fest,board,duel', '5–6 年級路線：' + ids('56'));
ok(route(ISLANDS, 'all').length === 0, '全部模式不畫路線');
ok(route(ISLANDS, '12').reduce((a, r) => a + r.total, 0) === 26, '1–2 年級路線上 26 關');

ok(nextStop(ISLANDS, '12').short === '小兔勇者', '沒玩過時 1–2 年級第一站是小兔勇者');
ok(nextStop(ISLANDS, '34').short === '怪獸冒頭', '3–4 年級第一站是打字島怪獸冒頭');
const mouse = ISLANDS.find(i => i.id === 'mouse');
mouse.list[0].rec = { score: 1 }; mouse.list[1].rec = { score: 1 };
ok(nextStop(ISLANDS, '12').short === '拔蔬菜', '玩過兩關後下一站是拔蔬菜');
ok(route(ISLANDS, '12')[0].done === 2, '滑鼠島玩過 2／3');

const d1 = new Date(2026, 10, 22, 9), d2 = new Date(2026, 10, 23, 9);
ok(today(d1) === '2026-11-22', '日期格式');
saveChoice(localStorage, '34', 'cat', d1);
ok(loadChoice(localStorage, d1)?.g === '34' && loadChoice(localStorage, d1)?.guide === 'cat', '當天記得年級與嚮導');
ok(loadChoice(localStorage, d2) === null, '隔天要重新問');
mem['edtech-home-grade'] = '{壞掉';
ok(loadChoice(localStorage, d1) === null, '壞資料當沒選過');
ok(gradeFromUrl('?grade=12') === '12' && gradeFromUrl('?grade=all') === 'all' && gradeFromUrl('?grade=99') === null && gradeFromUrl('') === null, '網址參數');
ok(Object.keys(GRADES).join() === '12,34,56,all', '四種年級選項');

console.log(bad ? `✗ ${bad}／${n} 項失敗` : `✓ ${n} 項全過`);
process.exit(bad ? 1 : 0);
