// 台灣各縣市教育網路中心的網域代碼。僅用於 PTR 域名切分判斷，非顯示用途。
// 花蓮、南投、金門、連江未查證；查無時退回三段切法，不猜測。
const COUNTY_CODES = new Set([
  'tp', 'ntpc', 'tyc', 'kl', 'ilc', 'hc', 'hcc', 'mlc', 'tc',
  'chc', 'ylc', 'cy', 'cyc', 'tn', 'kh', 'ptc', 'ttct', 'phc',
]);

// 常見主機名前綴，避免把 www.tp.edu.tw 誤切成「www 這間學校」
const HOST_PREFIXES = new Set([
  'www', 'mail', 'host', 'ns', 'ns1', 'ns2', 'gw', 'nat',
  'proxy', 'fw', 'dns', 'smtp', 'web',
]);

/**
 * 解析 TANet whois 回應，取出「用戶單位」層的資訊。
 *
 * 回應含三層：IP 代理發放單位網段（永遠是教育部）、IP 管理單位網段（區網中心）、
 * 用戶單位網段（真實單位）。三層各有一個 Chinese Name 欄位，必須定位到
 * 「用戶單位網段」之後才取值，否則會誤取到「教育部」或區網中心名稱。
 *
 * 非 TANet 配發的位址，回應不含「用戶單位網段」區塊，回 null。
 */
export function parseWhoisUserOrg(html) {
  if (!html) return null;
  const text = html
    .replace(/<[^>]+>/g, '|')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&');

  const idx = text.indexOf('用戶單位網段');
  if (idx === -1) return null;
  const tail = text.slice(idx);

  const orgName = firstField(tail, 'Chinese Name');
  if (!orgName) return null;

  const blockMatch = tail.match(/用戶單位網段[：:]\s*([\d.]+\/\d+)/);
  return {
    orgName,
    orgNameEn: firstField(tail, 'Organization Name'),
    netBlock: blockMatch ? blockMatch[1] : null,
  };
}

function firstField(text, label) {
  const m = text.match(new RegExp(label + '\\s*\\|+\\s*([^|]+)'));
  if (!m) return null;
  return m[1].trim() || null;
}

/**
 * 從 PTR 主機名切出教育機構域名。輔助訊號，用於補足 whois 只到縣市層級的情況。
 */
export function eduDomainFromPtr(ptr) {
  if (!ptr) return null;
  const host = ptr.replace(/\.$/, '').toLowerCase();
  if (!host.endsWith('.edu.tw')) return null;

  const parts = host.split('.');
  if (parts.length < 3) return null;

  // 預設取三段（ntu.edu.tw / tn.edu.tw）
  let take = 3;
  // 若倒數第三段是縣市代碼，代表這是縣市網底下的學校，多取一段
  if (parts.length >= 4 && COUNTY_CODES.has(parts[parts.length - 3])) {
    const candidate = parts[parts.length - 4];
    // 但那一段若是主機名前綴，代表這其實是縣市網自己的主機，退回三段
    if (!HOST_PREFIXES.has(candidate)) take = 4;
  }
  return parts.slice(-take).join('.');
}

export function classify({ orgName, asn, asOrg }) {
  if (orgName) return 'school';
  const org = (asOrg || '').toUpperCase();
  if (asn === 1659 || org.includes('TANET') || org.includes('TAIWAN ACADEMIC')) {
    return 'tanet_unknown';
  }
  return 'other';
}

export function ip24(ip) {
  if (!ip) return null;
  const m = ip.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/);
  return m ? m[1] : null;
}

/** 台北時區的日曆日（YYYY-MM-DD）。禁用 toISOString().slice(0,10)，那會落到前一天。 */
export function taipeiDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date);
}
