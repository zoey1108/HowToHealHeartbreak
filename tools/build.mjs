// 生成 dist/ 下的三样东西：
//   HowToHealHeartbreak.html  离线检索页（单文件，双击能开）
//   print.html                给 PDF 用的打印版（CI 用无头 Chrome 转 PDF）
//   card-72h.html             72 小时卡片（CI 用无头 Chrome 截成 PNG）
// 生成后自查：每个出口的首屏都要有 12356 和 110。
// 用法：node tools/build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { ROOT, TAGS, DANGER_SOURCE, readBook } from './lib/book.mjs';

const DIST = join(ROOT, 'dist');
mkdirSync(DIST, { recursive: true });

const book = readBook();
const items = book.flatMap((s) => s.items);
const repo = `https://github.com/${process.env.GITHUB_REPOSITORY || 'zoey1108/HowToHealHeartbreak'}`;
let sha = (process.env.GITHUB_SHA || '').slice(0, 7);
if (!sha) {
  try { sha = execSync('git rev-parse --short HEAD', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { sha = 'local'; }
}
const version = `${new Date().toISOString().slice(0, 10)} · ${sha}`;
const count = (lv) => items.filter((it) => it.fields['证据等级'] === lv).length;
const stats = `${book.length} 节 ${items.length} 条 · A 级 ${count('A')} · B 级 ${count('B')} · C 级 ${count('C')}`;

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inline = (s, link) =>
  esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t) => (link ? `<a href="#s6">${t}</a>` : t));

// 危险信号块：markdown 引用块 → HTML
function dangerHtml(link = true) {
  const src = book.find((s) => s.file === DANGER_SOURCE).danger;
  const lines = src.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, '')).filter(Boolean);
  const head = lines.find((l) => !l.startsWith('- '));
  const lis = lines.filter((l) => l.startsWith('- ')).map((l) => `<li>${inline(l.slice(2), link)}</li>`);
  return `<p>${inline(head, false).replace(/<\/?strong>/g, '')}</p><ul>${lis.join('')}</ul>`;
}

// 首屏自查：危险信号块要出现在第一个条目之前，且含 12356 和 110
function assertDangerFirst(name, html, firstItemMarker) {
  const d = html.indexOf('12356');
  const p = html.indexOf('110', d);
  const first = html.indexOf(firstItemMarker);
  if (d === -1 || p === -1 || (first !== -1 && first < d)) {
    console.error(`${name}: 首屏没有 12356 / 110，或者被放到了条目后面`);
    process.exit(1);
  }
}

// 1. 离线检索页
const data = {
  repo, version, stats,
  kinds: TAGS.口径,
  danger: dangerHtml(true),
  sections: book.map((s) => ({
    no: s.no, name: s.name, intro: s.intro,
    items: s.items.map((it) => ({ no: it.no, title: it.title, tags: it.tags, fields: it.fields })),
  })),
};
const template = readFileSync(join(ROOT, 'tools', 'site', 'template.html'), 'utf8');
const site = template.replace('/*__DATA__*/null', JSON.stringify(data).replace(/</g, '\\u003c'));
// 检索页的条目是脚本渲染的，查危险信号的容器在列表容器之前、且数据里有号码
if (site.indexOf('id="danger"') > site.indexOf('id="list"') || !data.danger.includes('12356') || !data.danger.includes('110')) {
  console.error('检索页：危险信号块缺失或不在首屏');
  process.exit(1);
}
writeFileSync(join(DIST, 'HowToHealHeartbreak.html'), site);
writeFileSync(join(DIST, 'index.html'), site);

