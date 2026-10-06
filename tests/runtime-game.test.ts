import { describe, expect, it } from 'vitest';
import { RUNTIME } from '../src/config';
import { fixedFallTime, multiplier, pointsFor } from '../src/core/scoring/runtime';
import { createRng, vnDateSeed } from '../src/core/util/rng';
import { AdaptiveDifficulty, sampleBeta, type Cell } from '../src/ai/adaptive';
import { RUNTIME_GATES, Spawner, allCells, isUnique, makePacket, unlockedGates } from '../src/modes/runtime/spawner';
import { RuntimeGame, type GameEvent } from '../src/modes/runtime/game';
import type { GateType } from '../src/core/circuit/types';

describe('điểm VẬN HÀNH (SPEC 1)', () => {
  it('hệ số = 1 + floor(combo/5), tối đa 4', () => {
    expect([0, 4, 5, 9, 10, 15, 100].map(multiplier)).toEqual([1, 1, 2, 2, 3, 4, 4]);
    expect(pointsFor(0)).toBe(10);
    expect(pointsFor(12)).toBe(30);
  });

  it('đường tăng tốc cố định: 3,0 s, ×0,96 mỗi 5 câu đúng, tối thiểu 0,9 s', () => {
    expect(fixedFallTime(0)).toBe(3);
    expect(fixedFallTime(4)).toBe(3);
    expect(fixedFallTime(5)).toBeCloseTo(2.88);
    expect(fixedFallTime(10_000)).toBe(0.9);
  });

  it('seed theo ngày giờ Việt Nam: 23:30 UTC ngày 25/10 đã là 26/10 ở VN', () => {
    expect(vnDateSeed(new Date('2026-10-25T23:30:00Z'))).toBe(20261026);
    expect(vnDateSeed(new Date('2026-10-25T16:59:00Z'))).toBe(20261025);
  });
});

describe('sinh gói bit', () => {
  it('mở khóa cổng theo điểm: AND, OR → +XOR ở 100 → +NAND ở 250', () => {
    expect(unlockedGates(0)).toEqual(['AND', 'OR']);
    expect(unlockedGates(99)).toEqual(['AND', 'OR']);
    expect(unlockedGates(100)).toEqual(['AND', 'OR', 'XOR']);
    expect(unlockedGates(250)).toEqual(['AND', 'OR', 'XOR', 'NAND']);
  });

  it('mọi cổng đã mở cho đúng bit mục tiêu đều được tính là đáp án', () => {
    const p = makePacket({ gate: 'AND', a: 1, b: 1 }, ['AND', 'OR', 'XOR']);
    expect(p.target).toBe(1);
    expect(p.validGates).toEqual(['AND', 'OR']);
    expect(isUnique({ gate: 'XOR', a: 1, b: 1 }, ['AND', 'OR', 'XOR'])).toBe(true); // chỉ XOR ra 0
  });

  for (const score of [0, 100, 250]) {
    const gates = unlockedGates(score);
    it(`≥ ${RUNTIME.uniqueRatio * 100}% gói chỉ có 1 đáp án, chỉ dùng cổng đã mở (${gates.join(', ')})`, () => {
      for (const adaptive of [null, new AdaptiveDifficulty()]) {
        const sp = new Spawner(createRng(score + 1), adaptive);
        let unique = 0;
        const N = 3000;
        for (let i = 0; i < N; i++) {
          const p = sp.next(gates);
          expect(gates).toContain(p.cell.gate);
          expect(p.validGates.length).toBeGreaterThan(0);
          if (p.validGates.length === 1) unique++;
        }
        expect(unique / N).toBeGreaterThanOrEqual(RUNTIME.uniqueRatio);
      }
    });
  }

  it('cùng seed → cùng chuỗi gói (Thử thách 60 giây công bằng)', () => {
    const seq = (seed: number) => {
      const sp = new Spawner(createRng(seed), null);
      return Array.from({ length: 50 }, () => {
        const p = sp.next(RUNTIME_GATES);
        return `${p.cell.gate}${p.a}${p.b}`;
      }).join(',');
    };
    expect(seq(20261026)).toBe(seq(20261026));
    expect(seq(20261026)).not.toBe(seq(20261027));
  });
});

