// 检查正文格式。有错就以非零退出，CI 靠它把关。
// 用法：node tools/check.mjs
import { readBook, REQUIRED, FIELDS, TAGS, DANGER_SOURCE, plain, sentences } from './lib/book.mjs';

const errors = [];
const warn = [];
const book = readBook();
const at = (s, it) => `${s.file}:${it.line} 第 ${s.no} 节第 ${it.no} 条`;

const SENTENCE_MAX = 50;
const PLAIN_MAX = 120;
const BANNED_IN_PLAIN = /\b(HR|RR|OR|CI|RCT|p\s*[<=>])|队列|荟萃|置信区间/;

// 节号要从 1 连续
book.forEach((s, i) => {
  if (s.no !== i + 1) errors.push(`${s.file}: 节号应为 ${i + 1}，实际是 ${s.no}`);
  if (!s.danger) errors.push(`${s.file}: 缺少危险信号块（<!-- danger:start --> … <!-- danger:end -->）`);
});

for (const s of book) {
  s.items.forEach((it, i) => {
    const where = at(s, it);
    if (it.no !== i + 1) errors.push(`${where}: 条号应为 ${i + 1}`);

    // 标签行
    if (!it.tags) {
      errors.push(`${where}: 标题下一行必须是标签注释 <!-- 口径=… 钱=… 时间=… 毅力=… 证据=… -->`);
    } else {
      for (const [k, allowed] of Object.entries(TAGS)) {
        if (!(k in it.tags)) errors.push(`${where}: 标签缺少「${k}」`);
        else if (!allowed.includes(it.tags[k])) errors.push(`${where}: 标签「${k}=${it.tags[k]}」不在 ${allowed.join('/')} 里`);
      }
    }

    // 字段齐全、顺序对
    for (const f of REQUIRED) if (!it.fields[f]) errors.push(`${where}: 缺少「${f}」栏`);
    const expected = FIELDS.filter((f) => it.order.includes(f));
    if (expected.join() !== it.order.join()) errors.push(`${where}: 栏目顺序应为 ${expected.join('、')}`);

    const level = it.fields['证据等级'];
    if (level && !TAGS.证据.includes(level)) errors.push(`${where}: 证据等级只能是 A/B/C`);
    if (it.tags && level && it.tags.证据 !== level) errors.push(`${where}: 标签里证据=${it.tags.证据}，正文写的是 ${level}`);

    // A/B 必须有链接；C 级没有文献时写「无直接文献」
    const src = it.fields['来源'] || '';
    if ((level === 'A' || level === 'B') && !/https?:\/\//.test(src)) errors.push(`${where}: ${level} 级必须在来源栏给出链接`);
    if (/待核实|TODO/.test(src)) warn.push(`${where}: 来源里还有待核实`);

    // 说人话
    const p = it.fields['说人话'] || '';
    const len = plain(p).replace(/\s/g, '').length;
    if (len > PLAIN_MAX) errors.push(`${where}: 说人话 ${len} 字，超过 ${PLAIN_MAX}`);
    if (BANNED_IN_PLAIN.test(p)) errors.push(`${where}: 说人话里不写统计术语（${p.match(BANNED_IN_PLAIN)[0]}）`);

    // 句长
    for (const f of ['成本', '说人话', '适用与例外']) {
      for (const sen of sentences(it.fields[f] || '')) {
        const n = sen.replace(/\s/g, '').length;
        if (n > SENTENCE_MAX) errors.push(`${where}: ${f}栏有一句 ${n} 字，超过 ${SENTENCE_MAX}：「${sen.slice(0, 20)}…」`);
      }
    }

    // 争议必须开头
    const note = it.fields['备注'];
    if (note && note.includes('争议') && !note.startsWith('争议')) errors.push(`${where}: 备注里有争议的，要以「争议」开头`);

    // 不用感叹号
    for (const f of FIELDS) if (/[!！]/.test(it.fields[f] || '')) errors.push(`${where}: ${f}栏用了感叹号`);
  });
}

// 指路：「见第 N 节第 M 条（…）」或同节「见第 M 条（…）」，括号里的字要在目标标题里
const bySec = new Map(book.map((s) => [s.no, s]));
const REF = /(原书)?(?:《[^》]+》)?第\s*(\d+)\s*节第\s*(\d+)\s*条(?:（([^）]+)）)?|(?<![节书])第\s*(\d+)\s*条（([^）]+)）/g;
function anchorOk(anchor, title) {
  const a = anchor.replace(/[\s「」、，]/g, '');
  // 括号里任意连续 4 个字出现在标题里就算对上（短于 4 字的整段要对上）
  if (a.length <= 4) return title.includes(a);
  for (let i = 0; i + 4 <= a.length; i++) if (title.includes(a.slice(i, i + 4))) return true;
  return false;
}
for (const s of book) {
  const lines = s.text.split('\n');
  lines.forEach((line, i) => {
    if (line.startsWith('### ') || line.startsWith('<!--')) return;
    for (const m of line.matchAll(REF)) {
      if (m[1] || /原书[^。]{0,12}$/.test(line.slice(0, m.index))) continue; // 指向原书的不查
      if (/《[^》]+》/.test(m[0])) continue; // 法条条号
      const secNo = m[2] ? Number(m[2]) : s.no;
      const itemNo = Number(m[3] || m[5]);
      const anchor = m[4] || m[6];
      const target = bySec.get(secNo)?.items.find((x) => x.no === itemNo);
      const where = `${s.file}:${i + 1}`;
      if (!target) {
        errors.push(`${where}: 指路「${m[0]}」找不到目标条目`);
        continue;
      }
      if (!anchor) errors.push(`${where}: 指路「${m[0]}」后面要用括号写上目标标题里的几个字`);
      else if (!anchorOk(anchor, target.title)) errors.push(`${where}: 指路「${m[0]}」括号里的字和目标标题「${target.title}」对不上`);
    }
  });
}

// 危险信号块要和 06 一致
const src = book.find((s) => s.file === DANGER_SOURCE);
if (!src) errors.push(`找不到 ${DANGER_SOURCE}`);
else {
  if (!/12356/.test(src.danger) || !/110/.test(src.danger)) errors.push(`${DANGER_SOURCE}: 危险信号块里必须有 12356 和 110`);
  for (const s of book) if (s.danger !== src.danger) errors.push(`${s.file}: 危险信号块和 ${DANGER_SOURCE} 不一致，跑一下 node tools/sync.mjs`);
}

for (const w of warn) console.warn('提醒  ' + w);
if (errors.length) {
  for (const e of errors) console.error('错误  ' + e);
  console.error(`\n共 ${errors.length} 处错误。`);
  process.exit(1);
}
const n = book.reduce((a, s) => a + s.items.length, 0);
console.log(`通过：${book.length} 节，${n} 条。`);
