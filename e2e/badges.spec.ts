// E2E Huy hiệu: qua d01 → báo "Huy hiệu mới", màn chính hiện 1/12, bảng Huy hiệu đúng + không lỗi axe;
// người chơi cũ được trao bù im lặng khi mở game.
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';

type Pt = { x: number; y: number };
const AXE = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

test('Qua d01 → huy hiệu "Con chip đầu tiên", xem trong bảng Huy hiệu', async ({ page, browserName }) => {
  await page.goto('/?e2e');
  await expect(page.getByRole('button', { name: 'Huy hiệu: đã đạt 0 trên 12' })).toBeVisible();
  await page.getByRole('button', { name: 'THIẾT KẾ: tự vẽ mạch' }).click();
  await page.getByRole('button', { name: /^d01 / }).click();
  const pts: Pt[] = [];
  for (let c = 0; c <= 4; c++) pts.push(await page.evaluate((c) => (window as unknown as { __CHIPRUSH__: { design: () => { cell: (c: number, r: number) => Pt } } }).__CHIPRUSH__.design().cell(c, 1), c));
  await page.mouse.move(pts[0]!.x, pts[0]!.y);
  await page.mouse.down();
  for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 4 });
  await page.mouse.up();
  await page.getByRole('button', { name: 'KIỂM TRA' }).click();
  await expect(page.getByText('Huy hiệu mới: Con chip đầu tiên!')).toBeVisible();

  await page.getByRole('button', { name: 'Danh sách màn' }).click();
  await page.getByRole('button', { name: 'Về màn chính' }).click();
  await page.getByRole('button', { name: 'Huy hiệu: đã đạt 1 trên 12' }).click();
  const dlg = page.getByRole('dialog', { name: 'Huy hiệu' });
  await expect(dlg.getByLabel(/^Con chip đầu tiên: đã đạt/)).toBeVisible();
  await expect(dlg.getByLabel(/^Hơn cả AI: chưa đạt/)).toBeVisible();
  if (browserName === 'chromium') {
    await page.addScriptTag({ path: AXE });
    const v = await page.evaluate(async () => (await (window as unknown as { axe: { run: (d: Document, o: unknown) => Promise<{ violations: { id: string }[] }> } }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] } })).violations.map((x) => x.id));
    expect(v).toEqual([]);
  }
});

test('Người chơi cũ: mở game là có huy hiệu đã đạt, không dồn thông báo', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('chiprush.v1', JSON.stringify({ version: 1, design: { d01: { stars: 3, best: { A: 4, D: 0, P: 1 }, hinted: false } }, runtime: { bestEndless: 600, best60: 0 }, settings: { muted: true, reducedMotion: false } }));
  });
  await page.goto('/?e2e');
  await expect(page.getByRole('button', { name: 'Huy hiệu: đã đạt 2 trên 12' })).toBeVisible();
  await expect(page.getByText(/Huy hiệu mới/)).toHaveCount(0);
});
