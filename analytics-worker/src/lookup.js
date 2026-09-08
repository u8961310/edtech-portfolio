import { parseWhoisUserOrg } from './parse.js';

const TIMEOUT_MS = 5000;
const UA = 'edtech-portfolio-analytics/1.0 (u8961310@gmail.com)';

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 查詢 TANet 官方 whois。這是教育部的公共服務，呼叫端必須先查快取，
 * 確保同一網段只查一次。失敗一律回 null，不重試。
 */
export async function fetchWhoisOrg(ip) {
  try {
    const url = `https://whois.tanet.edu.tw/showWhoisPublic.php?queryString=${encodeURIComponent(ip)}`;
    const res = await fetchWithTimeout(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    return parseWhoisUserOrg(await res.text());
  } catch {
    return null;
  }
}

/** DoH 反查 PTR。輔助訊號，失敗回 null。 */
export async function fetchPtr(ip) {
  const parts = (ip || '').split('.');
  if (parts.length !== 4) return null;
  const name = `${parts[3]}.${parts[2]}.${parts[1]}.${parts[0]}.in-addr.arpa`;
  try {
    const res = await fetchWithTimeout(
      `https://cloudflare-dns.com/dns-query?name=${name}&type=PTR`,
      { headers: { accept: 'application/dns-json' } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const answer = (data.Answer || []).find((a) => a.type === 12);
    return answer ? answer.data : null;
  } catch {
    return null;
  }
}
