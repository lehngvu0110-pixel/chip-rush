// E2E độ bền: game không được văng lỗi dù người chơi chạm lung tung, trình duyệt chặn lưu trữ,
// dữ liệu lưu hỏng, đổi cỡ/xoay màn hình giữa ván, hay chuyển tab.
import { expect, test, type Page } from '@playwright/test';

/** Gom lỗi: exception chưa bắt + console.error + màn hình lỗi của game. */
function watchErrors(page: Page): string[] {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') errs.push(`console: ${m.text()}`);
  });
  return errs;
}

/** RNG có seed để lần chạy lỗi tái lập được. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chạm/kéo ngẫu nhiên lên canvas + bấm ngẫu nhiên các nút công cụ đang hiện (trừ nút rời màn). */
async function monkey(page: Page, steps: number, seed: number): Promise<void> {
  const r = rng(seed);
  const vp = page.viewportSize()!;
  for (let i = 0; i < steps; i++) {
    const k = r();
    if (k < 0.2) {
      const btns = page.locator('.design-bar button:visible, .design-ctx button:visible');
      const n = await btns.count();
      if (n > 0) await btns.nth(Math.floor(r() * n)).click({ timeout: 1000 }).catch(() => {});
    } else if (k < 0.55) {
      await page.mouse.click(r() * vp.width, r() * vp.height * 0.8);
    } else {
      const x = r() * vp.width;
      const y = r() * vp.height * 0.8;
      await page.mouse.move(x, y);
      await page.mouse.down();
      for (let s = 0; s < 4; s++) await page.mouse.move(x + (r() - 0.5) * 200, y + (r() - 0.5) * 200, { steps: 2 });
      await page.mouse.up();
    }
    // thẻ kết quả hiện ra (qua màn / thua) → đóng để chạm tiếp
    if (await page.getByRole('dialog', { name: 'Kết quả' }).isVisible()) {
      const back = page.getByRole('button', { name: /Tối ưu tiếp|Chơi lại/ }).first();
      if (await back.isVisible()) await back.click();
    }
  }
}

const OPEN_ALL = JSON.stringify({
  version: 1,
  design: Object.fromEntries(['d01', 'd02', 'd03', 'd04', 'd05', 'd06', 'd07', 'd08', 'd09', 'd10', 'd11'].map((i) => [i, { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false }])),
  debug: Object.fromEntries(['t01', 't02', 't03', 't04', 't05', 't06', 't07', 't08'].map((i) => [i, { stars: 3, probes: 1 }])),
  settings: { muted: true, reducedMotion: false },
});

test.describe('chạm ngẫu nhiên (monkey test) không làm văng lỗi', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem('chiprush.v1', s), OPEN_ALL);
  });
  for (const [name, open] of [
    ['THIẾT KẾ d12', async (p: Page) => { await p.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click(); await p.getByRole('button', { name: /^d12 / }).click(); }],
    ['THIẾT KẾ d09 (2 lớp + via)', async (p: Page) => { await p.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click(); await p.getByRole('button', { name: /^d09 / }).click(); }],
    ['KIỂM THỬ t09', async (p: Page) => { await p.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click(); await p.getByRole('button', { name: /^t09 / }).click(); }],
    ['VẬN HÀNH', async (p: Page) => { await p.getByRole('button', { name: 'CHƠI NGAY' }).click(); }],
    ['Chip hôm nay', async (p: Page) => { await p.getByRole('button', { name: /^Chip hôm nay/ }).click(); }],
  ] as const) {
    test(name, async ({ page, browserName }) => {
      // chạy 1 trình duyệt là đủ (mỗi lượt ~40 s); logic game giống nhau giữa các trình duyệt
      test.skip(browserName !== 'chromium', 'monkey test chỉ chạy trên Chromium để CI không quá lâu');
      test.setTimeout(120_000);
      const errs = watchErrors(page);
      await page.goto('/?e2e&seed=5');
      await open(page);
      await monkey(page, 120, name.length * 7919);
      expect(errs).toEqual([]);
      await expect(page.locator('.error-screen')).toHaveCount(0);
    });
  }
});

