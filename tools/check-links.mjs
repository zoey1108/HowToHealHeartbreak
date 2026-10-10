// 检查来源栏里的链接能不能打开。DOI 走 doi.org 解析，只看能不能解析到。
// 用法：node tools/check-links.mjs
import { readBook } from './lib/book.mjs';

const urls = new Map();
for (const s of readBook()) {
  for (const it of s.items) {
    for (const u of (it.fields['来源'] || '').match(/https?:\/\/[^\s；，<>]+/g) || []) {
      const clean = u.replace(/[。）)]+$/, '');
      if (!urls.has(clean)) urls.set(clean, []);
      urls.get(clean).push(`第 ${s.no} 节第 ${it.no} 条`);
    }
  }
}

async function ok(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        headers: { 'user-agent': 'Mozilla/5.0 (link check; HowToHealHeartbreak)' },
        signal: AbortSignal.timeout(20000),
      });
      // 出版社常对机器人回 403，但 doi.org 能解析到就说明 DOI 是真的
      if (res.ok || (url.includes('doi.org') && [401, 403, 418, 429].includes(res.status))) return true;
      if (method === 'GET') return `HTTP ${res.status}`;
    } catch (e) {
      // 不少政府网站证书链不完整：浏览器会自己补中间证书，Node 不会。这类只提醒，不算坏链
      if (/CERT|CERTIFICATE|LEAF_SIGNATURE/.test(e.cause?.code || '')) return 'cert';
      if (method === 'GET') return e.name === 'TimeoutError' ? '超时' : e.message;
    }
  }
}

const bad = [];
const certs = [];
await Promise.all(
  [...urls.keys()].map(async (u) => {
    const r = await ok(u);
    if (r === 'cert') certs.push(`${u}  （${urls.get(u).join('、')}）`);
    else if (r !== true) bad.push(`${r}  ${u}  （${urls.get(u).join('、')}）`);
  }),
);
if (certs.length) console.warn('证书链不完整，脚本验证不了，用浏览器打开看一眼：\n  ' + certs.join('\n  '));
if (bad.length) {
  console.error('打不开的链接：\n  ' + bad.join('\n  '));
  process.exit(1);
}
console.log(`${urls.size - certs.length} 个链接都能打开。`);
