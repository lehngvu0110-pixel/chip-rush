// Kịch bản E2E 1: CHƠI NGAY → chơi VẬN HÀNH → kết quả → chơi lại → kỷ lục được lưu.
import { expect, test, type Page } from '@playwright/test';

interface RuntimeState {
  mode: string;
  score: number;
  lives: number;
  combo: number;
  ended: boolean;
  paused: boolean;
  unlocked: string[];
  validGates: string[];
  timeLeft: number;
}
const GATES = ['AND', 'OR', 'XOR', 'NAND'];

const state = (page: Page) =>
  page.evaluate(() => (window as unknown as { __CHIPRUSH__: { runtime: () => RuntimeState } }).__CHIPRUSH__.runtime());

/** Trả lời đúng bằng phím tắt 1–4. */
async function answerRight(page: Page): Promise<void> {
  const s = await state(page);
  await page.keyboard.press(String(GATES.indexOf(s.validGates[0] as string) + 1));
}

/** Trả lời sai; nếu gói hiện tại mọi cổng đều đúng thì chờ gói rơi chạm khe (trượt). */
async function answerWrong(page: Page): Promise<void> {
  const s = await state(page);
  const wrong = s.unlocked.find((g) => !s.validGates.includes(g));
  if (wrong) await page.keyboard.press(String(GATES.indexOf(wrong) + 1));
  else await page.waitForFunction((lives) => (window as never as { __CHIPRUSH__: { runtime: () => RuntimeState } }).__CHIPRUSH__.runtime().lives < lives, s.lives);
}

test('CHƠI NGAY → chơi → hết mạng → kết quả → chơi lại → kỷ lục còn sau khi tải lại', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?e2e&seed=42');

  await page.getByRole('button', { name: 'CHƠI NGAY' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('endless');

  // Câu đầu bấm bằng chạm thật lên canvas để kiểm tra đường cảm ứng
  const s0 = await state(page);
  const btn = await page.evaluate(
    (gate) =>
      (window as unknown as { __CHIPRUSH__: { buttons: () => { gate: string; rect: { x: number; y: number; w: number; h: number } }[] } }).__CHIPRUSH__
        .buttons()
        .find((b) => b.gate === gate)!.rect,
    s0.validGates[0],
  );
  await page.touchscreen.tap(btn.x + btn.w / 2, btn.y + btn.h / 2);
  await expect.poll(async () => (await state(page)).score).toBe(10);

  // 11 câu đúng nữa bằng phím: 5×10 + 5×20 + 2×30 = 210
  for (let i = 0; i < 11; i++) await answerRight(page);
  await expect.poll(async () => (await state(page)).score).toBe(210);
  expect((await state(page)).combo).toBe(12);

  // 3 câu sai → hết mạng
  for (let i = 0; i < 3; i++) await answerWrong(page);
  const result = page.getByRole('dialog', { name: 'Kết quả' });
  await expect(result).toBeVisible();
  await expect(result.getByText('Hết mạng!')).toBeVisible();
  await expect(result.getByLabel('Điểm 210')).toBeVisible();
  await expect(result.getByText('Kỷ lục mới!')).toBeVisible();

  // Chơi lại: ván mới sạch
  await result.getByRole('button', { name: 'Chơi lại' }).click();
  await expect.poll(async () => (await state(page)).score).toBe(0);
  expect((await state(page)).lives).toBe(3);

  // Tải lại trang: kỷ lục vẫn còn
  await page.reload();
  await expect(page.getByText('Kỷ lục: Vô tận 210')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Thử thách 60 giây: đồng hồ chạy, nút Dừng tạm dừng và Tiếp tục chơi tiếp', async ({ page }) => {
  await page.goto('/?e2e&seed=7');
  await page.getByRole('button', { name: 'Thử thách 60 giây' }).click();
  await expect.poll(async () => (await state(page)).mode).toBe('sixty');
  await expect.poll(async () => (await state(page)).timeLeft).toBeLessThan(59.5);

  await page.getByRole('button', { name: 'Tạm dừng' }).click();
  await expect(page.getByText('Đã tạm dừng')).toBeVisible();
  const t1 = (await state(page)).timeLeft;
  await page.waitForTimeout(600);
  expect((await state(page)).timeLeft).toBe(t1); // đồng hồ đứng yên khi dừng

  await page.getByRole('button', { name: 'Tiếp tục' }).click();
  await expect.poll(async () => (await state(page)).timeLeft).toBeLessThan(t1);
});

test('Thử thách 60 giây chống spam: bấm sai bị khoá 0,8 s, spam 1 phím không lên điểm', async ({ page }) => {
  type S = RuntimeState & { lockLeft: number };
  const st = (): Promise<S> => state(page) as Promise<S>;
  await page.goto('/?e2e&seed=20261023');
  await page.getByRole('button', { name: 'Thử thách 60 giây' }).click();
  await expect.poll(async () => (await st()).mode).toBe('sixty');
  // bấm sai → chập mạch: trả lời đúng ngay sau đó không được nhận
  let s = await st();
  const wrong = s.unlocked.find((g) => !s.validGates.includes(g))!;
  await page.keyboard.press(String(GATES.indexOf(wrong) + 1));
  await expect.poll(async () => (await st()).lockLeft).toBeGreaterThan(0.3);
  s = await st();
  await page.keyboard.press(String(GATES.indexOf(s.validGates[0]!) + 1));
  expect((await st()).score).toBe(0);
  await page.screenshot({ path: test.info().outputPath('chap-mach.png') });
  // hết khoá thì trả lời bình thường
  await expect.poll(async () => (await st()).lockLeft, { timeout: 3000 }).toBe(0);
  await answerRight(page);
  await expect.poll(async () => (await st()).score).toBe(10);
  // spam phím 1 (AND) liên tục 6 giây: điểm không tăng đáng kể
  const before = (await st()).score;
  for (let i = 0; i < 60; i++) {
    await page.keyboard.press('1');
    await page.waitForTimeout(100);
  }
  expect((await st()).score - before).toBeLessThan(60);
});