test('trình duyệt chặn localStorage: game vẫn chạy, báo "không lưu được", chơi được', async ({ page }) => {
  const errs = watchErrors(page);
  await page.addInitScript(() => {
    const deny = (): never => {
      throw new DOMException('blocked', 'SecurityError');
    };
    Storage.prototype.getItem = deny;
    Storage.prototype.setItem = deny;
    Storage.prototype.removeItem = deny;
  });
  await page.goto('/?e2e');
  await expect(page.getByText('Tiến độ không lưu được trên trình duyệt này.')).toBeVisible();
  await page.getByRole('button', { name: 'CHƠI NGAY' }).click();
  await page.waitForTimeout(500);
  expect(errs).toEqual([]);
  await expect(page.locator('.error-screen')).toHaveCount(0);
});

test('bộ nhớ đầy giữa chừng (QuotaExceeded khi ghi): báo một lần, không văng', async ({ page }) => {
  const errs = watchErrors(page);
  await page.addInitScript(() => {
    const orig = Storage.prototype.setItem;
    let n = 0;
    // cho phép lần ghi thử lúc khởi động, sau đó báo đầy
    Storage.prototype.setItem = function (k: string, v: string) {
      if (++n > 1) throw new DOMException('full', 'QuotaExceededError');
      return orig.call(this, k, v);
    };
  });
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByRole('button', { name: /^Âm thanh:/ }).click(); // lưu → lỗi đầy
  await expect(page.getByText('Tiến độ không lưu được trên trình duyệt này.')).toHaveCount(1);
  expect(errs).toEqual([]);
});

for (const [label, raw] of [
  ['JSON hỏng', '{"version":1,"design":'],
  ['sai kiểu', '[1,2,3]'],
  ['phiên bản lạ', '{"version":99}'],
  ['trường sai kiểu', '{"version":1,"design":"x","debug":5,"runtime":{"bestEndless":"nhiều"},"daily":{"streak":-3,"history":7},"badges":[1]}'],
  ['từng màn sai kiểu', '{"version":1,"design":{"d01":"x","d02":{"stars":"3"},"d03":null},"debug":{"t01":null,"t02":{"probes":-1}}}'],
] as const) {
  test(`dữ liệu lưu hỏng (${label}): mở được, chơi được`, async ({ page }) => {
    const errs = watchErrors(page);
    await page.addInitScript((r) => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('chiprush.v1', r);
      }
    }, raw);
    await page.goto('/?e2e');
    await expect(page.getByRole('button', { name: 'CHƠI NGAY' })).toBeVisible();
    await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
    await expect(page.getByRole('button', { name: /^d01 / })).toBeEnabled();
    // chơi qua d01 để chắc ghi tiến độ đè lên dữ liệu hỏng vẫn ổn
    await page.getByRole('button', { name: /^d01 / }).click();
    await page.evaluate(() => (window as unknown as { __CHIPRUSH__: { design: () => { applyAi: () => void } } }).__CHIPRUSH__.design().applyAi());
    await page.getByRole('button', { name: 'KIỂM TRA' }).click();
    await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByText('Qua màn!')).toBeVisible();
    expect(errs).toEqual([]);
  });
}

test('đổi cỡ màn hình giữa lúc kéo dây và chuyển tab: không lỗi, toạ độ chạm vẫn đúng', async ({ page }) => {
  const errs = watchErrors(page);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  type W = { __CHIPRUSH__: { design: () => { wires: number; cell: (c: number, r: number) => { x: number; y: number } } } };
  const cell = (c: number, r: number) => page.evaluate(([c, r]) => (window as unknown as W).__CHIPRUSH__.design().cell(c, r), [c, r] as [number, number]);
  const a = await cell(0, 1);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.setViewportSize({ width: 360, height: 700 }); // đổi cỡ giữa lúc đang giữ ngón tay
  await page.mouse.up();
  // chuyển tab → tạm dừng; quay lại → bảng tạm dừng chờ bấm Tiếp tục
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  // sau khi đổi cỡ, kéo dây theo toạ độ MỚI vẫn nối đúng
  const pts = [];
  for (let c = 0; c <= 4; c++) pts.push(await cell(c, 1));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design().wires)).toBe(4);
  expect(errs).toEqual([]);
});
