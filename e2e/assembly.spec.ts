// E2E LẮP RÁP: vào từ khối die ở màn chính, cắm linh kiện bằng nút DOM, LED ngược bị chấm trượt,
// xoay lại thì qua màn (2 sao), ấn giữ nút nhấn trên bo khi có điện, không lỗi axe.
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
type Snap = { level: string; powered: boolean; pass: boolean | null; powerOns: number; lit: Record<string, boolean>; placed: Record<string, { part: string; flip: boolean } | null> };
const snap = (page: Page): Promise<Snap | null> => page.evaluate(() => (window as unknown as { __CHIPRUSH__: { assembly: () => Snap | null } }).__CHIPRUSH__.assembly());

async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: AXE });
  return page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (d: Document, o: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    return r.violations.map((v) => `${v.id} (${v.nodes.length})`);
  });
}

test('a01: cắm LED ngược bị chấm trượt, xoay lại thì mạch chạy, 2 sao', async ({ page, browserName }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'LẮP RÁP: cắm linh kiện lên bo mạch' }).click();
  await page.getByRole('button', { name: /^a01 / }).click();
  await expect(page.getByRole('group', { name: 'Khay linh kiện' })).toBeVisible();

  // chưa đủ linh kiện thì không cho cấp nguồn (không tính lần thử)
  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect(page.getByText(/còn trống R1, D1/)).toBeVisible();

  await page.getByRole('button', { name: 'Điện trở 470 Ω' }).click();
  await page.getByRole('button', { name: 'Cắm vào R1' }).click();
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await page.getByRole('button', { name: 'Cắm vào D1' }).click();
  expect((await snap(page))!.placed.D1).toEqual({ part: 'LED', flip: true });
  if (browserName === 'chromium') expect(await axeViolations(page), 'bo mạch').toEqual([]);

  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect(page.getByText(/LED D1 sáng: đo được 0,0 mA/)).toBeVisible();
  expect(await snap(page)).toMatchObject({ powered: true, pass: false, powerOns: 1, lit: { D1: false } });

  await page.getByRole('button', { name: 'TẮT NGUỒN' }).click();
  await page.getByRole('button', { name: 'LED, đang cắm ở D1' }).click();
  await page.getByRole('button', { name: 'Xoay 180°' }).click();
  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect(page.getByText('Mạch chạy đúng mọi yêu cầu!')).toBeVisible();
  expect(await snap(page)).toMatchObject({ pass: true, powerOns: 2, lit: { D1: true } });

  const card = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(card.getByText('Mạch chạy rồi!')).toBeVisible();
  await expect(card.getByRole('img', { name: '2 trên 3 sao' })).toBeVisible();
  if (browserName === 'chromium') expect(await axeViolations(page), 'thẻ kết quả').toEqual([]);
  await card.getByRole('button', { name: 'Danh sách màn' }).click();
  await expect(page.getByRole('button', { name: /^a02 .*, 0 sao$/ })).toBeEnabled();

  // tiến độ còn sau khi tải lại
  await page.reload();
  await page.getByRole('button', { name: 'LẮP RÁP: cắm linh kiện lên bo mạch' }).click();
  await expect(page.getByRole('button', { name: /^a01 .*, 2 sao$/ })).toBeVisible();
});

test('a03: khi có điện, ấn giữ S1 thì LED sáng, nhả thì tắt', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, assembly: { a01: { stars: 3, powerOns: 1 }, a02: { stars: 3, powerOns: 1 } }, settings: { muted: true, reducedMotion: false } })));
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'LẮP RÁP: cắm linh kiện lên bo mạch' }).click();
  await page.getByRole('button', { name: /^a03 / }).click();
  for (const [part, fp] of [['Nút nhấn', 'S1'], ['Điện trở 330 Ω', 'R1'], ['LED', 'D1']] as const) {
    await page.getByRole('button', { name: part, exact: true }).click();
    await page.getByRole('button', { name: `Cắm vào ${fp}` }).click();
  }
  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect.poll(async () => (await snap(page))!.lit.D1).toBe(false);
  const hold = page.getByRole('button', { name: 'Ấn giữ S1' });
  const bb = (await hold.boundingBox())!;
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await expect.poll(async () => (await snap(page))!.lit.D1).toBe(true);
  await page.mouse.up();
  await expect.poll(async () => (await snap(page))!.lit.D1).toBe(false);
  // lần cấp nguồn đầu đã đúng → 3 sao
  await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByRole('img', { name: '3 trên 3 sao' })).toBeVisible();
});

test('qua màn rồi TẮT NGUỒN ngay vẫn lưu kết quả; đo linh kiện bằng bàn phím (lỗi 26/10)', async ({ page }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'LẮP RÁP: cắm linh kiện lên bo mạch' }).click();
  await page.getByRole('button', { name: /^a01 / }).click();
  await page.getByRole('button', { name: 'Điện trở 470 Ω' }).click();
  await page.getByRole('button', { name: 'Cắm vào R1' }).click();
  await page.getByRole('button', { name: 'LED', exact: true }).click();
  await page.getByRole('button', { name: 'Cắm vào D1' }).click();
  // lượt 1: LED đang ngược → đo bằng bàn phím trong ô "Đo" thấy 0 mA
  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect(page.getByText(/LED D1 sáng: đo được 0,0 mA/)).toBeVisible();
  const meter = page.getByRole('combobox', { name: 'Đo:' });
  await meter.focus();
  await meter.selectOption('D1');
  await expect(page.getByText(/^Đo D1 \(LED\): dòng 0,0 mA/)).toBeVisible();
  await page.getByRole('button', { name: 'TẮT NGUỒN' }).click();
  // lượt 2: xoay đúng, cấp nguồn, vừa đạt là tắt nguồn ngay (trước 1,5 s): kết quả vẫn được báo và lưu
  await page.getByRole('button', { name: 'LED, đang cắm ở D1' }).click();
  await page.getByRole('button', { name: 'Xoay 180°' }).click();
  await page.getByRole('button', { name: 'CẤP NGUỒN' }).click();
  await expect.poll(() => snap(page).then((s) => s?.pass), { intervals: [50] }).toBe(true);
  await page.getByRole('button', { name: 'TẮT NGUỒN' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByText('Mạch chạy rồi!')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'LẮP RÁP: cắm linh kiện lên bo mạch' }).click();
  await expect(page.getByRole('button', { name: /^a01 .*, 2 sao$/ })).toBeVisible();
});
