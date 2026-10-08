// E2E chế độ THIẾT KẾ: vào danh sách màn → d01 → kéo ngón tay nối dây → kiểm tra → qua màn, lưu sao;
// và một lỗi điển hình (đèn chưa nối) được báo bằng chữ.
import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
const cell = (page: Page, c: number, r: number): Promise<Pt> =>
  page.evaluate(([c, r]: [number, number]) => (window as unknown as { __CHIPRUSH__: { design: () => { cell: (c: number, r: number) => Pt } } }).__CHIPRUSH__.design().cell(c, r), [c, r] as [number, number]);

async function drag(page: Page, cells: [number, number][]): Promise<void> {
  const pts: Pt[] = [];
  for (const [c, r] of cells) pts.push(await cell(page, c, r));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
}

test('THIẾT KẾ d01: kiểm tra khi chưa nối → báo lỗi; nối dây → qua màn 3 sao, mở d02', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await expect(page.getByRole('button', { name: /^d02 .*chưa mở/ })).toBeDisabled();
  await page.getByRole('button', { name: /^d01 / }).click();

  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByText('Đèn Y chưa được nối tới nguồn tín hiệu.')).toBeVisible();

  await drag(page, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByText('Qua màn!')).toBeVisible();
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
  await expect(result.getByLabel('Điểm 1000')).toBeVisible();

  // tiến độ được lưu: tải lại, d02 đã mở và d01 có 3 sao
  await page.reload();
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await expect(page.getByRole('button', { name: /^d01 .*3 sao/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^d02 / })).toBeEnabled();
  expect(errors).toEqual([]);
});

test('THIẾT KẾ: hoàn tác xoá đoạn dây vừa vẽ', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  await drag(page, [[0, 1], [1, 1], [2, 1]]);
  const wires = (): Promise<number> => page.evaluate(() => (window as unknown as { __CHIPRUSH__: { design: () => { wires: number } } }).__CHIPRUSH__.design().wires);
  expect(await wires()).toBe(2);
  await page.getByRole('button', { name: 'Hoàn tác' }).click();
  expect(await wires()).toBe(0);
});
