// 首頁「年級入口＋嚮導」的資料與邏輯（2026-11-22，首頁 B 方案）。不碰畫面，index.html 負責畫。
// 測試：node tools/test-home-grade.mjs
//
// - 年級標籤 → 年級範圍：data.js 各島寫法不同（一年級／中年級／初階 1–3 年級／1–2 年級…），這裡統一換算，不改每一列
// - 建議路線：島的順序固定（使用者 11-22「打字島早一點出現」），只留這個年級有關卡的島
// - 年級只記到當天結束（教室電腦很多班共用）；網址 ?grade=12|34|56|all 可直接指定（投影用）

export const GRADES = {
  '12':  { key:'12',  label:'1–2 年級', lo:1, hi:2, color:'#2f9e44' },
  '34':  { key:'34',  label:'3–4 年級', lo:3, hi:4, color:'#1c7ed6' },
  '56':  { key:'56',  label:'5–6 年級', lo:5, hi:6, color:'#7048e8' },
  'all': { key:'all', label:'全部',     lo:1, hi:6, color:'#3b2f2a' },
};

// 島嶼路線順序：滑鼠島 → 打字島 → 節慶島 → 思考島 → 畫畫島 → 小常識島 → 大富翁港 → 對戰島
// （從打字島順時針繞一圈，虛線不交叉；節慶島不分年級，每條路線都會經過，夾在打字島與思考島之間）
export const ROUTE_ORDER = ['mouse', 'type', 'fest', 'think', 'art', 'smart', 'board', 'duel'];

// 年級標籤 → [最低, 最高]；讀不懂的當作都能玩
export function rangeOf(label = '') {
  if (/一年級/.test(label)) return [1, 1];
  if (/中年級/.test(label)) return [3, 4];
  if (/三年級/.test(label)) return [3, 3];
  if (/都能玩/.test(label)) return [1, 6];
  const m = label.match(/(\d)\s*[–-]\s*(\d)/);
  if (m) return [+m[1], +m[2]];
  const one = label.match(/(\d)\s*年級/);
  if (one) return [+one[1], +one[1]];
  return [1, 6];
}

// 這一關適不適合這個年級（範圍有重疊就算）
export function fits(unit, g) {
  const G = GRADES[g]; if (!G || g === 'all') return true;
  const [lo, hi] = rangeOf(unit.grade);
  return lo <= G.hi && hi >= G.lo;
}

// 建議路線：[{ isl, units:[這個年級的關卡], done, total }]；全部模式回傳空陣列（不畫路線）
export function route(islands, g) {
  if (!GRADES[g] || g === 'all') return [];
  const byId = new Map(islands.map(i => [i.id, i]));
  return ROUTE_ORDER.map(id => byId.get(id)).filter(Boolean).map(isl => {
    const units = isl.list.filter(u => fits(u, g));
    return { isl, units, done: units.filter(u => u.rec).length, total: units.length };
  }).filter(r => r.total > 0);
}

// 下一站：路線上第一個還沒玩的關；全部玩過回傳 null
export function nextStop(islands, g) {
  for (const r of route(islands, g)) for (const u of r.units) if (!u.rec) return u;
  return null;
}

// ---------- 當天記憶 ----------
export const KEY = 'edtech-home-grade';   // { g:'12', guide:'mine'|'bunny'|…, day:'2026-11-22' }
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function loadChoice(storage, now = new Date()) {
  try {
    const v = JSON.parse(storage.getItem(KEY) || 'null');
    if (v && GRADES[v.g] && v.day === today(now)) return v;
  } catch { /* 壞資料當沒選過 */ }
  return null;
}
export function saveChoice(storage, g, guide, now = new Date()) {
  const v = { g, guide: guide || 'mine', day: today(now) };
  try { storage.setItem(KEY, JSON.stringify(v)); } catch { /* 存不了就只在這次有效 */ }
  return v;
}
// 網址參數 ?grade=12|34|56|all
export function gradeFromUrl(search = '') {
  const g = new URLSearchParams(search).get('grade');
  return GRADES[g] ? g : null;
}