/** Trả lời đúng gói hiện tại. */
const answerRight = (g: RuntimeGame) => g.answer(g.packet.validGates[0] as GateType);
/** Trả lời sai: chọn cổng đã mở mà KHÔNG cho đúng bit (luôn tồn tại vì AND và OR khác nhau ở 01). */
function answerWrong(g: RuntimeGame): boolean {
  const wrong = g.unlocked.find((x) => !g.packet.validGates.includes(x));
  if (wrong) return g.answer(wrong);
  g.update(g.fall + 0.01); // gói mà mọi cổng đều đúng: để rơi chạm khe = trượt
  return true;
}

describe('RuntimeGame – Vô tận', () => {
  it('cộng điểm theo combo: 6 câu đúng = 5×10 + 20 = 70', () => {
    const g = new RuntimeGame('endless', 1);
    for (let i = 0; i < 6; i++) answerRight(g);
    expect(g.score).toBe(70);
    expect(g.combo).toBe(6);
    expect(g.bestCombo).toBe(6);
  });

  it('sai: mất 1 mạng, combo về 0; hết 3 mạng thì kết thúc và phát sự kiện end đúng 1 lần', () => {
    const g = new RuntimeGame('endless', 2);
    answerRight(g);
    answerWrong(g);
    expect(g.lives).toBe(2);
    expect(g.combo).toBe(0);
    answerWrong(g);
    answerWrong(g);
    expect(g.ended).toBe(true);
    const events = g.drainEvents();
    expect(events.filter((e) => e.type === 'end')).toHaveLength(1);
    expect(answerRight(g)).toBe(false); // đã kết thúc: không nhận câu trả lời
    expect(g.result()).toMatchObject({ mode: 'endless', answered: 4, correct: 1, accuracy: 0.25 });
  });

  it('gói chạm khe mà chưa trả lời = trượt (miss), mất mạng', () => {
    const g = new RuntimeGame('endless', 3);
    g.update(RUNTIME.startFall * 0.5);
    expect(g.lives).toBe(3);
    g.update(RUNTIME.startFall * 0.6);
    expect(g.lives).toBe(2);
    expect(g.drainEvents().map((e) => e.type)).toContain('miss');
    expect(g.progress).toBe(0); // gói mới bắt đầu rơi từ trên
  });

  it('không nhận cổng chưa mở khóa', () => {
    const g = new RuntimeGame('endless', 4);
    expect(g.answer('XOR')).toBe(false);
    expect(g.answered).toBe(0);
  });

  it('tạm dừng: không rơi, không nhận câu trả lời', () => {
    const g = new RuntimeGame('endless', 5);
    g.pause();
    g.update(100);
    expect(g.lives).toBe(3);
    expect(answerRight(g)).toBe(false);
    g.resume();
    expect(answerRight(g)).toBe(true);
  });

  it('mở khóa XOR khi đạt 100 điểm, có sự kiện unlock', () => {
    const g = new RuntimeGame('endless', 6);
    const events: GameEvent[] = [];
    while (g.score < 100) {
      answerRight(g);
      events.push(...g.drainEvents());
    }
    expect(g.unlocked).toContain('XOR');
    expect(events).toContainEqual({ type: 'unlock', gate: 'XOR' });
  });

  it('thời gian rơi luôn trong [0,9; 3,0] s và nhanh dần khi trả lời đúng liên tục', () => {
    const g = new RuntimeGame('endless', 7);
    for (let i = 0; i < 200; i++) {
      answerRight(g);
      expect(g.fall).toBeGreaterThanOrEqual(RUNTIME.minFall);
      expect(g.fall).toBeLessThanOrEqual(RUNTIME.maxFall);
    }
    expect(g.fall).toBe(RUNTIME.minFall);
  });
});

