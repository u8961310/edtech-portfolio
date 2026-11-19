// 打字擂台規則與比對器的單元測試：node tools/test-duel-core.js（repo 根目錄）
'use strict';
const assert = require('assert');
const path = require('path');
const U = path.join(__dirname, '..', 'units', 'unit23-typing-duel');

globalThis.window = globalThis;
require(path.join(U, 'passages.js'));
globalThis.DuelRules = require(path.join(U, 'duel-rules.js'));
require(path.join(U, 'duel-core.js'));
const R = globalThis.DuelRules, C = globalThis.DuelCore;

let n = 0;
function t(name, fn) { fn(); n++; console.log('ok', name); }

t('設定不合法時用預設值', () => {
  const s = R.normalizeSettings({ lang: 'jp', grade: 'x', duration: 999, handicap: 1 });
  assert.deepStrictEqual(s, { lang: 'zh', grade: 'mid', domain: 'random', duration: 90, handicap: true });
});

t('同 seed 文章順序相同、篩不到領域會退回同年級', () => {
  const s = { lang: 'zh', grade: 'mid', domain: '不存在' };
  assert.deepStrictEqual(R.pickSequence(PASSAGES, s, 42), R.pickSequence(PASSAGES, s, 42));
  const want = PASSAGES.filter(p => p.lang === 'zh' && p.grade === 'mid').map(p => p.id).sort();
  assert.deepStrictEqual(R.pickSequence(PASSAGES, s, 42).slice().sort(), want);
  const nat = R.pickSequence(PASSAGES, { lang: 'zh', grade: 'mid', domain: '自然科學' }, 7);
  assert.ok(nat.length && nat.every(id => PASSAGES.find(p => p.id === id).domain === '自然科學'));
});

t('傷害、連擊加成、打錯連擊歸零', () => {
  const m = R.newMatch({ lang: 'zh', grade: 'mid' }, [{ id: 'a', nick: 'A' }, { id: 'b', nick: 'B' }], 0);
  assert.strictEqual(m.players.b.hp, 40);
  let r = R.applyProgress(m, 'a', { pos: 9, miss: 0 }, 2000);
  assert.strictEqual(r.damage, 9);
  r = R.applyProgress(m, 'a', { pos: 11, miss: 0 }, 3000);       // 第 10、11 字 ×1.5
  assert.strictEqual(r.damage, 3);
  r = R.applyProgress(m, 'a', { pos: 12, miss: 1 }, 4000);       // 第 12 字仍 ×1.5，之後歸零
  assert.strictEqual(r.damage, 1.5);
  assert.strictEqual(m.players.a.combo, 0);
  assert.strictEqual(m.players.a.maxCombo, 12);
  assert.strictEqual(m.players.b.hp, 40 - 13.5);
});

t('太快、倒退、開打前都不計', () => {
  const m = R.newMatch({}, [{ id: 'a' }, { id: 'b' }], 1000);
  assert.strictEqual(R.applyProgress(m, 'a', { pos: 1, miss: 0 }, 500).reason, 'not-started');
  assert.strictEqual(R.applyProgress(m, 'a', { pos: 50, miss: 0 }, 2000).reason, 'too-fast');
  R.applyProgress(m, 'a', { pos: 5, miss: 0 }, 2000);
  assert.strictEqual(R.applyProgress(m, 'a', { pos: 3, miss: 0 }, 3000).reason, 'bad-value');
});

t('血量歸零就結束，勝負看血量比例', () => {
  const m = R.newMatch({ lang: 'zh', grade: 'low' }, [{ id: 'a', nick: 'A' }, { id: 'b', nick: 'B' }], 0);
  for (let i = 1; i <= 30; i++) R.applyProgress(m, 'a', { pos: i, miss: 0 }, i * 1000);
  assert.strictEqual(R.isOver(m, 30000), true);
  const res = R.result(m, 30000);
  assert.strictEqual(res.winner, 'a');
  assert.strictEqual(res.players[0].acc, 100);
});

