// Quay video demo ~45 s từ chính game (Playwright ghi màn hình), không dựng hình bằng công cụ khác.
// Ra: docs/submission/demo.mp4 (dọc, cho Portal/mạng xã hội) và docs/demo.gif (đoạn ngắn cho README).
// Cách chạy: npm run build && npx vite preview --host 127.0.0.1 --port 4173 &   rồi   node tools/demo-video.mjs
// Cần ffmpeg trong PATH. CHROMIUM_PATH=... nếu không dùng trình duyệt Playwright đã cài.
import { chromium, devices } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const B = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chiprush-demo-'));
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
// Playwright ghi ở độ phân giải CSS px của khung nhìn → chọn khung nhìn dọc 540×1200 (vẫn là bố cục điện thoại,
// rộng < 760) và ghi đúng cỡ đó, rồi ffmpeg phóng lên 720×1600.
const VW = 540;
const VH = 1200;
const ctx = await b.newContext({ ...devices['Pixel 7'], viewport: { width: VW, height: VH }, recordVideo: { dir: tmp, size: { width: VW, height: VH } } });
const p = await ctx.newPage();
const t0 = Date.now();
const marks = []; // [giây, tên cảnh] để cắt GIF

// đã qua vài màn để mở KIỂM THỬ; chuỗi Chip hôm nay 4 ngày. Chi phí ghi sẵn để CAO (99) để không tự trao
// huy hiệu "Hơn cả AI" — video không được khoe thành tích chưa ai đạt.
await p.addInitScript(() => {
  if (sessionStorage.getItem('seeded')) return;
  sessionStorage.setItem('seeded', '1');
  const d = {};
  for (const id of ['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd09', 'd10', 'd11']) d[id] = { stars: 3, best: { A: 99, D: 9, P: 99 }, hinted: false };
  const t = {};
  for (const id of ['t01', 't02', 't03', 't04']) t[id] = { stars: 3, probes: 1 };
  localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: d, debug: t, runtime: { bestEndless: 1240, best60: 520 }, daily: { lastDate: '2026-10-25', streak: 4, history: {} }, settings: { muted: true, reducedMotion: false } }));
});

/** Dòng chú thích phía trên màn hình (chỉ có trong video, không có trong game). */
async function caption(text) {
  marks.push([(Date.now() - t0) / 1000, text]);
  await p.evaluate((text) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:14px;z-index:99;padding:10px 14px;border-radius:14px;background:rgba(255,176,32,.95);color:#2a1a00;font:700 17px "Be Vietnam Pro",sans-serif;text-align:center;box-shadow:0 6px 24px rgba(0,0,0,.5);pointer-events:none';
      document.body.append(el);
    }
    el.textContent = text;
  }, text);
}
const hook = (expr) => p.evaluate(expr);
async function drag(cells, getCell) {
  const pts = [];
  for (const [c, r] of cells) pts.push(await getCell(c, r));
  await p.mouse.move(pts[0].x, pts[0].y);
  await p.mouse.down();
  for (const q of pts.slice(1)) await p.mouse.move(q.x, q.y, { steps: 6 });
  await p.mouse.up();
}
const designCell = (c, r) => p.evaluate(([c, r]) => window.__CHIPRUSH__.design().cell(c, r), [c, r]);
const debugCell = (c, r) => p.evaluate(([c, r]) => window.__CHIPRUSH__.debug().cell(c, r), [c, r]);

// 1. Màn chính
await p.goto(B + '?e2e&date=2026-10-26&seed=9');
await p.waitForTimeout(600);
await caption('CHIP RUSH – làm một con chip từ A đến Z');
await p.waitForTimeout(2500);

// 2. THIẾT KẾ: vẽ dây d02 bằng tay
await p.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
await p.waitForTimeout(500);
await p.getByRole('button', { name: /^d01 / }).click();
await caption('THIẾT KẾ: kéo ngón tay để nối dây');
await p.waitForTimeout(900);
await drag([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], designCell);
await p.waitForTimeout(500);
await p.getByRole('button', { name: 'KIỂM TRA' }).click();
await caption('Chấm theo Area · Delay · Power như kỹ sư thật');
await p.waitForTimeout(2600);