describe('RuntimeGame – Thử thách 60 giây', () => {
  it('hết 60 s thì kết thúc; sai không mất mạng mà trừ 5 điểm, không xuống dưới 0', () => {
    const g = new RuntimeGame('sixty', 8);
    answerWrong(g);
    expect(g.score).toBe(0);
    expect(g.lives).toBe(RUNTIME.lives);
    for (let i = 0; i < 3; i++) answerRight(g);
    answerWrong(g);
    expect(g.score).toBe(25);
    for (let t = 0; t < 61 && !g.ended; t += 0.1) {
      g.update(0.1);
      if (g.progress > 0.5) answerRight(g);
    }
    expect(g.ended).toBe(true);
    expect(g.timeLeft).toBe(0);
  });

  it('dùng đường tăng tốc cố định theo số câu đúng', () => {
    const g = new RuntimeGame('sixty', 9);
    for (let i = 0; i < 10; i++) answerRight(g);
    expect(g.fall).toBeCloseTo(fixedFallTime(10));
  });

  it('cổng đã mở không bị khóa lại khi bị trừ điểm', () => {
    const g = new RuntimeGame('sixty', 10);
    while (!g.unlocked.includes('XOR')) answerRight(g);
    for (let i = 0; i < 30; i++) answerWrong(g);
    expect(g.unlocked).toContain('XOR');
  });
});

describe('độ khó thích nghi (SPEC 5.3)', () => {
  it('mẫu Beta có trung bình ≈ α/(α+β)', () => {
    const rng = createRng(11);
    const n = 4000;
    let s = 0;
    for (let i = 0; i < n; i++) s += sampleBeta(3, 7, rng);
    expect(s / n).toBeCloseTo(0.3, 1);
  });

  it('ô hay sai được hỏi nhiều hơn hẳn nhưng ô khác vẫn được hỏi (khám phá)', () => {
    const ad = new AdaptiveDifficulty();
    const weak: Cell = { gate: 'XOR', a: 1, b: 1 };
    for (let i = 0; i < 10; i++) ad.record(weak, false);
    const cells = allCells(RUNTIME_GATES);
    for (const c of cells) if (c !== weak) for (let i = 0; i < 10; i++) ad.record(c, true);
    const rng = createRng(12);
    let hits = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const c = ad.pickCell([...cells.filter((x) => !(x.gate === 'XOR' && x.a === 1 && x.b === 1)), weak], rng);
      if (c.gate === 'XOR' && c.a === 1 && c.b === 1) hits++;
    }
    expect(hits / N).toBeGreaterThan(0.6);
    expect(hits / N).toBeLessThan(0.95);
    expect(ad.weakestGate()?.gate).toBe('XOR');
  });

  it('điều tốc: đúng nhiều → nhanh hơn, sai nhiều → chậm lại, luôn trong biên', () => {
    const c: Cell = { gate: 'AND', a: 0, b: 1 };
    const fast = new AdaptiveDifficulty();
    for (let i = 0; i < 20; i++) fast.record(c, true);
    expect(fast.adjustFall(2)).toBeCloseTo(1.9);
    const slow = new AdaptiveDifficulty();
    for (let i = 0; i < 20; i++) slow.record(c, false);
    expect(slow.adjustFall(2)).toBeCloseTo(2.1);
    const clamp = new AdaptiveDifficulty();
    for (let i = 0; i < 20; i++) clamp.record(c, false);
    expect(clamp.adjustFall(3)).toBe(RUNTIME.maxFall);
  });

  it('người chơi giả lập (càng nhanh càng dễ sai) được giữ quanh vùng 75–85% đúng', () => {
    // Mô hình: xác suất đúng = kỹ năng theo cổng × fall/(fall + 0,3).
    // Nếu xác suất đúng KHÔNG phụ thuộc tốc độ thì điều tốc không thể kéo tỉ lệ đúng về vùng mục tiêu,
    // nên kiểm chứng phải dùng mô hình phụ thuộc tốc độ như thế này.
    const skill: Record<string, number> = { AND: 0.99, OR: 0.99, XOR: 0.97, NAND: 0.96 };
    const rng = createRng(13);
    const accs: number[] = [];
    for (let run = 0; run < 20; run++) {
      const g = new RuntimeGame('endless', 100 + run);
      g.lives = 1e9; // chơi đủ lâu để đo
      const outcomes: boolean[] = [];
      for (let i = 0; i < 400; i++) {
        const p = (skill[g.packet.cell.gate] ?? 0.95) * (g.fall / (g.fall + 0.3));
        const ok = rng() < p;
        if (ok) answerRight(g);
        else answerWrong(g);
        outcomes.push(ok);
      }
      const tail = outcomes.slice(-200);
      accs.push(tail.filter(Boolean).length / tail.length);
    }
    const mean = accs.reduce((a, b) => a + b, 0) / accs.length;
    expect(mean).toBeGreaterThan(0.74);
    expect(mean).toBeLessThan(0.86);
  });
});
