// E2E hướng dẫn lần đầu: THIẾT KẾ d01 (đường chấm + 3 giai đoạn chữ, không trừ sao, lần sau không hiện nữa)
// và KIỂM THỬ t01 (AI chỉ dây cần đo, giải thích kết quả, dẫn tới báo đúng lỗi trong ≤ par lần đo).
import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
type W = { __CHIPRUSH__: { design: () => { tut: string | null; cell: (c: number, r: number) => Pt }; debug: () => DebugHook } };
interface DebugHook {
  probes: number;
  faultCell: [number, number];
  coach: { remaining: number; row: number | null; currentRow: number; cells: [number, number][] } | null;
  cell: (c: number, r: number) => Pt;
}

async function drag(page: Page, cells: [number, number][]): Promise<void> {
  const pts: Pt[] = [];
  for (const [c, r] of cells) pts.push(await page.evaluate(([c, r]) => (window as unknown as W).__CHIPRUSH__.design().cell(c, r), [c, r] as [number, number]));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
}
const tut = (page: Page): Promise<string | null> => page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design().tut);

test('Hướng dẫn THIẾT KẾ d01: kéo theo đường chấm → KIỂM TRA nhấp nháy → 3 sao; lần sau không hiện', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  await expect(page.getByText(/Hướng dẫn: đặt ngón tay lên công tắc A/)).toBeVisible();
  expect(await tut(page)).toBe('draw');

  await drag(page, [[0, 1], [1, 1], [2, 1]]);
  await expect(page.getByText(/Tốt lắm! Kéo tiếp/)).toBeVisible();
  expect(await tut(page)).toBe('more');

  await drag(page, [[2, 1], [3, 1], [4, 1]]);
  await expect(page.getByText(/Đã nối xong!/)).toBeVisible();
  const check = page.getByRole('button', { name: 'KIỂM TRA' });
  await expect(check).toHaveClass(/tut-pulse/);
  await check.click();
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible(); // hướng dẫn không trừ sao

  // đã qua d01 → vào lại không còn hướng dẫn
  await page.reload();
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  expect(await tut(page)).toBeNull();
  await expect(page.getByText(/Hướng dẫn:/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('Hướng dẫn KIỂM THỬ t01: đo đúng dây AI chỉ → còn 1 khả năng → báo đúng, ≤ par lần đo', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const d: Record<string, unknown> = {};
    for (const id of ['d01', 'd02', 'd03', 'd04', 'd05']) d[id] = { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false };
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: d, debug: {}, runtime: { bestEndless: 0, best60: 0 }, daily: { lastDate: null, streak: 0 }, settings: { muted: true, reducedMotion: false } }));
  });
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
  await page.getByRole('button', { name: /^t01 / }).click();
  const hook = (): Promise<DebugHook> =>
    page.evaluate(() => {
      const d = (window as unknown as W).__CHIPRUSH__.debug();
      return { probes: d.probes, faultCell: d.faultCell, coach: d.coach } as DebugHook;
    });
  const tap = async (c: number, r: number): Promise<void> => {
    const p = await page.evaluate(([c, r]) => (window as unknown as W).__CHIPRUSH__.debug().cell(c, r), [c, r] as [number, number]);
    await page.mouse.click(p.x, p.y);
  };

  for (let i = 0; i < 5; i++) {
    const d = await hook();
    expect(d.coach).not.toBeNull();
    if (d.coach!.row === null) break;
    if (d.coach!.row !== d.coach!.currentRow) {
      await expect(page.getByText(/Chạm cột/)).toBeVisible();
      await tap(0, 1); // t01 chỉ có 1 công tắc A: chạm để đổi hàng
      continue;
    }
    await expect(page.getByText(/Chạm dây viền cam để đo/)).toBeVisible();
    const [c, r] = d.coach!.cells[0]!;
    await tap(c, r);
    await expect(page.getByText(/mạch chuẩn/)).toBeVisible(); // có giải thích so với mạch chuẩn
  }
  await expect(page.getByText(/Chỉ còn 1 khả năng!/)).toBeVisible();
  const report = page.getByRole('button', { name: 'Báo lỗi' });
  await expect(report).toHaveClass(/tut-pulse/);
  const d = await hook();
  expect(d.probes).toBeLessThanOrEqual(2); // par t01 = 2
  await report.click();
  await tap(...d.faultCell);
  await page.getByRole('button', { name: 'BÁO: CỔNG NÀY HỎNG' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByLabel('3 trên 3 sao')).toBeVisible();
  expect(errors).toEqual([]);
});
