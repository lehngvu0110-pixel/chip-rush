// E2E cho các lỗi tìm được khi rà soát code 21/10:
// - phím tắt không tác động lên bàn chơi khi thẻ kết quả đang che (trước: Ctrl+Z vẫn xoá dây phía sau thẻ)
// - mở game ở 2 tab: tab kia lưu thì tab này nạp lại (trước: tab lưu sau ghi đè mất tiến độ)
// - VẬN HÀNH có vùng aria-live đọc đề gói cho trình đọc màn hình
import { expect, test } from '@playwright/test';

type Hook = {
  __CHIPRUSH__: {
    design: () => { wires: number; cell: (c: number, r: number) => { x: number; y: number } } | null;
    runtime: () => { validGates: string[]; ended: boolean } | null;
  };
};

test('thẻ kết quả đang mở → Ctrl+Z không xoá dây trên bàn phía sau', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  // vẽ tay (applyAi không ghi vào lịch sử Hoàn tác nên Ctrl+Z sẽ không có gì để xoá)
  const pts: { x: number; y: number }[] = [];
  for (let c = 0; c <= 4; c++) pts.push(await page.evaluate((c) => (window as unknown as Hook).__CHIPRUSH__.design()!.cell(c, 1), c));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  const wires = await page.evaluate(() => (window as unknown as Hook).__CHIPRUSH__.design()?.wires ?? -1);
  expect(wires).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' })).toBeVisible();
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Shift+ArrowRight');
  expect(await page.evaluate(() => (window as unknown as Hook).__CHIPRUSH__.design()?.wires)).toBe(wires);
});

test('2 tab: tab kia lưu tiến độ → màn chính tab này cập nhật số huy hiệu', async ({ page, context }) => {
  await page.goto('/?e2e');
  await expect(page.getByRole('button', { name: 'Huy hiệu: đã đạt 0 trên 12' })).toBeVisible();
  const other = await context.newPage();
  await other.goto('/?e2e');
  await other.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('chiprush.v1') ?? '{}') as Record<string, unknown>;
    s.design = { d01: { stars: 3, best: { A: 99, D: 9, P: 99 }, hinted: false } };
    s.badges = { 'first-chip': '2026-10-21' };
    localStorage.setItem('chiprush.v1', JSON.stringify(s));
  });
  await expect(page.getByRole('button', { name: 'Huy hiệu: đã đạt 1 trên 12' })).toBeVisible();
  await other.close();
});

test('VẬN HÀNH: vùng aria-live đọc đề gói, lượt đúng thì báo "Đúng."', async ({ page }) => {
  await page.goto('/?e2e&seed=7');
  await page.getByRole('button', { name: 'CHƠI NGAY' }).click();
  const live = page.locator('.sr-only[aria-live]');
  await expect(live).toHaveText(/^Phím 1 AND, 2 OR, 3 XOR, 4 NAND\. A [01], B [01], cần ra [01]$/);
  const s = await page.evaluate(() => (window as unknown as Hook).__CHIPRUSH__.runtime());
  const key = String(['AND', 'OR', 'XOR', 'NAND'].indexOf(s!.validGates[0]!) + 1);
  await page.keyboard.press(key);
  await expect(live).toHaveText(/^Đúng\. (Mở khóa \w+\. )?(AI ra thêm câu \w+\. )?A [01], B [01], cần ra [01]$/);
});