// 2. 打印版
const FONT = `-apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Noto Sans SC", sans-serif`;
const field = (k, v) => (v ? `<dt>${k}</dt><dd>${inline(v, false).replace(/(https?:\/\/[^\s<；]+)/g, '<span class="url">$1</span>')}</dd>` : '');
const printHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>失恋后自救手册</title>
<style>
@page { size: A4; margin: 18mm 16mm; }
body { font: 10.5pt/1.7 ${FONT}; color: #222; margin: 0; }
h1 { font-size: 24pt; margin: 0 0 4pt; } .sub { color: #555; margin: 0 0 12pt; }
.danger { border-left: 3pt solid #a23b2a; background: #fbece8; padding: 8pt 12pt; margin: 12pt 0 18pt; }
.danger p { margin: 0 0 4pt; font-weight: 700; color: #a23b2a; } .danger ul { margin: 0; padding-left: 16pt; }
h2 { font-size: 16pt; margin: 0 0 6pt; break-before: page; } h2.first { break-before: auto; }
.intro { color: #555; } .item { break-inside: avoid; border-top: 0.5pt solid #ddd; padding: 8pt 0; }
h3 { font-size: 11.5pt; margin: 0 0 4pt; } .plain { margin: 0 0 4pt; }
dl { margin: 0; } dt { color: #777; font-size: 9pt; margin-top: 3pt; } dd { margin: 0; }
.url { word-break: break-all; font-size: 8.5pt; color: #555; } .meta { color: #777; font-size: 9pt; }
</style></head><body>
<h1>失恋后自救手册</h1>
<p class="sub">分手以后，哪些事要先保住，哪些决定要往后放，什么时候该去找专业帮助。不教挽回，不教报复。<br>${stats} · 版本 ${version} · ${repo}</p>
<div class="danger">${dangerHtml(false)}</div>
${book.map((s, i) => `<h2 id="s${s.no}"${i === 0 ? ' class="first"' : ''}>${s.no}. ${esc(s.name)}</h2>
<p class="intro">${inline(s.intro.replace(/\n+/g, ' '), false)}</p>
${s.items.map((it) => `<div class="item"><h3>${s.no}.${it.no} ${esc(it.title)}</h3>
<p class="meta">${esc(it.tags.口径)} · 证据 ${it.fields['证据等级']}</p>
<p class="plain">${inline(it.fields['说人话'], false)}</p>
<dl>${field('成本', it.fields['成本'])}${field('收益', it.fields['收益'])}${field('来源', it.fields['来源'])}${field('适用与例外', it.fields['适用与例外'])}${field('备注', it.fields['备注'])}</dl></div>`).join('\n')}`).join('\n')}
<p class="sub" style="margin-top:24pt">正文以 CC BY 4.0 发布。内容可能有错，也可能过时。看病、报警、打官司时，以医生、警察和律师的说法为准。</p>
</body></html>`;
assertDangerFirst('打印版', printHtml, 'class="item"');
writeFileSync(join(DIST, 'print.html'), printHtml);

// 3. 72 小时卡片（1080 宽，竖版）
const first = book[0];
const cardHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>分手后的头 72 小时</title>
<style>
html, body { margin: 0; background: #f6efe9; }
.card { width: 1080px; min-height: 1920px; box-sizing: border-box; padding: 96px 88px 72px; font-family: ${FONT}; color: #2a2522;
  background: linear-gradient(180deg, #f6efe9 0%, #f1e4e0 100%); display: flex; flex-direction: column; }
.kicker { font-size: 30px; color: #8a4b5c; letter-spacing: .1em; margin: 0 0 16px; }
h1 { font-size: 76px; line-height: 1.2; margin: 0 0 20px; }
.lead { font-size: 32px; line-height: 1.6; color: #5c544e; margin: 0 0 48px; }
ol { list-style: none; padding: 0; margin: 0 0 48px; counter-reset: n; }
ol > li { counter-increment: n; display: flex; gap: 28px; font-size: 38px; line-height: 1.5; margin: 0 0 34px; }
ol > li::before { content: counter(n); flex: none; width: 64px; height: 64px; border-radius: 50%; background: #8a4b5c; color: #fff;
  font-size: 34px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-top: 2px; }
.danger { background: #fff; border-left: 10px solid #a23b2a; border-radius: 16px; padding: 32px 40px; font-size: 32px; line-height: 1.6; }
.danger p { margin: 0 0 8px; font-weight: 700; color: #a23b2a; } .danger ul { margin: 0; padding-left: 36px; }
.danger strong { font-size: 1.15em; }
.danger li { margin: 0 0 6px; }
.foot { margin-top: auto; padding-top: 48px; font-size: 26px; color: #7a716a; }
</style></head><body><div class="card">
<p class="kicker">失恋后自救手册</p>
<h1>分手后的头 72 小时</h1>
<p class="lead">先守住身体，钱和账号别出事。别的都可以往后放。</p>
<div class="danger">${dangerHtml(false).replace(/<li>[^<]*什么情况该去医院挂号[\s\S]*?<\/li>/, '')}</div>
<ol style="margin-top:48px">${first.items.map((it) => `<li><span>${esc(it.title)}</span></li>`).join('')}</ol>
<p class="foot">每条的依据、例外和出处：${repo.replace('https://', '')}<br>CC BY 4.0 · ${version}</p>
</div></body></html>`;
assertDangerFirst('72 小时卡片', cardHtml, '<li><span>');
writeFileSync(join(DIST, 'card-72h.html'), cardHtml);

console.log(`已生成 dist/：HowToHealHeartbreak.html、index.html、print.html、card-72h.html（${stats}）`);
