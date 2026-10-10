// Minh bạch AI: câu hiển thị theo SPEC 5.4 khớp với dữ liệu solver; phát lại cách AI đo ở KIỂM THỬ.
import { describe, expect, it } from 'vitest';
import { aiStats, debugClaim, designClaim } from '../src/core/level/ai-info';
import { DEBUG_LEVELS } from '../src/core/level/debug-levels';
import { debugSetup, isCorrectAnswer } from '../src/core/level/debug-setup';
import { DESIGN_LEVELS, levelById } from '../src/core/level/design-levels';
import solutions from '../src/core/level/solutions.json';
import { aiProbeSteps, consistentClasses } from '../src/core/tutorial';

describe('câu về AI kỹ sư (SPEC 5.4)', () => {
  it('màn đã chứng minh: nói rõ phạm vi "với cách ghép cổng này"; màn chưa: "bạn có thể vượt!"', () => {
    const proven = DESIGN_LEVELS.find((l) => (solutions as Record<string, { proven: boolean }>)[l.id]?.proven)!;
    const open = DESIGN_LEVELS.find((l) => !(solutions as Record<string, { proven: boolean }>)[l.id]?.proven)!;
    expect(designClaim(proven)).toMatchObject({ proven: true });
    expect(designClaim(proven).text).toMatch(/với cách ghép cổng này, không thể tốt hơn C = \d+/);
    expect(designClaim(open)).toMatchObject({ proven: false });
    expect(designClaim(open).text).toMatch(/bạn có thể vượt!/);
  });

  it('C trong câu = par tính lại từ lời giải (d05)', () => {
    const lv = levelById('d05')!;
    expect(designClaim(lv).C).toBe((solutions as Record<string, { par: { C: number } }>).d05!.par.C);
  });

  it('KIỂM THỬ: par 0 nói "không cần đo"; còn lại nói số lần đo tối đa', () => {
    expect(debugClaim('t02')!.text).toMatch(/không cần đo/);
    expect(debugClaim('t01')!.text).toBe('AI luôn tìm ra lỗi trong tối đa 2 lần đo, dù lỗi ở đâu.');
    expect(debugClaim('khong-co')).toBeNull();
  });

  it('số liệu trang "AI kỹ sư hoạt động thế nào?" khớp dữ liệu', () => {
    const st = aiStats();
    const sol = solutions as Record<string, { proven: boolean }>;
    expect(st.designProven).toBe(DESIGN_LEVELS.filter((l) => sol[l.id]?.proven).length);
    expect(st.designTotal).toBe(12);
    expect(st.debugOptimal).toBe(DEBUG_LEVELS.length); // mọi màn KIỂM THỬ đều ≤ 16 lớp → minimax tối ưu
    expect(st.dailyTotal).toBe(28);
    expect(st.dailyProven).toBeGreaterThan(0);
  });
});

describe('phát lại cách AI kỹ sư đo', () => {
  it.each(DEBUG_LEVELS.map((l) => [l.id, l] as const))('%s: số bước ≤ par, mỗi bước đo một ô dây thật, kết thúc còn đúng lỗi thật', (_id, lv) => {
    const setup = debugSetup(lv);
    const steps = aiProbeSteps(setup);
    expect(steps.length).toBeLessThanOrEqual(setup.par);
    for (const s of steps) {
      expect(setup.probeCells.get(`0:${s.cell}`) ?? setup.probeCells.get(`1:${s.cell}`)).toBe(s.net);
      expect([0, 1]).toContain(s.gold);
    }
    // số khả năng giảm dần, cuối cùng còn 1 lớp và đó là lớp của lỗi thật
    const rem = steps.map((s) => s.remaining);
    for (let i = 1; i < rem.length; i++) expect(rem[i]!).toBeLessThan(rem[i - 1]!);
    const left = consistentClasses(setup, steps);
    expect(left).toHaveLength(1);
    expect(isCorrectAnswer(setup, setup.group.classes[left[0]!]![0]!)).toBe(true);
  });
});
