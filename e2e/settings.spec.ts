// E2E: Cài đặt (âm thanh, xoá tiến độ 2 bước) và Chia sẻ kết quả (trình duyệt không có Web Share → sao chép).
import { expect, test } from '@playwright/test';

test('Cài đặt: bật/tắt âm thanh được lưu; xoá tiến độ phải bấm 2 lần', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: { d01: { stars: 3, best: { A: 3, D: 0, P: 1 }, hinted: false } }, debug: {}, runtime: { bestEndless: 120, best60: 0 }, daily: { lastDate: null, streak: 0 }, settings: { muted: false, reducedMotion: false } }));
  });
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  const dlg = page.getByRole('dialog', { name: 'Cài đặt' });
  await dlg.getByRole('button', { name: 'Âm thanh: Bật' }).click();
  await expect(dlg.getByRole('button', { name: 'Âm thanh: Tắt' })).toBeVisible();
  const reset = dlg.getByRole('button', { name: 'Xoá toàn bộ tiến độ' });
  await reset.click();
  await expect(dlg.getByRole('button', { name: /Bấm lần nữa/ })).toBeVisible();
  await dlg.getByRole('button', { name: /Bấm lần nữa/ }).click();
  await expect(page.getByText('Kỷ lục: Vô tận 0 · 60 giây 0')).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('chiprush.v1') ?? '{}'));
  expect(saved.design).toEqual({});
  expect(saved.settings.muted).toBe(true); // cài đặt được giữ lại khi xoá tiến độ
});

test('Chia sẻ: không có Web Share → sao chép lời mời kèm link', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'quyền clipboard chỉ cấp được trên Chromium');
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.addInitScript(() => {
    // giả lập trình duyệt không có Web Share
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  });
  await page.goto('/?e2e&seed=42');
  await page.getByRole('button', { name: 'CHƠI NGAY' }).click();
  // trả lời sai 3 lần cho nhanh hết mạng
  for (let i = 0; i < 3; i++) {
    const s = await page.evaluate(() => (window as unknown as { __CHIPRUSH__: { runtime: () => { unlocked: string[]; validGates: string[] } } }).__CHIPRUSH__.runtime());
    const wrong = s.unlocked.find((g) => !s.validGates.includes(g));
    await page.keyboard.press(String(['AND', 'OR', 'XOR', 'NAND'].indexOf(wrong ?? 'AND') + 1));
  }
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await result.getByRole('button', { name: 'Chia sẻ kết quả' }).click();
  await expect(page.getByText(/Đã sao chép lời mời/)).toBeVisible();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('CHIP RUSH');
  expect(clip).toMatch(/https?:\/\/.+\/$/);
});
