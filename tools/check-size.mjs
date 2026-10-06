// Kiểm tra ngân sách tải (xem mục "Yêu cầu phi chức năng" trong kế hoạch). CI đỏ nếu vượt.
// Chạy sau `vite build`: node tools/check-size.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { gzipSync } from 'node:zlib';

const KB = 1024;
const BUDGET = { js: 120 * KB, css: 15 * KB, font: 60 * KB, image: 5 * KB, total: 200 * KB };
// Không tính vào lần tải đầu: ảnh xem trước link và file giấy phép.
const EXCLUDE = [/og-image\.png$/, /licenses\//];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function kind(file) {
  const ext = extname(file);
  if (ext === '.js') return 'js';
  if (ext === '.css') return 'css';
  if (ext === '.woff2' || ext === '.woff') return 'font';
  if (['.svg', '.png', '.jpg', '.webp', '.ico'].includes(ext)) return 'image';
  return 'other';
}

const sums = { js: 0, css: 0, font: 0, image: 0, other: 0 };
for (const file of walk('dist')) {
  if (EXCLUDE.some((re) => re.test(file))) continue;
  const buf = readFileSync(file);
  const k = kind(file);
  // woff2 đã nén sẵn nên tính kích thước thật; còn lại tính sau gzip như khi server gửi.
  sums[k] += k === 'font' ? buf.length : gzipSync(buf, { level: 9 }).length;
}
const total = Object.values(sums).reduce((a, b) => a + b, 0);

let ok = true;
const row = (name, size, limit) => {
  const pass = limit === undefined || size <= limit;
  if (!pass) ok = false;
  const lim = limit === undefined ? '' : ` / ${(limit / KB).toFixed(0)} KB`;
  console.log(`${pass ? 'OK  ' : 'VƯỢT'} ${name.padEnd(6)} ${(size / KB).toFixed(1).padStart(7)} KB${lim}`);
};
for (const k of ['js', 'css', 'font', 'image']) row(k, sums[k], BUDGET[k]);
row('other', sums.other);
row('total', total, BUDGET.total);
if (!ok) {
  console.error('\nVượt ngân sách tải. Xem docs/adr và mục ngân sách trong kế hoạch trước khi nới giới hạn.');
  process.exit(1);
}
