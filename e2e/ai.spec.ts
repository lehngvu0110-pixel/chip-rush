// E2E minh bạch AI: trang "AI kỹ sư hoạt động thế nào?", câu "đã chứng minh" ở thẻ kết quả THIẾT KẾ,
// và phát lại cách AI kỹ sư đo ở KIỂM THỬ.
import { expect, test, type Page } from '@playwright/test';

type Pt = { x: number; y: number };
type W = { __CHIPRUSH__: { design: () => { cell: (c: number, r: number) => Pt }; debug: () => { faultCell: [number, number]; cell: (c: number, r: number) => Pt } } };

const seed = async (page: Page, debugDone: boolean): Promise<void> => {
  await page.addInitScript((dd) => {
    const d: Record<string, unknown> = {};
    for (const id of ['d01', 'd02', 'd03', 'd04', 'd05']) d[id] = { stars: 3, best: { A: 1, D: 0, P: 1 }, hinted: false };
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: dd ? d : {}, debug: dd ? { t01: { stars: 3, probes: 2 } } : {}, settings: { muted: true, reducedMotion: false } }));
  }, debugDone);
};

test('Trang "AI kỹ sư hoạt động thế nào?": số liệu thật, giới hạn, quay lại Cài đặt', async ({ page }) => {
  await seed(page, false);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'Cài đặt' }).click();
  await page.getByRole('button', { name: 'AI kỹ sư hoạt động thế nào?' }).click();
  const dlg = page.getByRole('dialog', { name: 'AI kỹ sư hoạt động thế nào?' });
  await expect(dlg.getByText(/Chứng minh tối ưu \d+\/12 màn/)).toBeVisible();
  await expect(dlg.getByText(/Tối ưu ở 6\/6 màn/)).toBeVisible();
  await expect(dlg.getByText(/Thử thách 60 giây tắt AI/)).toBeVisible();
  await expect(dlg.getByRole('link', { name: 'Xem nhật ký AI trên GitHub' })).toHaveAttribute('href', /docs\/ai-log/);
  await dlg.getByRole('button', { name: 'Đã hiểu' }).click();
  await expect(page.getByRole('dialog', { name: 'Cài đặt' })).toBeVisible();
});

test('THIẾT KẾ d01: thẻ kết quả nói rõ phạm vi "đã chứng minh"', async ({ page }) => {
  await seed(page, false);
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  const pts: Pt[] = [];
  for (let c = 0; c <= 4; c++) pts.push(await page.evaluate((c) => (window as unknown as W).__CHIPRUSH__.design().cell(c, 1), c));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByRole('dialog', { name: 'Kết quả' }).getByText(/AI kỹ sư đã chứng minh: với cách ghép cổng này, không thể tốt hơn C = 4/)).toBeVisible();
});

test('KIỂM THỬ t01: "Xem AI kỹ sư đo" phát lại từng bước rồi kết luận', async ({ page }) => {
  await seed(page, true); // t01 đã qua → không có hướng dẫn
  await page.goto('/?e2e');
  await page.getByRole('button', { name: 'KIỂM THỬ: tìm lỗi chip' }).click();
  await page.getByRole('button', { name: /^t01 / }).click();
  await page.getByRole('button', { name: 'Báo lỗi' }).click();
  const [fc, fr] = await page.evaluate(() => (window as unknown as W).__CHIPRUSH__.debug().faultCell);
  const p = await page.evaluate(([c, r]) => (window as unknown as W).__CHIPRUSH__.debug().cell(c, r), [fc, fr] as [number, number]);
  await page.mouse.click(p.x, p.y);
  await page.getByRole('button', { name: 'BÁO: CỔNG NÀY HỎNG' }).click();
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result.getByText(/AI luôn tìm ra lỗi trong tối đa 2 lần đo/)).toBeVisible();
  await result.getByRole('button', { name: 'Xem AI kỹ sư đo' }).click();
  await expect(page.getByText(/^AI đo lần 1\/2 khi A=/)).toBeVisible();
  await expect(page.getByText(/^AI đo lần 2\/2 khi A=/)).toBeVisible({ timeout: 6000 });
  await expect(page.getByText(/^AI kỹ sư kết luận sau 2 lần đo: lỗi ở/)).toBeVisible({ timeout: 6000 });
});
