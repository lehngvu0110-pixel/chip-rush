// Tạo ảnh nộp bài vào docs/submission/: 4 ảnh chơi thật (màn chính, THIẾT KẾ, KIỂM THỬ, VẬN HÀNH),
// logo PNG (512, 1024, nền trong suốt) và ảnh bìa 1920×1080. Mọi hình đều từ chính game (vẽ bằng code), không dùng AI tạo ảnh.
// Cách chạy:  npm run build && npx vite preview --host 127.0.0.1 --port 4173 &   rồi   node tools/submission-assets.mjs
// (CHROMIUM_PATH=/đường/dẫn/chrome nếu không dùng trình duyệt Playwright đã cài)
import { chromium, devices } from '@playwright/test';
import fs from 'fs';

const B = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
fs.mkdirSync('docs/submission', { recursive: true });
const out = 'docs/submission/';
const seed = (design, debug = {}, rt = { bestEndless: 0, best60: 0 }) => JSON.stringify({ version: 1, design, debug, runtime: rt, daily: { lastDate: null, streak: 0 }, settings: { muted: true, reducedMotion: false } });
const D = {}; for (let i = 1; i <= 11; i++) D['d' + String(i).padStart(2, '0')] = { stars: i % 4 ? 3 : 2, best: { A: 1, D: 0, P: 1 }, hinted: false };
const T = { t01: { stars: 3, probes: 2 }, t02: { stars: 3, probes: 0 }, t03: { stars: 2, probes: 3 }, t04: { stars: 3, probes: 1 } };
async function page(save) {
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  if (save) await p.addInitScript((s) => localStorage.setItem('chiprush.v1', s), save);
  return p;
}
// 1–2. màn chính + THIẾT KẾ d12 (lời giải AI kỹ sư)
{
  const p = await page(seed(D, T, { bestEndless: 1840, best60: 960 }));
  // ngày mở cổng nộp bài: nút Chip hôm nay hiện 26/10 thay vì ngày chụp
  await p.goto(B + '?e2e&date=2026-10-26');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + '1-man-chinh.png' });
  await p.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await p.getByRole('button', { name: /^d12 / }).click();
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__CHIPRUSH__.design().showAi());
  await p.waitForTimeout(1600);
  await p.screenshot({ path: out + '2-thiet-ke.png' });
}
{ // 3. KIỂM THỬ t05: đã đo 2 dây
  const p = await page(seed(D, T));
  await p.goto(B + '?e2e');
  await p.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
  await p.getByRole('button', { name: /^t05 / }).click();
  await p.waitForTimeout(600);
  const ws = await p.evaluate(() => window.__CHIPRUSH__.debug().wires);
  for (const [c, r] of [ws[1], ws[ws.length - 2]]) { const q = await p.evaluate(([c, r]) => window.__CHIPRUSH__.debug().cell(c, r), [c, r]); await p.mouse.click(q.x, q.y); await p.waitForTimeout(200); }
  await p.waitForTimeout(800);
  await p.screenshot({ path: out + '3-kiem-thu.png' });
}
{ // 4. VẬN HÀNH: vài lượt trả lời đúng
  const p = await page(seed(D, T, { bestEndless: 1840, best60: 960 }));
  await p.goto(B + '?e2e&seed=7');
  await p.getByRole('button', { name: 'CHƠI NGAY' }).click();
  for (let i = 0; i < 6; i++) {
    await p.waitForTimeout(500);
    const s = await p.evaluate(() => window.__CHIPRUSH__.runtime());
    await p.keyboard.press(String(['AND', 'OR', 'XOR', 'NAND'].indexOf(s.validGates[0]) + 1));
  }
  await p.waitForTimeout(900);
  await p.screenshot({ path: out + '4-van-hanh.png' });
}

