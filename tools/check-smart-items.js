// 小常識島題目審題檢核（2026-11-21）：node tools/check-smart-items.js units/unit31-pet-message/index.html
// 從頁面抽出 SCENE_CONFIG.LEVELS，逐題列出：正解位置、正解長度 ÷ 錯誤選項平均長度、why 有沒有寫、跟大富翁港題幹重複的關鍵詞
// 規則來源：docs/plans/smart-island-gemini-prompt.md「出題規則 — 審題檢核」
const fs = require('fs'), vm = require('vm');
const file = process.argv[2];
const src = fs.readFileSync(file, 'utf8');
const at = src.search(/SCENE_CONFIG\s*=\s*\{/);
if (at < 0) { console.log('找不到 SCENE_CONFIG'); process.exit(1); }
let i = src.indexOf('{', at), depth = 0, end = i;
for (let inStr = null; end < src.length; end++) {
  const c = src[end], p = src[end - 1];
  if (inStr) { if (c === inStr && p !== '\\') inStr = null; continue; }
  if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
  if (c === '{') depth++; else if (c === '}' && --depth === 0) break;
}
const ctx = { window: {}, document: { createElement: () => ({}) }, SmartIsland: { IC: {} } };
let cfg;
try { cfg = vm.runInNewContext('(' + src.slice(i, end + 1) + ')', ctx); }
catch (e) { console.log('SCENE_CONFIG 無法單獨執行：' + e.message); process.exit(1); }
const levels = cfg.LEVELS || cfg.levels;
if (!Array.isArray(levels)) { console.log('SCENE_CONFIG 沒有 LEVELS 陣列，鍵：' + Object.keys(cfg).join(',')); process.exit(1); }

const BOARD = ['中獎', '免費手機', '多久', '休息一下', '好密碼', '真實姓名', '大腦', 'CPU', '生日卡片', '資料夾的主要功能', '刪除', '找回來', '取一個清楚', '備份', '快壞掉'];
const len = s => [...String(s || '').replace(/<[^>]+>/g, '')].length;
let warn = 0, total = 0;
levels.forEach((lv, li) => {
  const qs = lv.questions || lv.items || lv.qs || lv;
  if (!Array.isArray(qs)) { console.log(`第 ${li + 1} 關：找不到題目陣列`); return; }
  const pos = {};
  console.log(`\n第 ${li + 1} 關 ${lv.name || lv.title || ''}（${qs.length} 題）`);
  qs.forEach((q, qi) => {
    total++;
    const opts = q.options || [];
    const ans = q.ans != null ? q.ans : q.answer;
    pos[ans + 1] = (pos[ans + 1] || 0) + 1;
    const right = opts[ans] || {}, wrong = opts.filter((_, k) => k !== ans);
    const avg = wrong.reduce((a, o) => a + len(o.text), 0) / Math.max(1, wrong.length);
    const ratio = avg ? len(right.text) / avg : 1;
    const flags = [];
    if (opts.length && (ratio > 1.5 || ratio < 0.6)) flags.push(`正解長度是錯誤選項的 ${ratio.toFixed(2)} 倍`);
    if (wrong.some(o => !o.why || o.why === '正解')) flags.push('錯誤選項缺 why（迷思）');
    if (!q.explain) flags.push('缺 explain');
    if (/以上皆/.test(opts.map(o => o.text).join())) flags.push('用了以上皆是／非');
    if (/不|沒有|錯誤/.test(q.q) && /哪(一)?(個|項)/.test(q.q) && /不(是|對|好|安全|可以)/.test(q.q)) flags.push('可能是否定題幹');
    const hit = BOARD.filter(k => (q.q + opts.map(o => o.text).join()).includes(k));
    if (hit.length) flags.push('含大富翁港關鍵詞：' + hit.join('、'));
    if (flags.length) warn++;
    console.log(`  ${qi + 1}. [正解 ${ans + 1}／${opts.length || '?'}] ${q.q}${flags.length ? '\n     ⚠ ' + flags.join('；') : ''}`);
    if (process.argv.includes('--answers')) console.log(`     → ${right.text}｜${q.explain}`);   // 人工看內容對不對
  });
  console.log('  正解位置次數：' + Object.keys(pos).sort().map(k => `${k}→${pos[k]}`).join('、'));
});
console.log(`\n共 ${total} 題，${warn} 題有提醒（提醒不等於錯，要人工看）`);
