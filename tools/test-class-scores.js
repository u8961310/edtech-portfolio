// 全班成績 QR 的純函式測試：node tools/test-class-scores.js
'use strict';
const CS = require('../assets/js/class-scores.js');
let pass = 0, fail = 0;
function ok(cond, name) { if (cond) pass++; else { fail++; console.log('❌ ' + name); } }

const rec = { unit: 12, tier: 't2', lang: 'zh', seat: 7, name: '小明', acc: 96.4, cpm: 28.2, stars: 3, min: 10, time: '202611211030' };
const s = CS.encode(rec);
ok(s === 'ETS1|12|t2|zh|7|小明|96|28|3|10|202611211030', '編碼格式');
const back = CS.parse(s);
ok(back && back.seat === 7 && back.name === '小明' && back.acc === 96 && back.cpm === 28 && back.unit === 12, '編碼後解得回來');

// 名字裡的 | 和換行要拿掉，不然欄位會錯位
ok(CS.parse(CS.encode(Object.assign({}, rec, { name: '小|明\n' }))).name === '小明', '名字去掉分隔符號');
// 對戰島沒有階別
const duel = CS.parse(CS.encode({ unit: 23, tier: '-', lang: 'en', seat: 30, name: 'Amy', acc: 91, cpm: 34, stars: 2, min: 15 }));
ok(duel && duel.tier === '-' && duel.unit === 23, '打字擂台 tier=-');

// 30 秒功能測試：min 編成 0，解回 0，CSV 寫 0.5、文字「30 秒」
const t30 = CS.encode(Object.assign({}, rec, { min: 0.5 }));
ok(t30.split('|')[9] === '0', '30 秒編成 min=0');
ok(CS.parse(t30) && CS.parse(t30).min === 0, '30 秒解得回來');
ok(CS.minText(0) === '30 秒' && CS.minText(10) === '10 分鐘', 'minText');
ok(CS.toCSV([CS.parse(t30)], 0, '').indexOf(',0.5,') > 0, 'CSV 選擇分鐘寫 0.5');
ok(CS.parse(CS.encode(Object.assign({}, rec, { min: 15 }))).min === 15, '15 分鐘照舊');

// 不是打字島的 QR 一律不收
['https://example.com', '', 'ETS1|12', 'ETS2|12|t2|zh|7|小明|96|28|3|10|202611211030',
  'ETS1|99|t2|zh|7|小明|96|28|3|10|202611211030',     // 沒有這關
  'ETS1|12|t9|zh|7|小明|96|28|3|10|202611211030',     // 階別錯
  'ETS1|12|t2|zh|0|小明|96|28|3|10|202611211030',     // 座號 0
  'ETS1|12|t2|zh|61|小明|96|28|3|10|202611211030',    // 座號超過上限
  'ETS1|12|t2|zh|7|小明|101|28|3|10|202611211030',    // 正確率 > 100
  'ETS1|12|t2|zh|7|小明|96|28|4|10|202611211030',     // 星等 > 3
  'ETS1|12|t2|zh|7|小明|96|28|3|10|2026112110',       // 時間少兩碼
  null, 123].forEach(x => ok(CS.parse(x) === null, '拒收：' + x));

// 同座號重掃 → 更新不新增
const list = [];
ok(CS.upsert(list, CS.parse('ETS1|12|t2|zh|7|小明|80|20|1|10|202611211030')) === 'new', '第一次掃是新增');
ok(CS.upsert(list, CS.parse('ETS1|12|t2|zh|3|小美|90|25|2|10|202611211031')) === 'new', '另一人新增');
ok(CS.upsert(list, CS.parse('ETS1|12|t2|zh|7|小明|96|28|3|10|202611211035')) === 'updated', '重掃是更新');
ok(list.length === 2 && list[0].seat === 3 && list[1].acc === 96, '重掃後筆數不變、依座號排序、成績換新');

// 未交：只算 1..應到人數；超過應到人數的座號不影響
CS.upsert(list, CS.parse('ETS1|12|t2|zh|30|小華|88|22|2|10|202611211040'));
const miss = CS.missing(list, 28);
ok(miss.length === 26 && miss.indexOf(3) < 0 && miss.indexOf(7) < 0 && miss.indexOf(30) < 0, '未交名單只算 1..28');

// CSV
const csv = CS.toCSV(list, 28, '三年二班 第2節');
ok(csv.charCodeAt(0) === 0xFEFF, 'CSV 開頭有 BOM');
ok(csv.indexOf('\r\n') > 0, 'CSV 用 CRLF');
const lines = csv.slice(1).trim().split('\r\n');
ok(lines[0] === '三年二班 第2節', 'CSV 第一行是班級');
ok(lines[1].startsWith('座號,名字,關卡,階別'), 'CSV 中文表頭');
ok(lines.length === 2 + 28 + 1, 'CSV 列數＝標題＋表頭＋28 個座號＋超額 1 人');
ok(lines.some(l => l.startsWith('7,小明,中打特攻,進階,中打,96,28,3,10,2026-11-21,10:35,')), 'CSV 有小明那列');
ok(lines.some(l => l === '5,,,,,,,,,,,未交'), 'CSV 未交列');
ok(lines.some(l => l.startsWith('30,') && l.endsWith('超過應到人數')), 'CSV 標出超過應到人數');
ok(CS.toCSV([Object.assign({}, rec, { name: '=1+1' })], 0).indexOf("'=1+1") > 0, 'CSV 防公式注入');

console.log(fail ? `共 ${fail} 項失敗（通過 ${pass}）` : `全部通過（${pass} 項）`);
process.exit(fail ? 1 : 0);