// ---- logo + ảnh bìa ----
const root = process.cwd();
const svg = fs.readFileSync(`${root}/src/ui/icons.ts`, 'utf8').match(/LOGO_SVG = `([\s\S]*?)`;/)[1].replace('width="96" height="96"', 'width="100%" height="100%"');
const font = (f) => 'data:font/woff2;base64,' + fs.readFileSync(`${root}/src/assets/fonts/${f}`).toString('base64');
const img = (f) => 'data:image/png;base64,' + fs.readFileSync(`${root}/docs/submission/${f}`).toString('base64');
const css = `@font-face{font-family:BVP;src:url(${font('BeVietnamPro-Bold.subset.woff2')});font-weight:700}
@font-face{font-family:BVP;src:url(${font('BeVietnamPro-Regular.subset.woff2')});font-weight:400}
*{margin:0;box-sizing:border-box}body{font-family:BVP,sans-serif}`;
const p = await b.newPage();
// logo nền tối (vuông, bo góc) và logo nền trong suốt
for (const size of [512, 1024]) {
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<style>${css} body{width:${size}px;height:${size}px;background:radial-gradient(circle at 50% 40%,#16204a,#070b18 75%);display:grid;place-items:center}
  .l{width:78%;height:78%;filter:drop-shadow(0 0 ${size / 40}px rgba(56,232,255,.55))}</style><div class=l>${svg}</div>`);
  await p.screenshot({ path: `docs/submission/logo-${size}.png` });
}
await p.setViewportSize({ width: 1024, height: 1024 });
await p.setContent(`<style>${css} body{width:1024px;height:1024px;background:transparent}</style>${svg}`);
await p.screenshot({ path: 'docs/submission/logo-trong-suot-1024.png', omitBackground: true });
// ảnh bìa 1920×1080: logo + tên + 3 ảnh chơi thật
await p.setViewportSize({ width: 1920, height: 1080 });
await p.setContent(`<style>${css}
body{width:1920px;height:1080px;overflow:hidden;color:#e8eeff;background:radial-gradient(circle at 20% 30%,#17224f,#070b18 70%);position:relative}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(56,232,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(56,232,255,.06) 1px,transparent 1px);background-size:48px 48px}
.left{position:absolute;left:110px;top:250px;width:640px}
.logo{width:150px;height:150px;filter:drop-shadow(0 0 18px rgba(56,232,255,.6))}
h1{font-size:118px;font-weight:700;color:#38e8ff;letter-spacing:2px;text-shadow:0 0 30px rgba(56,232,255,.45);margin-top:18px;line-height:1}
.tag{font-size:40px;font-weight:700;margin-top:22px}
.sub{font-size:28px;color:#9aa6c8;margin-top:22px;line-height:1.45}
.pill{display:inline-block;margin-top:34px;padding:12px 26px;border-radius:999px;background:linear-gradient(180deg,#ffd27a,#ffb020);color:#2a1a00;font-size:26px;font-weight:700}
.phones{position:absolute;right:70px;top:70px;display:flex;gap:34px}
.ph{width:300px;height:610px;border-radius:34px;overflow:hidden;border:3px solid rgba(56,232,255,.55);box-shadow:0 0 40px rgba(56,232,255,.25),0 20px 60px rgba(0,0,0,.6);background:#000}
.ph img{width:100%;height:100%;object-fit:cover;object-position:top}
.ph:nth-child(2){margin-top:120px}.ph:nth-child(3){margin-top:240px}
.lab{position:absolute;right:70px;bottom:60px;font-size:22px;color:#9aa6c8}
</style><div class=grid></div>
<div class=left><div class=logo>${svg}</div><h1>CHIP RUSH</h1>
<div class=tag>Thiết kế · Kiểm thử · Vận hành một con chip</div>
<div class=sub>Vẽ mạch, săn lỗi, phản xạ cổng logic — và so tài với "AI kỹ sư" ngay trên điện thoại.</div>
<div class=pill>Chơi ngay trên trình duyệt</div></div>
<div class=phones><div class=ph><img src="${img('2-thiet-ke.png')}"></div><div class=ph><img src="${img('3-kiem-thu.png')}"></div><div class=ph><img src="${img('4-van-hanh.png')}"></div></div>`);
await p.waitForTimeout(300);
await p.screenshot({ path: 'docs/submission/anh-bia-1920x1080.png' });
await b.close();
