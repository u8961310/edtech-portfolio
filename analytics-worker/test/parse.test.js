import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWhoisUserOrg, eduDomainFromPtr, classify, ip24, taipeiDay } from '../src/parse.js';

const fixture = (name) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('parseWhoisUserOrg 取用戶單位，不是代理發放單位或區網中心', () => {
  const r = parseWhoisUserOrg(fixture('whois-hsingwu.html'));
  assert.equal(r.orgName, '新北市私立醒吾高級中學');
  assert.notEqual(r.orgName, '教育部');
  assert.notEqual(r.orgName, '政大區網中心');
  assert.equal(r.netBlock, '163.21.100.0/24');
});

test('parseWhoisUserOrg 對非 TANet 位址回 null', () => {
  assert.equal(parseWhoisUserOrg(fixture('whois-nontanet.html')), null);
});

test('parseWhoisUserOrg 對空輸入回 null', () => {
  assert.equal(parseWhoisUserOrg(''), null);
  assert.equal(parseWhoisUserOrg(null), null);
});

test('eduDomainFromPtr 大專取三段', () => {
  assert.equal(eduDomainFromPtr('www.ntu.edu.tw.'), 'ntu.edu.tw');
});

test('eduDomainFromPtr 縣市網本身取三段，不把主機名當成學校', () => {
  assert.equal(eduDomainFromPtr('www.tp.edu.tw.'), 'tp.edu.tw');
});

test('eduDomainFromPtr 縣市網底下的學校取四段', () => {
  assert.equal(eduDomainFromPtr('www.dxes.tn.edu.tw.'), 'dxes.tn.edu.tw');
  assert.equal(eduDomainFromPtr('host-1.dxes.tn.edu.tw'), 'dxes.tn.edu.tw');
});

test('eduDomainFromPtr 非 edu.tw 回 null', () => {
  assert.equal(eduDomainFromPtr('218-35-132-72.cm.dynamic.apol.com.tw.'), null);
  assert.equal(eduDomainFromPtr(null), null);
});

test('classify 有單位名就是 school', () => {
  assert.equal(classify({ orgName: '國立臺灣大學', asn: 1659, asOrg: 'TANET' }), 'school');
});

test('classify 無單位名但屬 TANet 為 tanet_unknown', () => {
  assert.equal(classify({ orgName: null, asn: 1659, asOrg: 'TANET-TW' }), 'tanet_unknown');
  assert.equal(classify({ orgName: null, asn: 9999, asOrg: 'Taiwan Academic Network TANet' }), 'tanet_unknown');
});

test('classify 其他來源為 other', () => {
  assert.equal(classify({ orgName: null, asn: 3462, asOrg: 'Chunghwa Telecom' }), 'other');
});

test('ip24 取前三段', () => {
  assert.equal(ip24('163.21.100.32'), '163.21.100');
  assert.equal(ip24('2001:db8::1'), null);
  assert.equal(ip24(null), null);
});

test('taipeiDay 回台北時區日曆日', () => {
  // 2026-09-08T16:30:00Z = 台北時間 2026-09-09 00:30
  assert.equal(taipeiDay(new Date('2026-09-08T16:30:00Z')), '2026-09-09');
});
