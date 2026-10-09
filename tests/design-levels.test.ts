// Dữ liệu màn THIẾT KẾ + chấm điểm: mọi màn hợp lệ, lời giải tham chiếu qua màn với 3 sao.
import { describe, expect, it } from 'vitest';
import { DESIGN_LEVELS, levelById } from '../src/core/level/design-levels';
import { aiSolutionGrid, applySolution, evaluateDesign, expectedRows, gridFor, levelPar, referencePpa, solvedLevel, validateLevel } from '../src/core/level/validate';
import { costOf, shareScore, starsFor } from '../src/core/scoring/design';

describe('dữ liệu màn THIẾT KẾ', () => {
  it('id không trùng và đúng thứ tự', () => {
    const ids = DESIGN_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual(ids);
  });

  it.each(DESIGN_LEVELS.map((l) => [l.id, l] as const))('%s: dữ liệu hợp lệ', (_id, level) => {
    expect(validateLevel(level)).toEqual([]);
  });

  it.each(DESIGN_LEVELS.map((l) => [l.id, l] as const))('%s: lời giải AI kỹ sư qua màn với 3 sao, điểm 1000', (_id, level) => {
    const g = aiSolutionGrid(level);
    expect(g).not.toBeNull();
    const e = evaluateDesign(level, g!);
    expect(e.status).toBe('pass');
    if (e.status !== 'pass') return;
    expect(e.stars).toBe(3);
    expect(e.score).toBe(1000);
  });

  it.each(DESIGN_LEVELS.filter((l) => l.solution).map((l) => [l.id, l] as const))('%s: lời giải mẫu qua màn và không tốt hơn par', (_id, level) => {
    const g = gridFor(level);
    applySolution(g, level.solution!);
    expect(evaluateDesign(level, g).status).toBe('pass');
    expect(referencePpa(level)!.C).toBeGreaterThanOrEqual(levelPar(level).C);
  });

  it.each(DESIGN_LEVELS.map((l) => [l.id, l] as const))('%s: par ghi trong solutions.json khớp khi tính lại', (_id, level) => {
    const s = solvedLevel(level.id);
    expect(s).toBeDefined();
    expect(s!.par).toEqual(levelPar(level));
  });

  it('expectedRows theo thứ tự nhị phân, A là bit cao', () => {
    const rows = expectedRows(levelById('d05')!);
    expect(rows.map((r) => [...r.inputs, ...r.outputs])).toEqual([[0, 0, 0], [0, 1, 0], [1, 0, 0], [1, 1, 1]]);
  });

  it('par của vài màn đơn giản khớp tính tay', () => {
    // d01: 3 ô dây, không cổng, net A đổi 1 lần → C = 3 + 0 + 1
    expect(levelPar(levelById('d01')!)).toEqual({ A: 3, D: 0, P: 1, C: 4 });
    // d04: 2 ô dây + 1 cổng; P = A đổi 1 + đầu ra đổi 1
    expect(levelPar(levelById('d04')!)).toEqual({ A: 3, D: 1, P: 2, C: 8 });
  });
});

describe('chấm bài THIẾT KẾ', () => {
  const d05 = levelById('d05')!;

  it('lưới trống → chưa hợp lệ (đèn chưa nối)', () => {
    const e = evaluateDesign(d05, gridFor(d05));
    expect(e.status).toBe('invalid');
    if (e.status === 'invalid') expect(e.problems[0]!.kind).toBe('led-unconnected');
  });

  it('nối thẳng A tới đèn: mạch hợp lệ nhưng sai 1 hàng bảng chân trị', () => {
    const g = gridFor(d05);
    g.drawPath(0, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [4, 2]].map(([c, r]) => g.cellAt(c!, r!)));
    const e = evaluateDesign(d05, g);
    expect(e.status).toBe('wrong');
    if (e.status === 'wrong') {
      // Y = A so với A AND B: sai đúng 1 hàng (A=1, B=0)
      expect(e.comparison.correctRows).toBe(3);
      expect(e.comparison.wrongRows).toEqual([2]);
    }
  });

  it('dùng cổng không được phép → báo lỗi số cổng', () => {
    const g = gridFor(d05);
    g.placeGate(g.cellAt(2, 2), 'OR');
    const e = evaluateDesign(d05, g);
    expect(e.status).toBe('invalid');
    if (e.status === 'invalid') expect(e.problems[0]!.message).toBe('Màn này chỉ cho dùng 0 cổng OR.');
  });

  it('lời giải dài hơn par: qua màn nhưng mất sao Area, điểm < 1000', () => {
    const g = gridFor(d05);
    g.placeGate(g.cellAt(2, 2), 'AND');
    const P = (pts: number[][]): number => g.drawPath(0, pts.map(([c, r]) => g.cellAt(c!, r!)));
    P([[0, 1], [1, 1], [2, 1], [2, 2]]);
    P([[0, 3], [1, 3], [2, 3], [2, 2]]);
    P([[2, 2], [3, 2], [4, 2]]);
    const e = evaluateDesign(d05, g);
    expect(e.status).toBe('pass');
    if (e.status !== 'pass') return;
    expect(e.ppa.A).toBeGreaterThan(e.par.A);
    expect(e.stars).toBe(2);
    expect(e.score).toBeLessThan(1000);
  });
});

