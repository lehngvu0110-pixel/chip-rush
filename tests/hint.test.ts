// Gợi ý THIẾT KẾ: làm theo gợi ý liên tục từ lưới trống luôn ra lời giải AI và qua màn (tối đa 2 sao).
import { describe, expect, it } from 'vitest';
import { nextHint } from '../src/core/level/hint';
import { DESIGN_LEVELS, levelById } from '../src/core/level/design-levels';
import { aiSolutionGrid, evaluateDesign, gridFor } from '../src/core/level/validate';
import type { Grid } from '../src/core/circuit/grid';
import type { Hint } from '../src/core/level/hint';

function apply(g: Grid, h: Hint): void {
  if (h.kind === 'gate') {
    g.removeGate(h.cell);
    g.placeGate(h.cell, h.type, h.out);
  } else if (h.kind === 'via') g.toggleVia(h.cell);
  else g.addWire(h.layer, h.a, h.b);
}

describe('nextHint', () => {
  it.each(DESIGN_LEVELS.map((l) => [l.id, l] as const))('%s: làm theo gợi ý từ lưới trống → qua màn, sao bị giới hạn 2', (_id, lv) => {
    const sol = aiSolutionGrid(lv)!.state();
    const g = gridFor(lv);
    let steps = 0;
    for (let h = nextHint(g, sol); h; h = nextHint(g, sol)) {
      apply(g, h);
      if (++steps > 200) throw new Error('gợi ý lặp vô hạn');
    }
    const e = evaluateDesign(lv, g, true);
    expect(e.status).toBe('pass');
    if (e.status === 'pass') expect(e.stars).toBeLessThanOrEqual(2);
  });

  it('cổng sai loại → gợi ý thay cổng trước tiên', () => {
    const lv = levelById('d05')!;
    const sol = aiSolutionGrid(lv)!.state();
    const g = gridFor(lv);
    const gc = sol.gates[0]!.cell;
    g.placeGate(gc, 'OR');
    expect(nextHint(g, sol)).toMatchObject({ kind: 'gate', cell: gc, type: 'AND', replace: true });
  });

  it('gợi ý đầu tiên về dây bắt đầu từ công tắc (đi từ nguồn)', () => {
    const lv = levelById('d02')!;
    const sol = aiSolutionGrid(lv)!.state();
    const g = gridFor(lv);
    const h = nextHint(g, sol);
    expect(h?.kind).toBe('wire');
    if (h?.kind === 'wire') expect([h.a, h.b]).toContain(g.inputCells[0]);
  });

  it('lưới đã đủ lời giải → không còn gợi ý', () => {
    const lv = levelById('d11')!;
    const sol = aiSolutionGrid(lv)!;
    expect(nextHint(sol, sol.state())).toBeNull();
  });
});