// 3. d12 bộ cộng đủ: lời giải AI + bật công tắc cho thấy dòng điện chạy
await p.getByRole('button', { name: 'Danh sách màn' }).click();
await p.getByRole('button', { name: /^d12 / }).click();
await hook(() => window.__CHIPRUSH__.design().showAi());
await caption('Bộ cộng đủ của CPU – lời giải của AI kỹ sư');
for (const [c, r] of [[0, 1], [0, 3], [0, 5]]) {
  await p.waitForTimeout(900);
  const q = await designCell(c, r);
  await p.mouse.click(q.x, q.y);
}
await p.waitForTimeout(1200);

// 4. KIỂM THỬ t05: đo 2 dây rồi xem AI đo
await p.goto(B + '?e2e&date=2026-10-26&seed=9');
await p.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
await p.getByRole('button', { name: /^t05 / }).click();
await caption('KIỂM THỬ: chip có 1 lỗi ẩn – đo dây để tìm');
await p.waitForTimeout(1200);
const ws = await hook(() => window.__CHIPRUSH__.debug().wires);
for (const [c, r] of [ws[1], ws[ws.length - 2]]) {
  const q = await debugCell(c, r);
  await p.mouse.click(q.x, q.y);
  await p.waitForTimeout(900);
}
await p.getByRole('button', { name: 'Báo lỗi' }).click();
const [fc, fr] = await hook(() => window.__CHIPRUSH__.debug().faultCell);
const fq = await debugCell(fc, fr);
await p.mouse.click(fq.x, fq.y);
await p.waitForTimeout(400);
await p.getByRole('button', { name: /BÁO: KẸT Ở 1/ }).click();
await p.waitForTimeout(1600);
await p.getByRole('button', { name: 'Xem AI kỹ sư đo' }).click();
await caption('Xem AI kỹ sư suy luận từng bước (minimax)');
await p.waitForTimeout(6500);

// 5. VẬN HÀNH
await p.goto(B + '?e2e&date=2026-10-26&seed=9');
await p.getByRole('button', { name: 'CHƠI NGAY' }).click();
await caption('VẬN HÀNH: chọn cổng đúng trước khi chip chạm ổ cắm');
for (let i = 0; i < 12; i++) {
  await p.waitForTimeout(520);
  const s = await hook(() => window.__CHIPRUSH__.runtime());
  if (!s || s.ended) break;
  await p.keyboard.press(String(['AND', 'OR', 'XOR', 'NAND'].indexOf(s.validGates[0]) + 1));
}
await p.waitForTimeout(600);

// 6. Chip hôm nay + Huy hiệu
await p.goto(B + '?e2e&date=2026-10-26&seed=9');
await caption('Mỗi ngày một đề mới + 12 huy hiệu');
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /^Huy hiệu/ }).click();
await p.waitForTimeout(2200);
await caption('Chơi ngay trên trình duyệt – không cần cài');
await p.waitForTimeout(2200);

const video = p.video();
await ctx.close();
await b.close();
const webm = await video.path();

fs.mkdirSync('docs/submission', { recursive: true });
// MP4 H.264 (phát được ở mọi nơi), 30 fps, nén vừa phải
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-vf', 'fps=30,scale=720:-2:flags=lanczos', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'docs/submission/demo.mp4']);
// GIF ngắn cho README: cảnh THIẾT KẾ (vẽ dây → kết quả), 10 fps, rộng 300 px, bảng màu tối ưu
const start = marks.find(([, t]) => t.startsWith('THIẾT KẾ'))?.[0] ?? 3;
const pal = path.join(tmp, 'pal.png');
const vf = 'fps=10,scale=300:-1:flags=lanczos';
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-t', '6', '-i', webm, '-vf', `${vf},palettegen=max_colors=96`, pal]);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', String(start), '-t', '6', '-i', webm, '-i', pal, '-lavfi', `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4`, 'docs/demo.gif']);
for (const f of ['docs/submission/demo.mp4', 'docs/demo.gif']) console.log(f, (fs.statSync(f).size / 1e6).toFixed(2), 'MB');
console.log('Cảnh:', marks.map(([s, t]) => `${s.toFixed(1)}s ${t}`).join(' | '));
