// E2E khả năng truy cập + nhiều cỡ màn hình:
// - axe-core (WCAG 2.1 AA) trên các màn chính: không có lỗi
// - chơi THIẾT KẾ d01 và KIỂM THỬ t01 chỉ bằng bàn phím
// - điện thoại xoay ngang → nhắc xoay dọc; laptop thấp → bảng chân trị bên trái, ô đủ lớn
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
type W = { __CHIPRUSH__: { design: () => { wires: number; cell: (c: number, r: number) => { x: number; y: number } }; debug: () => { probes: number; wires: [number, number][] } } };

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (d: Document, o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

const seedOpen = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    const d: Record<string, unknown> = {};
    for (const id of ['d01', 'd02', 'd03', 'd04', 'd05']) d[id] = { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false };
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: d, debug: { t01: { stars: 3, probes: 2 } }, settings: { muted: true, reducedMotion: false } }));
  });
};

test('axe: màn chính, Cài đặt, trang AI, danh sách màn, màn chơi, thẻ kết quả không có lỗi WCAG', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'chạy axe một lần là đủ');
  await seedOpen(page);
  await page.goto('/?e2e');
  expect(await axeViolations(page), 'màn chính').toEqual([]);
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  expect(await axeViolations(page), 'cài đặt').toEqual([]);
  await page.getByRole('button', { name: 'AI kỹ sư hoạt động thế nào?' }).click();
  expect(await axeViolations(page), 'trang AI').toEqual([]);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  expect(await axeViolations(page), 'danh sách màn').toEqual([]);
  await page.getByRole('button', { name: /^d05 / }).click();
  expect(await axeViolations(page), 'màn THIẾT KẾ').toEqual([]);
  await page.evaluate(() => (window as unknown as { __CHIPRUSH__: { design: () => { applyAi: () => void } } }).__CHIPRUSH__.design().applyAi());
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' })).toBeVisible();
  expect(await axeViolations(page), 'thẻ kết quả').toEqual([]);
});

test('Bàn phím: THIẾT KẾ d01 — Shift + mũi tên kéo dây từ A tới Y rồi qua màn', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  await page.locator('body').focus();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('ArrowRight'); // bật con trỏ ở công tắc A
  await expect(page.getByText(/^Bàn phím: mũi tên/)).toBeVisible();
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
  expect(await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design().wires)).toBe(4);
  await expect(page.locator('.sr-only')).toHaveText(/Cột 5, hàng 2: đèn Y/);
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByLabel('3 trên 3 sao')).toBeVisible();
});

test('Bàn phím: KIỂM THỬ t01 — di chuyển tới dây rồi Space để đo', async ({ page }) => {
  await seedOpen(page);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
  await page.getByRole('button', { name: /^t01 / }).click();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const [wc, wr] = (await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.debug().wires[0]))!;
  await page.keyboard.press('ArrowDown'); // bật con trỏ ở công tắc A (cột 0, hàng 1)
  // đi tới ô dây: trên lưới 1 lớp này con trỏ bắt đầu ở (0, 1)
  for (let c = 0; c < wc; c++) await page.keyboard.press('ArrowRight');
  for (let r = 1; r < wr; r++) await page.keyboard.press('ArrowDown');
  for (let r = 1; r > wr; r--) await page.keyboard.press('ArrowUp');
  await expect(page.locator('.sr-only')).toHaveText(/dây \(đo được\)/);
  await page.keyboard.press('Space');
  expect(await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.debug().probes)).toBe(1);
});

test('Điện thoại xoay ngang: hiện nhắc xoay dọc', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('/?e2e');
  await expect(page.getByText('Xoay dọc điện thoại để chơi CHIP RUSH')).toBeVisible();
  await ctx.close();
});

test('Laptop 1366×640: bảng chân trị bên trái lưới, ô ≥ 44 px, không hiện nhắc xoay', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 640 } });
  const page = await ctx.newPage();
  await page.goto('/?e2e');
  await expect(page.getByText('Xoay dọc điện thoại để chơi CHIP RUSH')).toBeHidden();
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  const [a, b] = await page.evaluate(() => {
    const d = (window as unknown as W).__CHIPRUSH__.design();
    return [d.cell(0, 0), d.cell(1, 0)];
  });
  expect(b!.x - a!.x).toBeGreaterThanOrEqual(44);
  expect(a!.x).toBeGreaterThan(1366 / 2 - 200); // lưới dịch sang phải nhường chỗ cho bảng
  await ctx.close();
});
