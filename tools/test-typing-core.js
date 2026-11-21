// 打字島共用核心的單元測試：node tools/test-typing-core.js（repo 根目錄）
'use strict';
const assert = require('assert');
const path = require('path');
const A = path.join(__dirname, '..', 'assets');

globalThis.window = globalThis;
require(path.join(A, 'typing', 'passages.js'));
require(path.join(A, 'typing', 'en-items.js'));
require(path.join(A, 'js', 'typing-core.js'));
const C = globalThis.TypingCore;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }

t('設定：不合法用預設、初階進階注音強制開、高階可關', () => {
  assert.deepStrictEqual(C.normalizeSettings({ tier: 'x', minutes: 7, set: '漢賦', lang: 'jp' }),
    { lang: 'zh', tier: 't1', minutes: 10, set: 'random', zhuyin: true });
  assert.strictEqual(C.normalizeSettings({ tier: 't2', zhuyin: false }).zhuyin, true);
  assert.strictEqual(C.normalizeSettings({ tier: 't3', zhuyin: false }).zhuyin, false);
});

t('網址參數：老師帶設定', () => {
  assert.deepStrictEqual(C.settingsFromQuery('?tier=t3&min=15&set=song&zhuyin=0'),
    { tier: 't3', minutes: 15, set: '宋詞', zhuyin: false });
  assert.deepStrictEqual(C.settingsFromQuery('?tier=t9&min=99'), {});
});

t('30 秒測試：只有 test 模式接受、1 回合 30 秒、顯示文字', () => {
  assert.strictEqual(C.normalizeSettings({ minutes: 0.5 }).minutes, 10);
  assert.strictEqual(C.normalizeSettings({ minutes: 0.5 }, { test: true }).minutes, 0.5);
  assert.strictEqual(C.normalizeSettings({ minutes: 15 }, { test: true }).minutes, 15);
  assert.deepStrictEqual(C.roundPlan(0.5), { rounds: 1, roundSec: 30 });
  assert.strictEqual(C.settingsFromQuery('?min=0.5').minutes, 0.5);
  assert.ok(C.isTestMode('?test=1') && C.isTestMode('?tier=t1&test=1') && !C.isTestMode('?test=10') && !C.isTestMode(''));
  assert.strictEqual(C.minutesText(0.5), '30 秒');
  assert.strictEqual(C.minutesText(20), '20 分鐘');
});

t('回合：10/15/20 分 → 4/5/6 回合', () => {
  assert.deepStrictEqual(C.roundPlan(10), { rounds: 4, roundSec: 150 });
  assert.deepStrictEqual(C.roundPlan(15), { rounds: 5, roundSec: 180 });
  assert.deepStrictEqual(C.roundPlan(20), { rounds: 6, roundSec: 200 });
});

t('選文：依階級與類別篩、同 seed 同順序、隨機＝三類都有', () => {
  const a = C.pickSequence({ tier: 't2', set: '宋詞' }, 7).map(p => p.id);
  assert.deepStrictEqual(a, C.pickSequence({ tier: 't2', set: '宋詞' }, 7).map(p => p.id));
  assert.strictEqual(a.length, 10);
  assert.ok(a.every(id => id.startsWith('song-2-')));
  const r = C.pickSequence({ tier: 't1', set: 'random' }, 1);
  assert.strictEqual(r.length, 30);
  assert.deepStrictEqual([...new Set(r.map(p => p.domain))].sort(), ['三字經', '唐詩', '宋詞'].sort());
  const en = C.pickSequence({ lang: 'en', tier: 't3' }, 1);
  assert.ok(en.length === 10 && en.every(p => p.domain === '句子'));
});

t('三階每階每類都有 10 篇、英打三階各 10 篇', () => {
  for (const tier of ['t1', 't2', 't3']) {
    for (const set of C.ZH_SETS) assert.strictEqual(C.pickSequence({ tier, set }, 1).length, 10, tier + set);
    assert.strictEqual(C.pickSequence({ lang: 'en', tier }, 1).length, 10);
  }
});

t('比對：打對前進、標點自動跳過、打錯停住並記錯字本', () => {
  const p = PASSAGES.find(x => x.id === 'tang-1-01'); // 床前明月光，疑是地上霜。…
  const tr = C.createTracker([p]);
  assert.strictEqual(tr.current().ch, '床');
  let r = tr.commit('床前明月光');
  assert.strictEqual(r.correct, 5);
  assert.strictEqual(tr.current().ch, '疑');            // 逗號自動跳過
  r = tr.commit('疑是弟');
  assert.deepStrictEqual([r.correct, r.wrong, r.tier], [2, true, 1]);
  assert.strictEqual(tr.current().ch, '地');
  assert.strictEqual(tr.commit('第').tier, 2);           // 同一字第 2 次錯
  assert.strictEqual(tr.combo, 0);
  assert.deepStrictEqual(tr.mistakes().map(m => [m.ch, m.count]), [['地', 2]]);
  assert.strictEqual(tr.commit('，地').correct, 1);       // 多打的標點不算錯
});

