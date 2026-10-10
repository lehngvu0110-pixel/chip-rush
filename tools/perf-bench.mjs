// Đo hiệu năng tự động khi CHƯA có máy thật: Chromium + giảm tốc CPU qua DevTools Protocol
// (Emulation.setCPUThrottlingRate). Đo khoảng cách giữa các frame (trung vị, p95) ở từng màn chơi,
// và xem bộ điều chất lượng có tự hạ đồ hoạ không. KHÔNG thay được đo trên điện thoại thật:
// Chromium headless vẽ canvas bằng CPU (không GPU) nên số đo thường TỆ hơn máy thật cùng tốc độ CPU.
// Cách chạy: npm run build && npx vite preview --host 127.0.0.1 --port 4173 &  rồi
//   node tools/perf-bench.mjs [hệ_số_giảm_tốc ...]      (mặc định: 1 4 6)
import { chromium, devices } from '@playwright/test';

const B = process.env.BASE_URL ?? 'http://127.0.0.1:4173/';
const rates = process.argv.slice(2).map(Number).filter((x) => x >= 1);
const RATES = rates.length ? rates : [1, 4, 6];
const MEASURE_MS = 5000;
const b = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});

const seed = JSON.stringify({
  version: 1,
  design: Object.fromEntries(['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd09', 'd10', 'd11'].map((i) => [i, { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false }])),
  debug: Object.fromEntries(['t01', 't02', 't03', 't04', 't05', 't06', 't07', 't08'].map((i) => [i, { stars: 3, probes: 1 }])),
  settings: { muted: true, reducedMotion: false },
});

/** Đo khoảng cách frame bằng requestAnimationFrame riêng (không phụ thuộc code game). */
async function sample(p, ms) {
  return p.evaluate(async (ms) => {
    const d = [];
    let last = performance.now();
    const t0 = last;
    await new Promise((res) => {
      const f = (t) => {
        d.push(t - last);
        last = t;
        if (t - t0 < ms) requestAnimationFrame(f);
        else res();
      };
      requestAnimationFrame(f);
    });
    d.sort((a, b) => a - b);
    const q = (x) => d[Math.min(d.length - 1, Math.floor(x * d.length))];
    return { frames: d.length, median: +q(0.5).toFixed(1), p95: +q(0.95).toFixed(1), fps: +((1000 * d.length) / ms).toFixed(0) };
  }, ms);
}

const SCENES = {
  'Màn chính (die chip)': async (p) => p.goto(B + '?e2e'),
  'VẬN HÀNH (đang chơi)': async (p) => {
    await p.goto(B + '?e2e&seed=9');
    await p.getByRole('button', { name: 'CHƠI NGAY' }).click();
    // tự trả lời đúng liên tục để có hiệu ứng nổ hạt, chữ nổi
    await p.evaluate(() => {
      window.__autoplay = setInterval(() => {
        const s = window.__CHIPRUSH__.runtime();
        if (!s || s.ended) return;
        const k = ['AND', 'OR', 'XOR', 'NAND'].indexOf(s.validGates[0]) + 1;
        window.dispatchEvent(new KeyboardEvent('keydown', { key: String(k) }));
      }, 450);
    });
  },
  'THIẾT KẾ d12 (dòng điện chạy)': async (p) => {
    await p.goto(B + '?e2e');
    await p.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
    await p.getByRole('button', { name: /^d12 / }).click();
    await p.evaluate(() => window.__CHIPRUSH__.design().applyAi());
  },
  'KIỂM THỬ t09': async (p) => {
    await p.goto(B + '?e2e');
    await p.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
    await p.getByRole('button', { name: /^t09 / }).click();
  },
};

const rows = [];
for (const rate of RATES) {
  for (const [name, setup] of Object.entries(SCENES)) {
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    const p = await ctx.newPage();
    await p.addInitScript((s) => localStorage.setItem('chiprush.v1', s), seed);
    const cdp = await ctx.newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate });
    await setup(p);
    await p.waitForTimeout(Number(process.env.WARMUP_MS ?? 2500)); // bỏ qua lúc tải + khởi động (đặt WARMUP_MS lớn để đo SAU khi game tự hạ đồ hoạ)
    const r = await sample(p, MEASURE_MS);
    // chất lượng do game tự quyết (cần ≥ 120 frame); chờ thêm để bộ điều kịp xét
    await p.waitForTimeout(2500);
    const g = await p.evaluate(() => window.__CHIPRUSH__.perf());
    rows.push({ rate: `${rate}×`, scene: name, ...r, quality: g.quality });
    console.log(`${rate}×  ${name.padEnd(30)} trung vị ${String(r.median).padStart(5)} ms  p95 ${String(r.p95).padStart(5)} ms  ${String(r.fps).padStart(3)} fps  đồ hoạ: ${g.quality}`);
    await ctx.close();
  }
}
await b.close();
