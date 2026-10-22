// E2E Thư viện linh kiện: mở từ màn chính, mô hình 3D có vẽ, kéo để xoay, lăn chuột / nút để phóng to,
// bàn phím, chuyển linh kiện trước/sau, quay về danh sách đúng chỗ, không lỗi axe.
import { createRequire } from 'node:module';
import { expect, test, type Locator, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (d: Document, o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

/** Số điểm ảnh sáng (khác nền tối) ở giữa canvas: > 0 nghĩa là mô hình đã được vẽ. */
const litPixels = (canvas: Locator): Promise<number> =>
  canvas.evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    const d = ctx.getImageData(Math.floor(c.width * 0.25), Math.floor(c.height * 0.25), Math.floor(c.width * 0.5), Math.floor(c.height * 0.5)).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i]! + d[i + 1]! + d[i + 2]! > 300) n++;
    return n;
  });

test('Linh kiện điện tử: xem điện trở 3D, xoay, phóng to, chuyển linh kiện', async ({ page, browserName }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Linh kiện điện tử' }).click();
  const list = page.getByRole('dialog', { name: 'Linh kiện điện tử' });
  await expect(list.getByRole('button', { name: /^Điện trở:/ })).toBeVisible();
  if (browserName === 'chromium') expect(await axeViolations(page), 'danh sách').toEqual([]);

  await list.getByRole('button', { name: /^Điện trở:/ }).click();
  const card = page.getByRole('dialog', { name: 'Điện trở' });
  await expect(card.getByText('Vàng 4 · Tím 7 · Đỏ ×100 · Nhũ vàng ±5% → 4,7 kΩ')).toBeAttached();
  const canvas = card.getByRole('application', { name: /^Mô hình 3D: Điện trở/ });
  await expect(canvas).toBeVisible();
  // tắt tự xoay để đo góc chính xác
  const auto = card.getByRole('button', { name: /^Tự xoay/ });
  if ((await auto.getAttribute('aria-pressed')) === 'true') await auto.click();
  await expect(auto).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => litPixels(canvas)).toBeGreaterThan(200);

  // kéo ngang → yaw đổi
  const box = (await canvas.boundingBox())!;
  const yaw0 = Number(await canvas.getAttribute('data-yaw'));
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => Number(await canvas.getAttribute('data-yaw'))).toBeGreaterThan(yaw0 + 0.5);

  // nút + và lăn chuột → phóng to; phím 0 → đặt lại
  await card.getByRole('button', { name: 'Phóng to' }).click();
  await expect(canvas).toHaveAttribute('data-zoom', '1.30');
  if (browserName === 'chromium') {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -400);
    await expect.poll(async () => Number(await canvas.getAttribute('data-zoom'))).toBeGreaterThan(1.5);
  }
  await canvas.focus();
  await page.keyboard.press('0');
  await expect(canvas).toHaveAttribute('data-zoom', '1.00');
  await page.keyboard.press('ArrowRight');
  await expect(canvas).toHaveAttribute('data-yaw', '-0.29'); // -0,55 + π/12
  if (browserName === 'chromium') expect(await axeViolations(page), 'thẻ chi tiết').toEqual([]);

  // chuyển sang linh kiện sau, rồi về danh sách: focus đúng linh kiện vừa xem
  await card.getByRole('button', { name: 'Linh kiện sau: Tụ gốm' }).click();
  const cap = page.getByRole('dialog', { name: 'Tụ gốm' });
  await expect(cap.getByRole('application', { name: /^Mô hình 3D: Tụ gốm/ })).toBeVisible();
  await cap.getByRole('button', { name: 'Danh sách' }).click();
  await expect(page.getByRole('button', { name: /^Tụ gốm:/ })).toBeFocused();
  await page.getByRole('button', { name: 'Về màn chính' }).click();
  await expect(page.getByRole('button', { name: 'Linh kiện điện tử' })).toBeVisible();
});

test('Mọi linh kiện đều vẽ được mô hình, không lỗi JavaScript', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Linh kiện điện tử' }).click();
  await page.getByRole('button', { name: /^Điện trở:/ }).click();
  for (let i = 0; i < 11; i++) {
    const canvas = page.getByRole('application', { name: /^Mô hình 3D/ });
    await expect.poll(() => litPixels(canvas)).toBeGreaterThan(100);
    await page.getByRole('button', { name: /^Linh kiện sau/ }).click();
  }
  // đi hết một vòng quay lại điện trở
  await expect(page.getByRole('dialog', { name: 'Điện trở' })).toBeVisible();
  expect(errors).toEqual([]);
});
