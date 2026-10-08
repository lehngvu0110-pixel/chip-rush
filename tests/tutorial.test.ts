// Hướng dẫn lần đầu: (1) đường chấm THIẾT KẾ dẫn tới lời giải qua màn mà không cần Gợi ý (3 sao);
// (2) "huấn luyện viên" KIỂM THỬ: người chơi làm đúng theo chỉ dẫn luôn tìm ra lỗi thật với số lần đo ≤ par.
import { describe, expect, it } from 'vitest';
import { evaluateRow } from '../src/core/circuit/simulate';
import { DEBUG_LEVELS } from '../src/core/level/debug-levels';
import { debugSetup, isCorrectAnswer } from '../src/core/level/debug-setup';
import { DESIGN_LEVELS, levelById } from '../src/core/level/design-levels';
import { aiSolutionGrid, evaluateDesign, gridFor } from '../src/core/level/validate';
import { applyHint, consistentClasses, debugCoach, designGuide, guidePolyline, type ProbeRecord } from '../src/core/tutorial';

describe('designGuide', () => {
  it.each(DESIGN_LEVELS.map((l) => [l.id, l] as const))('%s: làm hết các bước hướng dẫn → qua màn, không bị trừ sao', (_id, lv) => {
    const sol = aiSolutionGrid(lv)!.state();
    const g = gridFor(lv);
    const steps = designGuide(g, sol);
    expect(steps.length).toBeGreaterThan(0);
    expect(g.wires().length + g.gates().length).toBe(0); // không sửa lưới gốc
    for (const s of steps) expect(applyHint(g, s)).toBe(true);
    expect(designGuide(g, sol)).toEqual([]);
    const e = evaluateDesign(lv, g, false);
    expect(e.status).toBe('pass');
    if (e.status === 'pass') expect(e.stars).toBe(3); // đúng lời giải AI ⇒ bằng par
  });

  it('d01: ngón tay ảo chạy từ công tắc A tới đèn Y theo đúng thứ tự ô', () => {
    const lv = levelById('d01')!;
    const g = gridFor(lv);
    const pts = guidePolyline(designGuide(g, aiSolutionGrid(lv)!.state()));
    expect(pts.map((c) => g.colRow(c))).toEqual([[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]);
  });

  it('d01: vẽ xong 2 đoạn đầu thì hướng dẫn chỉ còn phần chưa vẽ', () => {
    const lv = levelById('d01')!;
    const g = gridFor(lv);
    g.drawPath(0, [g.cellAt(0, 1), g.cellAt(1, 1), g.cellAt(2, 1)]);
    const rest = designGuide(g, aiSolutionGrid(lv)!.state());
    expect(rest).toHaveLength(2);
    expect(guidePolyline(rest).map((c) => g.colRow(c))).toEqual([[2, 1], [3, 1], [4, 1]]);
  });

  it('guidePolyline dừng ở chỗ chuỗi bị đứt', () => {
    expect(guidePolyline([{ kind: 'wire', layer: 0, a: 1, b: 2 }, { kind: 'wire', layer: 0, a: 7, b: 8 }])).toEqual([1, 2]);
    expect(guidePolyline([{ kind: 'via', cell: 3 }])).toEqual([]);
  });
});

describe('debugCoach', () => {
  it.each(DEBUG_LEVELS.map((l) => [l.id, l] as const))('%s: làm theo chỉ dẫn → báo đúng lỗi, số lần đo ≤ par', (_id, lv) => {
    const setup = debugSetup(lv);
    const probes: ProbeRecord[] = [];
    for (let step = debugCoach(setup, probes); ; step = debugCoach(setup, probes)) {
      if (!step.next) {
        expect(step.remaining).toBe(1);
        expect(isCorrectAnswer(setup, step.answer!)).toBe(true);
        break;
      }
      expect(setup.probeNets).toContain(step.next.net); // chỉ chỉ vào dây đo được
      const value = evaluateRow(setup.group.circuit, step.next.row, setup.fault)[step.next.net]!;
      probes.push({ ...step.next, value });
      expect(probes.length).toBeLessThanOrEqual(10);
    }
    expect(probes.length).toBeLessThanOrEqual(setup.par);
  });

  it('chưa đo gì → còn đủ mọi lớp nghi ngờ; số liệu đo sai lệch → loại bớt lớp', () => {
    const setup = debugSetup(DEBUG_LEVELS[0]!);
    expect(consistentClasses(setup, [])).toHaveLength(setup.group.classes.length);
    const m = debugCoach(setup, []).next!;
    const v = evaluateRow(setup.group.circuit, m.row, setup.fault)[m.net]!;
    expect(consistentClasses(setup, [{ ...m, value: v }]).length).toBeLessThan(setup.group.classes.length);
  });
});
