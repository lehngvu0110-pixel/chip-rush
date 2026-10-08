// "AI kỹ sư": cận dưới hợp lệ, lời giải hợp lệ, tối ưu đã chứng minh ở màn nhỏ.
import { describe, expect, it } from 'vitest';
import { DesignSolver, solveDesign } from '../src/ai/design-solver';
import { gridToNetlist } from '../src/core/circuit/netlist';
import type { Side } from '../src/core/circuit/grid';
import { levelById } from '../src/core/level/design-levels';
import { applySolution, evaluateDesign, gridFor, passingPpa } from '../src/core/level/validate';

const logicOf = (id: string) => {
  const lv = levelById(id)!;
  if (lv.logic) return lv.logic;
  const g = gridFor(lv);
  applySolution(g, lv.solution!);
  return gridToNetlist(g).netlist;
};

describe('DesignSolver', () => {
  it.each([
    ['d01', 3],
    ['d02', 7],
    ['d04', 3],
    ['d05', 4],
    ['d06', 6],
  ] as const)('%s: duyệt hết và CHỨNG MINH Area nhỏ nhất = %i', (id, area) => {
    const lv = levelById(id)!;
    const r = solveDesign(lv.grid, logicOf(id), { timeLimitMs: 10_000 });
    expect(r).not.toBeNull();
    expect(r!.exhaustive).toBe(true);
    expect(r!.proven).toBe(true);
    expect(r!.area).toBe(area);
    // Area solver tự tính khớp với Area của bộ chấm điểm
    expect(passingPpa(lv, gridFor(lv, r!.state))?.A).toBe(area);
  });

  it('cận dưới không bao giờ vượt Area đi dây được (kiểm trên mọi cách đặt cổng AND ở d05)', () => {
    const lv = levelById('d05')!;
    const s = new DesignSolver(lv.grid, logicOf('d05'));
    let checked = 0;
    for (let c = 0; c < s.grid.size; c++) {
      if (!s.grid.canPlaceGate(c)) continue;
      for (const out of [0, 1, 2, 3] as Side[]) {
        const place = { cell: [c], out: [out] };
        const lb = s.lowerBound(place);
        const r = s.route(place, [0, 1, 2]) ?? s.route(place, [2, 1, 0]) ?? s.routeNegotiated(place);
        if (!r) continue;
        checked++;
        expect(lb).toBeLessThanOrEqual(r.area);
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('đi dây thương lượng tắc nghẽn gỡ được bố trí chật mà đi tham lam hay bế tắc (d12)', () => {
    const lv = levelById('d12')!;
    const s = new DesignSolver(lv.grid, lv.logic!);
    const g = s.grid;
    const place = { cell: [g.cellAt(2, 2), g.cellAt(2, 4), g.cellAt(4, 2), g.cellAt(4, 4), g.cellAt(5, 5)], out: [0, 0, 0, 0, 0] as Side[] };
    const r = s.routeNegotiated(place);
    expect(r).not.toBeNull();
    const e = evaluateDesign(lv, gridFor(lv, r!.state));
    expect(e.status).toBe('pass');
  });

  it('mạch logic không khớp số chân của lưới → báo lỗi rõ ràng', () => {
    const lv = levelById('d05')!;
    expect(() => new DesignSolver(lv.grid, { inputs: ['A'], outputs: ['Y'], gates: [] })).toThrow('không khớp');
  });

  it('cùng seed → cùng kết quả (tái lập được)', () => {
    const lv = levelById('d10')!;
    const a = solveDesign(lv.grid, lv.logic!, { beamWidth: 200, deepCount: 20, orders: 6, seed: 7, timeLimitMs: 10_000 });
    const b = solveDesign(lv.grid, lv.logic!, { beamWidth: 200, deepCount: 20, orders: 6, seed: 7, timeLimitMs: 10_000 });
    expect(a?.state).toEqual(b?.state);
  });
});