t('破音字顯示：朝 補選擇器、比對用原字', () => {
  const p = PASSAGES.find(x => x.id === 'tang-2-01');
  const tr = C.createTracker([p]);
  assert.strictEqual(tr.current().display, '朝' + String.fromCodePoint(0xE01E1));
  assert.strictEqual(tr.commit('朝').correct, 1);
});

t('upcoming：射擊類掉落物，跳過標點、跨篇接續', () => {
  const p1 = PASSAGES.find(x => x.id === 'szj-1-01'), p2 = PASSAGES.find(x => x.id === 'szj-1-02');
  const tr = C.createTracker([p1, p2]);
  const up = tr.upcoming(14).map(u => u.ch).join('');
  assert.strictEqual(up, '人之初性本善性相近習相遠苟不');
});

t('換篇：打完一篇 passageDone、passagesDone+1、循環', () => {
  const p = PASSAGES.find(x => x.id === 'szj-1-01');
  const tr = C.createTracker([p]);
  const r = tr.commit('人之初性本善性相近習相遠');
  assert.ok(r.passageDone);
  assert.strictEqual(tr.passagesDone, 1);
  assert.strictEqual(tr.current().ch, '人');
});

t('英打：逐鍵、大寫要 Shift、空白也要打', () => {
  const tr = C.createTracker([{ id: 'x', lang: 'en', text: 'I am' }]);
  assert.strictEqual(tr.key('I').correct, 1);
  assert.strictEqual(tr.key('a').wrong, true);
  assert.strictEqual(tr.key(' ').correct, 1);
  assert.deepStrictEqual(C.enKeys('I').map(k => k.key), ['Shift', 'I']);
  assert.deepStrictEqual(C.enKeys('?').map(k => k.key), ['Shift', '/']);
});

t('注音按鍵：一聲補空白、輕聲最後按、地＝2 U 4', () => {
  assert.deepStrictEqual(C.zhKeys('ㄉㄧˋ').map(k => k.key), ['2', 'U', '4']);
  assert.deepStrictEqual(C.zhKeys('ㄓㄥ').map(k => k.key), ['5', '/', '空白鍵']);
  assert.deepStrictEqual(C.zhKeys('˙ㄉㄜ').map(k => k.key), ['2', 'K', '7']);
  assert.deepStrictEqual(C.zhKeys('ㄏㄨㄢˊ').map(k => k.key), ['C', 'J', '0', '6']);
});

t('鍵盤資料：5 排各 15 格、大千 41 個符號都在鍵上、選文用到的注音都按得出來', () => {
  assert.strictEqual(C.KEYBOARD.length, 5);
  C.KEYBOARD.forEach((row, i) => assert.strictEqual(row.reduce((s, k) => s + k[1], 0), 15, '第 ' + (i + 1) + ' 排'));
  const keys = new Set(C.KEYBOARD.flat().map(k => k[0]));
  Object.values(C.BPMF_KEYS).forEach(k => assert.ok(keys.has(k), k));
  assert.strictEqual(Object.keys(C.BPMF_KEYS).length, 41);
  PASSAGES.forEach(p => p.zhuyin.forEach(z => C.zhKeys(z).forEach(k => assert.ok(keys.has(k.key), p.id + ' ' + z + ' ' + k.key))));
  assert.strictEqual(C.keyHand('F'), 'L');
  assert.strictEqual(C.keyHand('J'), 'R');
});

t('成績與星等：正確率、每分鐘字數、未完成 0 星、三星要速度', () => {
  const st = C.stats({ pos: 90, miss: 10, maxCombo: 30, passagesDone: 3 }, 5 * 60000);
  assert.deepStrictEqual([st.accuracy, st.cpm], [90, 18]);
  assert.strictEqual(C.score(st), 81);
  assert.strictEqual(C.starsFor(st, 't1', false), 0);
  assert.strictEqual(C.starsFor(st, 't1', true), 2);
  assert.strictEqual(C.starsFor({ accuracy: 96, cpm: 18 }, 't1', true), 3);
  assert.strictEqual(C.starsFor({ accuracy: 96, cpm: 18 }, 't2', true), 2);   // 進階要 25 字/分
  assert.strictEqual(C.starsFor({ accuracy: 70, cpm: 50 }, 't3', true), 1);
});

t('民國日期', () => {
  assert.strictEqual(C.rocDate(new Date(2026, 10, 20)), '中華民國 115 年 11 月 20 日');
});

console.log(`\n全部 ${n} 項通過`);
