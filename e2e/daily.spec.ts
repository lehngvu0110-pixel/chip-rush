// E2E Daily Chip: qua đề hôm nay → chuỗi 1 ngày; hôm sau → chuỗi 2; bỏ lỡ 1 ngày → chuỗi về 0.
// Giả ngày bằng ?e2e&date=YYYY-MM-DD (chỉ hoạt động khi chạy test).
import { expect, test, type Page } from '@playwright/test';

type W = { __CHIPRUSH__: { design: () => { level: string; applyAi: () => void } | null } };

async function playToday(page: Page, date: string): Promise<void> {
  await page.goto(`/?e2e&date=${date}`);
  await page.getByRole('button', { name: /^Chip hôm nay/ }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design()?.level ?? null)).toMatch(/^daily-\d\d$/);
  await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design()!.applyAi());
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
}

test('Chip hôm nay: chuỗi ngày tăng khi chơi liên tiếp, mất khi bỏ 1 ngày', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem('chiprush.v1')) localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, settings: { muted: true, reducedMotion: false } }));
  });

  await playToday(page, '2026-10-26');
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByText('Chip ngày 26/10 xong!')).toBeVisible();
  await expect(result.getByLabel('3 trên 3 sao')).toBeVisible();
  await expect(result.getByLabel('Chuỗi 1 ngày liên tiếp')).toBeVisible();
  await expect(result.getByRole('button', { name: 'Chia sẻ kết quả' })).toBeVisible();
  await result.getByRole('button', { name: 'Về màn chính' }).click();
  await expect(page.getByRole('button', { name: /^Chip hôm nay, ngày 26\/10, đã xong 3 sao, chuỗi 1 ngày/ })).toBeVisible();

  // hôm sau: nút nhắc giữ chuỗi; chơi xong → 2 ngày
  await page.goto('/?e2e&date=2026-10-27');
  await expect(page.getByText('Làm đề hôm nay để giữ chuỗi 1 ngày!')).toBeVisible();
  await playToday(page, '2026-10-27');
  await expect(result.getByLabel('Chuỗi 2 ngày liên tiếp')).toBeVisible();

  // đề mỗi ngày khác nhau
  const ids = await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.design()?.level);
  expect(ids).toBe('daily-02');

  // bỏ lỡ 28/10 → 29/10 chuỗi về 0
  await page.goto('/?e2e&date=2026-10-29');
  await expect(page.getByRole('button', { name: /^Chip hôm nay, ngày 29\/10, chuỗi 0 ngày/ })).toBeVisible();
  expect(errors).toEqual([]);
});
