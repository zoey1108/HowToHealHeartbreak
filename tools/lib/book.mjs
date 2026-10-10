// 读 book/*.md，拆成节和条目。零依赖。
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BOOK = join(ROOT, 'book');

export const FIELDS = ['成本', '说人话', '收益', '证据等级', '来源', '适用与例外', '备注'];
export const REQUIRED = FIELDS.filter((f) => f !== '备注');

export const TAGS = {
  口径: ['情绪', '睡眠和身体', '钱', '人身安全', '社会关系'],
  钱: ['0', '少', '多'],
  时间: ['少', '中', '多'],
  毅力: ['否', '些', '是'],
  证据: ['A', 'B', 'C'],
};

export const DANGER_RE = /<!-- danger:start -->[\s\S]*?<!-- danger:end -->/;
export const DANGER_SOURCE = '06-危险信号.md';

export function bookFiles() {
  return readdirSync(BOOK).filter((f) => /^\d\d-.+\.md$/.test(f)).sort();
}

export function parseTags(line) {
  const m = line.match(/^<!--\s*(.+?)\s*-->$/);
  if (!m) return null;
  const tags = {};
  for (const pair of m[1].split(/\s+/)) {
    const [k, v] = pair.split('=');
    if (k && v !== undefined) tags[k] = v;
  }
  return tags;
}

export function parseSection(file) {
  const text = readFileSync(join(BOOK, file), 'utf8');
  const lines = text.split('\n');
  const head = lines[0].match(/^# (\d+)\. (.+)$/);
  const section = {
    file,
    text,
    no: head ? Number(head[1]) : null,
    name: head ? head[2] : null,
    intro: '',
    danger: (text.match(DANGER_RE) || [''])[0],
    items: [],
  };
  const firstItem = lines.findIndex((l) => l.startsWith('### '));
  const introLines = lines.slice(1, firstItem === -1 ? lines.length : firstItem);
  section.intro = introLines.join('\n').replace(DANGER_RE, '').trim();

  let cur = null;
  lines.forEach((line, i) => {
    const h = line.match(/^### (\d+)\. (.+)$/);
    if (h) {
      cur = { no: Number(h[1]), title: h[2], line: i + 1, tags: null, fields: {}, order: [] };
      section.items.push(cur);
      const next = lines[i + 1] || '';
      cur.tags = parseTags(next.trim());
      return;
    }
    if (!cur) return;
    const f = line.match(/^- ([^：]+)：(.*)$/);
    if (f && FIELDS.includes(f[1])) {
      cur.fields[f[1]] = f[2].trim();
      cur.order.push(f[1]);
    }
  });
  return section;
}

export function readBook() {
  return bookFiles().map(parseSection);
}

// 去掉 markdown 链接和裸链接，只留读者看到的字
export function plain(s) {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/\*\*/g, '')
    .trim();
}

export function sentences(s) {
  return plain(s)
    .split(/(?<=[。？！])/)
    .map((x) => x.trim())
    .filter(Boolean);
}
