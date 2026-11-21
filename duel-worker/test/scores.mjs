// 老師收成績手機配對轉送測試：先在 duel-worker 開 `npx wrangler dev --port 8788`，再跑 `node test/scores.mjs [ws://127.0.0.1:8788]`
import assert from 'node:assert';

const BASE = process.argv[2] || 'ws://127.0.0.1:8788';
const ORIGIN = 'http://localhost:8000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function client(name) {
  const c = { name, events: [], ws: null };
  c.open = (path, origin = ORIGIN) => new Promise((resolve, reject) => {
    c.ws = new WebSocket(BASE + path, { headers: { Origin: origin } });
    c.ws.onopen = () => resolve(c);
    c.ws.onerror = (e) => reject(new Error(name + ' 連線失敗 ' + (e.message || '')));
    c.ws.onmessage = (ev) => c.events.push(JSON.parse(ev.data));
    c.ws.onclose = (ev) => c.events.push({ t: '_close', code: ev.code });
  });
  c.send = (o) => c.ws.send(JSON.stringify(o));
  c.wait = async (t, pred = () => true, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const e = c.events.find((x) => x.t === t && !x._seen && pred(x));
      if (e) { e._seen = true; return e; }
      await sleep(20);
    }
    throw new Error(`${name} 等不到 ${t}`);
  };
  return c;
}

let n = 0;
async function t(name, fn) { await fn(); n++; console.log('ok', name); }
const REC = 'ETS1|12|t2|zh|7|小明|96|28|3|10|202611211030';

const desk = client('desk'), phone = client('phone');
let code;

await t('不明網站來源會被擋', async () => {
  const ok = await new Promise((resolve) => {
    const w = new WebSocket(BASE + '/scores?role=desk', { headers: { Origin: 'https://evil.example.com' } });
    w.onopen = () => { w.close(); resolve(true); };
    w.onerror = () => resolve(false);
  });
  assert.equal(ok, false);
});

await t('配對碼格式不對會被擋', async () => {
  const ok = await new Promise((resolve) => {
    const w = new WebSocket(BASE + '/scores?role=phone&code=1234', { headers: { Origin: ORIGIN } });
    w.onopen = () => { w.close(); resolve(true); };
    w.onerror = () => resolve(false);
  });
  assert.equal(ok, false);
});

await t('電腦開配對拿到 16 碼配對碼', async () => {
  await desk.open('/scores?role=desk');
  const h = await desk.wait('hello');
  assert.match(h.code, /^[a-z0-9]{16}$/);
  assert.equal(h.phones, 0);
  code = h.code;
});

await t('手機連進來：電腦知道有 1 支手機、手機知道電腦在線', async () => {
  await phone.open('/scores?role=phone&code=' + code);
  const h = await phone.wait('hello');
  assert.equal(h.desk, true);
  const p = await desk.wait('phones');
  assert.equal(p.n, 1);
});

await t('手機送成績 → 電腦收到 → 電腦回 ack → 手機收到', async () => {
  phone.send({ t: 'rec', id: 'a1', text: REC });
  const r = await desk.wait('rec');
  assert.equal(r.text, REC);
  assert.equal(r.id, 'a1');
  desk.send({ t: 'ack', id: 'a1', ok: true, kind: 'new', seat: 7, name: '小明', acc: 96, cpm: 28, have: 1, expected: 28, extra: 'x'.repeat(300) });
  const a = await phone.wait('ack');
  assert.equal(a.ok, true); assert.equal(a.seat, 7); assert.equal(a.kind, 'new'); assert.equal(a.have, 1);
  assert.equal(a.extra, undefined, '多的欄位不轉送');
});

await t('不是 ETS1 的文字不轉給電腦', async () => {
  phone.send({ t: 'rec', id: 'b1', text: 'https://evil.example.com' });
  const a = await phone.wait('ack', (x) => x.id === 'b1');
  assert.equal(a.ok, false); assert.equal(a.reason, 'bad');
  await sleep(200);
  assert.ok(!desk.events.some((e) => e.t === 'rec' && e.id === 'b1'));
});

await t('電腦重新整理（同配對碼接回）：手機不用重配', async () => {
  const desk2 = client('desk2');
  await desk2.open('/scores?role=desk&code=' + code);
  const h = await desk2.wait('hello');
  assert.equal(h.code, code); assert.equal(h.phones, 1);
  await desk.wait('_close', (e) => e.code === 4010);       // 舊分頁被換掉
  phone.send({ t: 'rec', id: 'c1', text: REC });
  const r = await desk2.wait('rec', (x) => x.id === 'c1');
  assert.equal(r.text, REC);
  desk2.ws.close();
  const off = await phone.wait('desk', (x) => x.online === false);
  assert.equal(off.online, false);
});

await t('電腦離線時手機送成績會收到提示', async () => {
  phone.send({ t: 'rec', id: 'd1', text: REC });
  const a = await phone.wait('ack', (x) => x.id === 'd1');
  assert.equal(a.ok, false); assert.equal(a.reason, 'offline');
});

await t('電腦回來，手機收到上線通知', async () => {
  const desk3 = client('desk3');
  await desk3.open('/scores?role=desk&code=' + code);
  await phone.wait('desk', (x) => x.online === true);
  desk3.ws.close();
});

await t('打字擂台 /health 還在', async () => {
  const res = await fetch(BASE.replace(/^ws/, 'http') + '/health');
  assert.equal(await res.text(), 'ok');
});

phone.ws.close();
console.log(`全部 ${n} 項通過`);
process.exit(0);
