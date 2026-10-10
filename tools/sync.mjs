// 把 06-危险信号.md 里的危险信号块抄进每一节，并刷新 README 里的统计数字。
// 用法：node tools/sync.mjs          直接改文件
//       node tools/sync.mjs --check  只检查，不一致就以非零退出（CI 用）
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, BOOK, DANGER_RE, DANGER_SOURCE, readBook } from './lib/book.mjs';

const check = process.argv.includes('--check');
const stale = [];

function update(path, next) {
  const prev = readFileSync(path, 'utf8');
  if (prev === next) return;
  stale.push(path.replace(ROOT + '/', ''));
  if (!check) writeFileSync(path, next);
}

// 1. 危险信号块
const sourceText = readFileSync(join(BOOK, DANGER_SOURCE), 'utf8');
const block = (sourceText.match(DANGER_RE) || [])[0];
if (!block) {
  console.error(`${DANGER_SOURCE} 里找不到危险信号块`);
  process.exit(1);
}
for (const s of readBook()) {
  if (s.file === DANGER_SOURCE) continue;
  const path = join(BOOK, s.file);
  const text = readFileSync(path, 'utf8');
  if (!DANGER_RE.test(text)) {
    console.error(`${s.file} 里没有 <!-- danger:start --> 标记，先手动加上`);
    process.exit(1);
  }
  update(path, text.replace(DANGER_RE, block));
}

// 2. README 统计
const book = readBook();
const items = book.flatMap((s) => s.items);
const count = (lv) => items.filter((it) => it.fields['证据等级'] === lv).length;
const disputed = items.filter((it) => (it.fields['备注'] || '').startsWith('争议')).length;
const stats =
  `<!-- stats:start -->\n` +
  `目前 ${book.length} 节、${items.length} 条：A 级 ${count('A')} 条、B 级 ${count('B')} 条、C 级 ${count('C')} 条，其中 ${disputed} 条标了争议。\n` +
  `<!-- stats:end -->`;
const readme = join(ROOT, 'README.md');
const rtext = readFileSync(readme, 'utf8');
update(readme, rtext.replace(/<!-- stats:start -->[\s\S]*?<!-- stats:end -->/, stats));

if (check && stale.length) {
  console.error('这些文件没同步，跑一下 node tools/sync.mjs：\n  ' + stale.join('\n  '));
  process.exit(1);
}
console.log(stale.length ? `已同步：${stale.join('、')}` : '都是最新的。');