t('讓分：慢的一方血量放大，最多 1.5 倍', () => {
  const m = R.newMatch({ lang: 'zh', grade: 'mid', handicap: true },
    [{ id: 'fast', best: 60 }, { id: 'slow', best: 20 }], 0);
  assert.strictEqual(m.players.fast.maxHp, 40);
  assert.strictEqual(m.players.slow.maxHp, 60);
});

t('時間到平手', () => {
  const m = R.newMatch({}, [{ id: 'a' }, { id: 'b' }], 0);
  assert.strictEqual(R.isOver(m, 90000), true);
  assert.strictEqual(R.result(m, 90000).winner, null);
});

t('中打比對器：跳過標點、打錯停住、tier 累加、換篇', () => {
  const tr = C.createTracker(['life-l-01'], 'zh');
  assert.strictEqual(tr.current().ch, '早');
  let r = tr.commit('早上起床');
  assert.deepStrictEqual([r.correct, r.wrong], [4, false]);
  assert.strictEqual(tr.current().ch, '我');                 // 「，」自動跳過
  r = tr.commit('喔先');                                      // 第一字就錯，後面丟掉
  assert.deepStrictEqual([r.correct, r.wrong, r.tier], [0, true, 1]);
  r = tr.commit('窩'); assert.strictEqual(r.tier, 2);
  r = tr.commit('我先刷牙洗臉，');                            // 學生多打標點不算錯
  assert.strictEqual(r.correct, 6);
  assert.deepStrictEqual([tr.pos, tr.miss], [10, 2]);
  assert.deepStrictEqual(tr.mistakes()[0], { ch: '我', zhuyin: 'ㄨㄛˇ', count: 2 });
  r = tr.commit('再吃早餐媽媽說吃飽才有力氣上學');
  assert.strictEqual(r.passageDone, true);                    // 單篇排到底會從頭再來
  assert.strictEqual(tr.current().ch, '早');
});

t('破音字顯示補選擇器、比對時用原字', () => {
  const p = C.passage('life-l-01');
  const i = p.text.indexOf('媽說') ;
  assert.strictEqual(C.displayChar(p, i), '媽\u{E01E1}');
  assert.strictEqual(C.displayChar(p, 0), '早');
  const tr = C.createTracker(['life-l-01'], 'zh');
  assert.strictEqual(tr.commit('早上起床我先刷牙洗臉再吃早餐媽媽').correct, 16);
});

t('英打比對器：逐鍵、空白也要打', () => {
  const tr = C.createTracker(['en-l-01'], 'en');
  ['c', 'a', 't', ' ', 'd'].forEach(k => assert.strictEqual(tr.key(k).correct, 1));
  assert.strictEqual(tr.key('x').wrong, true);
  assert.strictEqual(tr.current().ch, 'o');
});

t('注音按鍵：一聲補空白、輕聲點最後按', () => {
  assert.deepStrictEqual(C.zhKeys('ㄓㄥ').map(k => k.key), ['5', '/', '空白鍵']);
  assert.deepStrictEqual(C.zhKeys('˙ㄉㄜ').map(k => k.key), ['2', 'K', '7']);
  assert.deepStrictEqual(C.zhKeys('ㄧㄝˋ').map(k => k.key), ['U', ',', '4']);
  assert.deepStrictEqual(C.enKey('W'), { key: 'W', shift: true });
});

t('對電腦：room／countdown 事件欄位齊全', () => {
  const bt = C.createBotTransport({ level: 'easy' });
  const got = {};
  ['room', 'countdown', 'hit'].forEach(e => bt.on(e, d => { got[e] = d; }));
  bt.create({ nick: '小明', best: 0 });
  bt.setSettings({ lang: 'zh', grade: 'low', duration: 60 });
  bt.start();
  bt.leave();                                                  // 停掉計時器（實際對打在瀏覽器實測）
  const cd = got.countdown;
  assert.ok(cd.seq.length && cd.startsAt && cd.maxHp.me.hp === 25 && cd.duration === 60);
  assert.strictEqual(got.room.you.isHost, true);
});

console.log(`\n全部 ${n} 項通過`);
