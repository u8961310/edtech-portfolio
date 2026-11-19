import { classify, eduDomainFromPtr, netKey, taipeiDay, validDeviceId } from './parse.js';
import { fetchWhoisOrg, fetchPtr } from './lookup.js';
import REPORT_HTML from './report.html';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === '/c' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const path = typeof body.p === 'string' ? body.p.slice(0, 200) : '/';
      const deviceId = validDeviceId(body.d);
      // 先回應，統計在背景做，絕不讓訪客等外部查詢
      ctx.waitUntil(record(request, env, path, deviceId));
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === '/stats' && request.method === 'GET') {
      // token 優先從 header 帶（不留在網址與瀏覽紀錄），舊的 ?token= 也保留
      const auth = request.headers.get('Authorization') || '';
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : url.searchParams.get('token');
      if (!env.STATS_TOKEN || token !== env.STATS_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      const range = url.searchParams.get('range');
      const days = range === 'all' ? null : Math.min(Math.max(parseInt(range, 10) || 30, 1), 366);
      return Response.json(await stats(env, days), { headers: { 'Cache-Control': 'no-store' } });
    }
    if (url.pathname === '/report' && request.method === 'GET') {
      // 頁面本身不含任何資料，進頁面後輸入 token 才去打 /stats
      return new Response(REPORT_HTML, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Robots-Tag': 'noindex',
          'Referrer-Policy': 'no-referrer',
        },
      });
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function record(request, env, path, deviceId) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip) return;

  const cf = request.cf || {};
  const asn = typeof cf.asn === 'number' ? cf.asn : null;
  const asOrg = cf.asOrganization || null;

  const org = await lookupOrgCached(env, ip);
  const ptrDomain = eduDomainFromPtr(await fetchPtr(ip));
  const day = taipeiDay();
  const sourceType = classify({ orgName: org && org.orgName, asn, asOrg });
  const visitorKey = await sha256(`${ip}|${day}|${env.SALT}`);
  // 裝置編號不跨天換（才認得出回訪），但一樣加 SALT 雜湊，原始編號不落地
  const deviceKey = deviceId ? await sha256(`dev|${deviceId}|${env.SALT}`) : null;

  await env.DB.prepare(
    `INSERT OR IGNORE INTO visits
       (day, path, source_type, org_name, ptr_domain, asn, as_org, visitor_key, device_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    day, path, sourceType,
    org ? org.orgName : null,
    ptrDomain, asn, asOrg, visitorKey, deviceKey,
    new Date().toISOString(),
  ).run();
}

/**
 * 以 /24 為單位快取 whois 結果。查無結果也寫入快取（org_name 為 NULL），
 * 避免對教育部的服務反覆查詢同一個網段。
 */
async function lookupOrgCached(env, ip) {
  const key = netKey(ip); // IPv4 /24 或 IPv6 /48，存在 org_cache.ip24 欄（欄名沿用）
  if (!key) return null;

  const cached = await env.DB.prepare(
    'SELECT org_name, org_name_en, net_block FROM org_cache WHERE ip24 = ?',
  ).bind(key).first();

  if (cached) {
    return cached.org_name
      ? { orgName: cached.org_name, orgNameEn: cached.org_name_en, netBlock: cached.net_block }
      : null;
  }

  const org = await fetchWhoisOrg(ip);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO org_cache (ip24, org_name, org_name_en, net_block, fetched_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(
    key,
    org ? org.orgName : null,
    org ? org.orgNameEn : null,
    org ? org.netBlock : null,
    new Date().toISOString(),
  ).run();

  return org;
}

/**
 * 報表資料。days＝最近幾天（含今天，台北時間）；null＝全部。
 * 一列 visits ＝ 同一訪客同一天看了某一頁（已去重），所以「瀏覽頁數」是去重後的頁數，
 * 「訪客人日」＝ 同一天同一訪客算一次。
 */
async function stats(env, days) {
  const to = taipeiDay();
  const from = days ? taipeiDay(new Date(Date.now() - (days - 1) * 86400000)) : '0000-00-00';
  const q = (sql) => env.DB.prepare(sql).bind(from).all().then((r) => r.results);
  const W = 'WHERE day >= ?1';

  const [summary, orgs, daily, sources, paths] = await Promise.all([
    q(`SELECT COUNT(*) AS pages,
              COUNT(DISTINCT day || visitor_key) AS visitors,
              COUNT(DISTINCT device_key) AS devices,
              MIN(CASE WHEN device_key IS NOT NULL THEN day END) AS devices_since,
              COUNT(DISTINCT CASE WHEN source_type = 'school'
                                  THEN COALESCE(org_name, ptr_domain) END) AS schools,
              MIN(day) AS first_day, MAX(day) AS last_day
         FROM visits ${W}`),
    q(`SELECT COALESCE(org_name, ptr_domain) AS org_name,
              MAX(ptr_domain) AS ptr_domain,
              COUNT(DISTINCT day) AS days,
              COUNT(DISTINCT day || visitor_key) AS visitors,
              COUNT(DISTINCT device_key) AS devices,
              COUNT(*) AS pages,
              MIN(day) AS first_seen,
              MAX(day) AS last_seen
         FROM visits ${W} AND source_type = 'school'
        GROUP BY COALESCE(org_name, ptr_domain)
        ORDER BY visitors DESC, pages DESC, last_seen DESC`),
    q(`SELECT day,
              COUNT(DISTINCT CASE WHEN source_type = 'school' THEN visitor_key END) AS school,
              COUNT(DISTINCT CASE WHEN source_type = 'tanet_unknown' THEN visitor_key END) AS tanet_unknown,
              COUNT(DISTINCT CASE WHEN source_type NOT IN ('school', 'tanet_unknown') THEN visitor_key END) AS other,
              COUNT(DISTINCT visitor_key) AS visitors,
              COUNT(DISTINCT device_key) AS devices,
              COUNT(*) AS pages
         FROM visits ${W}
        GROUP BY day ORDER BY day DESC LIMIT 60`),
    q(`SELECT source_type, COUNT(DISTINCT day || visitor_key) AS visitors, COUNT(*) AS n
         FROM visits ${W} GROUP BY source_type ORDER BY n DESC`),
    q(`SELECT path, COUNT(*) AS n, COUNT(DISTINCT day || visitor_key) AS visitors,
              COUNT(DISTINCT device_key) AS devices
         FROM visits ${W} GROUP BY path ORDER BY n DESC LIMIT 40`),
  ]);

  const counts = Object.fromEntries(sources.map((r) => [r.source_type, r.n]));
  const school = counts.school || 0;
  const unknown = counts.tanet_unknown || 0;
  const academic = school + unknown;

  return {
    range: { days, from: days ? from : summary[0].first_day, to },
    summary: summary[0],
    orgs,
    daily,
    sources,
    paths,
    // 命中率自我監測：學術網路來源中，能辨識到單位名的比例
    hit_rate: { school, tanet_unknown: unknown, rate: academic ? school / academic : null },
  };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
