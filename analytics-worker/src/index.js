import { classify, eduDomainFromPtr, ip24, taipeiDay } from './parse.js';
import { fetchWhoisOrg, fetchPtr } from './lookup.js';

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
      // 先回應，統計在背景做，絕不讓訪客等外部查詢
      ctx.waitUntil(record(request, env, path));
      return new Response(null, { status: 204, headers: CORS });
    }
    if (url.pathname === '/stats' && request.method === 'GET') {
      if (!env.STATS_TOKEN || url.searchParams.get('token') !== env.STATS_TOKEN) {
        return new Response('Unauthorized', { status: 401 });
      }
      return Response.json(await stats(env));
    }
    return new Response('Not Found', { status: 404 });
  },
};

async function record(request, env, path) {
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

  await env.DB.prepare(
    `INSERT OR IGNORE INTO visits
       (day, path, source_type, org_name, ptr_domain, asn, as_org, visitor_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    day, path, sourceType,
    org ? org.orgName : null,
    ptrDomain, asn, asOrg, visitorKey,
    new Date().toISOString(),
  ).run();
}

/**
 * 以 /24 為單位快取 whois 結果。查無結果也寫入快取（org_name 為 NULL），
 * 避免對教育部的服務反覆查詢同一個網段。
 */
async function lookupOrgCached(env, ip) {
  const key = ip24(ip);
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

async function stats(env) {
  const orgs = await env.DB.prepare(
    `SELECT COALESCE(org_name, ptr_domain) AS org_name,
            ptr_domain,
            COUNT(DISTINCT day) AS days,
            MIN(day) AS first_seen
       FROM visits
      WHERE source_type = 'school'
      GROUP BY COALESCE(org_name, ptr_domain)
      ORDER BY days DESC`,
  ).all();

  const sources = await env.DB.prepare(
    `SELECT source_type, COUNT(*) AS n FROM visits GROUP BY source_type`,
  ).all();

  const paths = await env.DB.prepare(
    `SELECT path, COUNT(*) AS n FROM visits GROUP BY path ORDER BY n DESC LIMIT 30`,
  ).all();

  const counts = Object.fromEntries(sources.results.map((r) => [r.source_type, r.n]));
  const school = counts.school || 0;
  const unknown = counts.tanet_unknown || 0;
  const academic = school + unknown;

  return {
    orgs: orgs.results,
    sources: sources.results,
    paths: paths.results,
    // 命中率自我監測：學術網路來源中，能辨識到單位名的比例
    hit_rate: { school, tanet_unknown: unknown, rate: academic ? school / academic : null },
  };
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