describe('công thức điểm', () => {
  it('C = A + 3D + P', () => expect(costOf(5, 1, 6)).toBe(14));
  it('sao: mỗi chỉ số ≤ par được 1 sao; dùng gợi ý tối đa 2', () => {
    const par = { A: 5, D: 1, P: 6, C: 14 };
    expect(starsFor({ A: 5, D: 1, P: 6, C: 14 }, par)).toBe(3);
    expect(starsFor({ A: 6, D: 1, P: 7, C: 16 }, par)).toBe(1);
    expect(starsFor({ A: 4, D: 1, P: 6, C: 13 }, par, true)).toBe(2);
  });
  it('điểm chia sẻ = 1000 × C_par / C', () => {
    const par = { A: 5, D: 1, P: 6, C: 14 };
    expect(shareScore({ A: 5, D: 1, P: 6, C: 14 }, par)).toBe(1000);
    expect(shareScore({ A: 9, D: 1, P: 6, C: 18 }, par)).toBe(778);
    expect(shareScore({ A: 3, D: 1, P: 4, C: 10 }, par)).toBe(1400);
  });
});

import { defaultSave, designUnlocked, recordDesign } from '../src/core/progress';
import { MSG_H, TOOLBAR_H, cellAtPoint, layoutDesign, stepCells, tableColAtPoint } from '../src/modes/design/layout';

describe('tiến độ THIẾT KẾ', () => {
  it('giữ số sao cao nhất và PPA có chi phí thấp nhất', () => {
    const s = defaultSave();
    expect(recordDesign(s, 'd05', { A: 7, D: 1, P: 5, C: 15 }, 2)).toBe(true);
    expect(recordDesign(s, 'd05', { A: 9, D: 1, P: 5, C: 17 }, 1)).toBe(false); // tệ hơn: không ghi đè
    expect(s.design.d05).toEqual({ stars: 2, best: { A: 7, D: 1, P: 5 }, hinted: false });
    expect(recordDesign(s, 'd05', { A: 5, D: 1, P: 5, C: 13 }, 3)).toBe(true);
    expect(s.design.d05).toEqual({ stars: 3, best: { A: 5, D: 1, P: 5 }, hinted: false });
  });
  it('màn đầu luôn mở; màn sau mở khi màn trước đã qua', () => {
    const s = defaultSave();
    const ids = ['d01', 'd02', 'd03'];
    expect([0, 1, 2].map((i) => designUnlocked(s, ids, i))).toEqual([true, false, false]);
    recordDesign(s, 'd01', { A: 3, D: 0, P: 1, C: 4 }, 3);
    expect([0, 1, 2].map((i) => designUnlocked(s, ids, i))).toEqual([true, true, false]);
  });
});

describe('bố cục màn THIẾT KẾ', () => {
  it('ô ≥ 44 px cho mọi màn trên Redmi Note 8 (393×851) và iPhone 11 Safari (414×715)', () => {
    for (const lv of DESIGN_LEVELS) {
      for (const [w, h] of [[393, 851], [414, 715]] as const) {
        const L = layoutDesign(w, h, lv.grid.cols, lv.grid.rows, lv.grid.inputs.length, lv.grid.outputs.length);
        expect(L.grid.cell, `${lv.id} @${w}×${h}`).toBeGreaterThanOrEqual(44);
      }
    }
  });
  it('màn rộng (laptop 1366×640, máy tính 1440×900, tablet ngang 1180×820): bảng bên trái lưới, không chồng nhau, ô ≥ 44 px', () => {
    for (const lv of DESIGN_LEVELS) {
      for (const [w, h] of [[1366, 640], [1440, 900], [1180, 820]] as const) {
        const L = layoutDesign(w, h, lv.grid.cols, lv.grid.rows, lv.grid.inputs.length, lv.grid.outputs.length);
        const T = L.table;
        const tag = `${lv.id} @${w}×${h}`;
        expect(L.grid.cell, tag).toBeGreaterThanOrEqual(44);
        expect(T.x + T.labelW + T.colW * T.cols, tag).toBeLessThan(L.grid.x); // bảng nằm trái lưới
        expect(L.grid.x + L.grid.cell * L.grid.cols, tag).toBeLessThanOrEqual(w);
        expect(L.ppaY, tag).toBeLessThan(h - TOOLBAR_H - MSG_H); // dòng PPA không bị thanh công cụ che
      }
    }
  });
  it('màn dọc vẫn giữ bố cục bảng phía trên lưới', () => {
    const L = layoutDesign(820, 1180, 5, 5, 2, 1);
    expect(L.table.y + L.table.rows * L.table.rowH).toBeLessThan(L.grid.y);
  });
  it('đổi điểm chạm sang ô và cột bảng chân trị', () => {
    const L = layoutDesign(400, 800, 5, 5, 2, 1);
    const { x, y, cell } = L.grid;
    expect(cellAtPoint(L, x + 1.5 * cell, y + 0.5 * cell)).toEqual([1, 0]);
    expect(cellAtPoint(L, x - 1, y)).toBeNull();
    const T = L.table;
    expect(tableColAtPoint(L, T.x + T.labelW + 2.5 * T.colW, T.y + 5)).toBe(2);
    expect(tableColAtPoint(L, T.x + 2, T.y + 5)).toBe(-1);
  });
  it('lướt nhanh qua nhiều ô: tự chèn các ô ở giữa theo bước ngang/dọc', () => {
    expect(stepCells([0, 0], [3, 0])).toEqual([[1, 0], [2, 0], [3, 0]]);
    expect(stepCells([0, 0], [2, 1])).toEqual([[1, 0], [2, 0], [2, 1]]);
    expect(stepCells([2, 2], [2, 2])).toEqual([]);
  });
});
