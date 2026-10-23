// E2E Góc học tập: sơ đồ tư duy (mở nhánh, xem ý, đi tới linh kiện 3D), trắc nghiệm 10 câu có lời giải,
// kỷ lục được lưu, phím Esc quay lại, không lỗi axe.
import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

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

test('Sơ đồ tư duy: mở nhánh Bán dẫn, xem LED, đi tới linh kiện 3D; Esc quay lại', async ({ page, browserName }) => {
  await page.goto('/?e2e');
  await page.getByRole('button', { name: /^Góc học tập/ }).click();
  await expect(page.getByRole('dialog', { name: 'Góc học tập' })).toBeVisible();
  if (browserName === 'chromium') expect(await axeViolations(page), 'Góc học tập').toEqual([]);
  await page.getByRole('button', { name: 'Sơ đồ tư duy' }).click();
  const mm = page.getByRole('dialog', { name: 'Sơ đồ tư duy' });
  await mm.getByRole('button', { name: /^Bán dẫn, nhánh có 5 ý/ }).click();
  await expect(mm.getByRole('navigation', { name: 'Vị trí trong sơ đồ' })).toContainText('Bán dẫn');
  await mm.getByRole('button', { name: 'LED', exact: true }).click();
  await expect(mm.getByText('R = (U nguồn − U LED) / I')).toBeVisible();
  if (browserName === 'chromium') expect(await axeViolations(page), 'sơ đồ tư duy').toEqual([]);
  // quay về gốc bằng đường dẫn
  await mm.getByRole('button', { name: 'Điện - Điện tử', exact: true }).first().click();
  await expect(mm.getByRole('button', { name: /^Định luật, nhánh/ })).toBeVisible();
  await mm.getByRole('button', { name: /^Bán dẫn, nhánh/ }).click();
  await mm.getByRole('button', { name: 'LED', exact: true }).click();
  await mm.getByRole('button', { name: 'Xem linh kiện 3D →' }).click();
  await expect(page.getByRole('dialog', { name: 'LED' })).toBeVisible();
  // Esc: chi tiết linh kiện → danh sách → Góc học tập → màn chính
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Linh kiện điện tử' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Góc học tập' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: /^Góc học tập/ })).toBeVisible();
});

test('Trắc nghiệm: 10 câu có lời giải, kết quả + kỷ lục được lưu', async ({ page, browserName }) => {
  await page.goto('/?e2e&seed=11');
  await page.getByRole('button', { name: /^Góc học tập/ }).click();
  await page.getByRole('button', { name: 'Trắc nghiệm' }).click();
  const quiz = page.getByRole('dialog', { name: 'Trắc nghiệm' });
  await quiz.getByRole('button', { name: 'Bán dẫn' }).click();
  await expect(quiz.getByRole('button', { name: 'Bán dẫn' })).toHaveAttribute('aria-pressed', 'true');
  await quiz.getByRole('button', { name: 'Bắt đầu 10 câu' }).click();
  for (let i = 0; i < 10; i++) {
    await expect(quiz.getByText(new RegExp(`^Câu ${i + 1}/10 · Bán dẫn`))).toBeVisible();
    await quiz.locator('.quiz-opt').first().click();
    // luôn có lời giải; đáp án đúng được đánh dấu ✓ (không chỉ bằng màu)
    await expect(quiz.locator('.quiz-explain p')).not.toBeEmpty();
    await expect(quiz.locator('.quiz-opt.ok .quiz-key')).toHaveText('✓');
    if (i === 0 && browserName === 'chromium') expect(await axeViolations(page), 'câu hỏi').toEqual([]);
    await quiz.getByRole('button', { name: i < 9 ? 'Câu tiếp' : 'Xem kết quả' }).click();
  }
  const score = quiz.getByLabel(/trên 10 câu đúng$/);
  await expect(score).toBeVisible();
  const correct = Number((await score.textContent())!.split('/')[0]);
  await expect(quiz.getByText('Kỷ lục mới!')).toBeVisible();
  if (browserName === 'chromium') expect(await axeViolations(page), 'kết quả').toEqual([]);
  await quiz.getByRole('button', { name: 'Về Góc học tập' }).click();
  await expect(page.getByRole('button', { name: 'Trắc nghiệm' })).toContainText(`Kỷ lục ${correct}/10`);
  await page.reload();
  await page.getByRole('button', { name: /^Góc học tập/ }).click();
  await expect(page.getByRole('button', { name: 'Trắc nghiệm' })).toContainText(`Kỷ lục ${correct}/10`);
});
