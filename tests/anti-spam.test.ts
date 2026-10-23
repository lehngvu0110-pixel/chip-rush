// Chống "spam 1 đáp án" ở Thử thách 60 giây (báo lỗi 23/10): bot bấm liên tục một cổng cố định
// (hoặc bấm ngẫu nhiên) không được kiếm điểm, còn người chơi đọc đề và trả lời đúng thì điểm cao hơn hẳn.
import { describe, expect, it } from 'vitest';
import { RuntimeGame } from '../src/modes/runtime/game';
import { RUNTIME_GATES } from '../src/modes/runtime/spawner';
import { createRng } from '../src/core/util/rng';
import type { GateType } from '../src/core/circuit/types';

/** Chơi trọn 60 s: mỗi `every` giây bấm `pick()` một lần (bot spam bấm rất nhanh). */
export function play(seed: number, every: number, pick: (g: RuntimeGame) => GateType): number {
  const g = new RuntimeGame('sixty', seed);
  const dt = 0.01;
  let since = 0;
  while (!g.ended) {
    g.update(dt);
    since += dt;
    if (since >= every && !g.ended) {
      since = 0;
      g.answer(pick(g));
    }
  }
  return g.score;
}

const SEEDS = Array.from({ length: 30 }, (_, i) => 20261000 + i);
const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
/** cổng bấm được: cổng chưa mở bị game bỏ qua, bot thông minh thì chỉ bấm cổng đã mở */
const spamGate = (gate: GateType) => (g: RuntimeGame): GateType => (g.unlocked.includes(gate) ? gate : g.unlocked[0]!);

describe('Thử thách 60 giây: chống spam', () => {
  // người chơi thật: đọc đề khoảng 0,9 s rồi trả lời đúng
  const honest = avg(SEEDS.map((s) => play(s, 0.9, (g) => g.packet.validGates[0]!)));

  it.each(RUNTIME_GATES.map((g) => [g]))('spam liên tục cổng %s (8 lần/giây) không kiếm được điểm đáng kể', (gate) => {
    const spam = avg(SEEDS.map((s) => play(s, 0.125, spamGate(gate))));
    expect(spam, `spam ${gate}: ${spam.toFixed(0)} điểm, chơi thật: ${honest.toFixed(0)} điểm`).toBeLessThan(honest * 0.15);
  });

  it('bấm ngẫu nhiên thật nhanh cũng không kiếm được điểm đáng kể', () => {
    const r = createRng(1);
    const spam = avg(SEEDS.map((s) => play(s, 0.1, (g) => g.unlocked[Math.floor(r() * g.unlocked.length)]!)));
    expect(spam).toBeLessThan(honest * 0.15);
  });

  it('người chơi thật vẫn đạt điểm cao (không bị luật mới làm khó)', () => {
    expect(honest).toBeGreaterThan(800);
  });
});
