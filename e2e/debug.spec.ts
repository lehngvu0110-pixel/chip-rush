// E2E chế độ KIỂM THỬ: mở khoá (đã qua d05) → t01 → đo 1 dây → báo đúng cổng hỏng → qua màn;
// và báo sai 2 lần → thua, hiện lỗi thật.
import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
interface DebugHook {
  probes: number;
  wrong: number;
  faultCell: [number, number];
  gates: [number, number][];
  wires: [number, number][];
  cell: (c: number, r: number) => Pt;
}
const hook = <T>(page: Page, fn: (d: DebugHook) => T): Promise<T> =>
  page.evaluate((src) => {
    const d = (window as unknown as { __CHIPRUSH__: { debug: () => DebugHook } }).__CHIPRUSH__.debug();
    return new Function('d', `return (${src})(d)`)(d);
  }, fn.toString()) as Promise<T>;

async function tapCell(page: Page, c: number, r: number): Promise<void> {
  const p = await page.evaluate(([c, r]: [number, number]) => (window as unknown as { __CHIPRUSH__: { debug: () => DebugHook } }).__CHIPRUSH__.debug().cell(c, r), [c, r] as [number, number]);
  await page.mouse.click(p.x, p.y);
}

test.beforeEach(async ({ page }) => {
  // đã qua d05 → KIỂM THỬ mở
  await page.addInitScript(() => {
    const d: Record<string, unknown> = {};
    for (const id of ['d01', 'd02', 'd03', 'd04', 'd05']) d[id] = { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false };
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: d, debug: {}, runtime: { bestEndless: 0, best60: 0 }, daily: { lastDate: null, streak: 0 }, settings: { muted: true, reducedMotion: false } }));
  });
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
  await page.getByRole('button', { name: /^t01 / }).click();
});

test('KIỂM THỬ t01: đo 1 dây rồi báo đúng cổng hỏng → qua màn', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const [wc, wr] = (await hook(page, (d) => d.wires[0]))!;
  await tapCell(page, wc, wr);
  expect(await hook(page, (d) => d.probes)).toBe(1);
  // đo lại đúng dây đó ở cùng hàng: không tính thêm
  await tapCell(page, wc, wr);
  expect(await hook(page, (d) => d.probes)).toBe(1);

  await page.getByRole('button', { name: 'Báo lỗi' }).click();
  const [fc, fr] = await hook(page, (d) => d.faultCell);
  await tapCell(page, fc, fr);
  await page.getByRole('button', { name: 'BÁO: CỔNG NÀY HỎNG' }).click();
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByText('Tìm ra lỗi!')).toBeVisible();
  await expect(result.getByLabel('Số lần đo 1')).toBeVisible();
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
  expect(errors).toEqual([]);
});

test('KIỂM THỬ t01: báo sai 2 lần → thua và hiện lỗi thật', async ({ page }) => {
  await page.getByRole('button', { name: 'Báo lỗi' }).click();
  const fault = await hook(page, (d) => d.faultCell);
  const others = (await hook(page, (d) => d.gates)).filter(([c, r]) => c !== fault[0] || r !== fault[1]);
  for (let i = 0; i < 2; i++) {
    const [c, r] = others[i % others.length]!;
    await tapCell(page, c, r);
    await page.getByRole('button', { name: 'BÁO: CỔNG NÀY HỎNG' }).click();
  }
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByText('Chưa tìm ra lỗi')).toBeVisible();
  await expect(result.getByText(/Lỗi thật: cổng NOT cho ra ngược/)).toBeVisible();
});
