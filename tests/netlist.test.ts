// Lưới → netlist → mô phỏng; dây cắt nhau, chập mạch, dây hở, via, cổng, vòng lặp, PPA.
import { describe, expect, it } from 'vitest';
import { Grid, type GridSpec, type Side } from '../src/core/circuit/grid';
import { areaOf, diagnose, gridToNetlist } from '../src/core/circuit/netlist';
import { compareTruthTable, compileOrThrow, logicDepth, toggleCount, truthTable } from '../src/core/circuit/simulate';
import type { GateType } from '../src/core/circuit/types';
import { halfAdder } from './fixtures/circuits';

type CR = [number, number];
const two: GridSpec = {
  cols: 6,
  rows: 8,
  layers: 2,
  inputs: [{ id: 'A', cell: [0, 2] }, { id: 'B', cell: [0, 5] }],
  outputs: [{ id: 'Y', cell: [5, 3] }],
};

/** Vẽ đường dây qua dãy (cột, hàng). */
function path(g: Grid, layer: number, ...pts: CR[]): void {
  g.drawPath(layer, pts.map(([c, r]) => g.cellAt(c, r)));
}
function gate(g: Grid, at: CR, type: GateType, out: Side = 0): void {
  if (!g.placeGate(g.cellAt(at[0], at[1]), type, out)) throw new Error('không đặt được cổng');
}
const table = (g: Grid): number[][] => {
  const d = diagnose(g);
  if (!d.ok) throw new Error(d.problems.map((p) => p.message).join(' | '));
  return truthTable(d.circuit).map((r) => [...r.inputs, ...r.outputs]);
};

describe('netlist – dây dẫn', () => {
  it('d01: dây thẳng A → đèn: Y = A, Area = số ô dây (không tính chân)', () => {
    const g = new Grid({ cols: 6, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [5, 1] }] });
    path(g, 0, [0, 1], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1]);
    expect(table(g)).toEqual([[0, 0], [1, 1]]);
    expect(areaOf(g)).toBe(4);
    expect(gridToNetlist(g).netlist).toEqual({ inputs: ['A'], outputs: ['A'], gates: [] });
  });

  it('dây hở (thiếu 1 đoạn) → đèn chưa nối, tô đúng đoạn dây phía đèn', () => {
    const g = new Grid({ cols: 6, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [5, 1] }] });
    path(g, 0, [0, 1], [1, 1], [2, 1]);
    path(g, 0, [3, 1], [4, 1], [5, 1]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.problems.map((p) => p.kind)).toEqual(['led-unconnected']);
    expect(d.problems[0]!.nodes.map((n) => g.colRow(n.cell))).toEqual([[3, 1], [4, 1], [5, 1]]);
  });

  it('hai dây song song sát nhau KHÔNG dính nhau', () => {
    const g = new Grid({ cols: 4, rows: 2, layers: 1, inputs: [{ id: 'A', cell: [0, 0] }, { id: 'B', cell: [0, 1] }], outputs: [{ id: 'X', cell: [3, 0] }, { id: 'Y', cell: [3, 1] }] });
    path(g, 0, [0, 0], [1, 0], [2, 0], [3, 0]);
    path(g, 0, [0, 1], [1, 1], [2, 1], [3, 1]);
    expect(table(g)).toEqual([[0, 0, 0, 0], [0, 1, 0, 1], [1, 0, 1, 0], [1, 1, 1, 1]]);
  });

  it('d03: hai dây CẮT NHAU cùng lớp = chập mạch, tô cả 2 dây', () => {
    const g = new Grid({ cols: 3, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [1, 0] }], outputs: [{ id: 'X', cell: [2, 1] }, { id: 'Y', cell: [1, 2] }] });
    path(g, 0, [0, 1], [1, 1], [2, 1]); // ngang
    path(g, 0, [1, 0], [1, 1], [1, 2]); // dọc, cắt tại (1,1)
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    const short = d.problems.find((p) => p.kind === 'short');
    expect(short).toBeDefined();
    expect(short!.nodes).toHaveLength(5); // cả hình chữ thập
  });

  it('dây lớp 2 đè lên dây lớp 1 (không via) thì không nối, không chập', () => {
    const g = new Grid({ cols: 3, rows: 3, layers: 2, inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [1, 0] }], outputs: [{ id: 'X', cell: [2, 1] }, { id: 'Y', cell: [1, 2] }] });
    path(g, 0, [0, 1], [1, 1], [2, 1]); // ngang ở lớp 1
    // dây dọc đi ở lớp 2, không via: đè lên chỗ giao nhưng KHÔNG nối với dây lớp 1
    path(g, 1, [1, 0], [1, 1], [1, 2]);
    const { netlist } = gridToNetlist(g);
    expect(netlist.inputs).toEqual(['A', 'B']);
    expect(netlist.outputs).toEqual(['A', 'Y']); // Y chỉ nối lớp 2 (không có via) → chưa nhận tín hiệu
  });

  it('via nối 2 lớp: đường A → via → lớp 2 → via → đèn; gỡ via là đứt', () => {
    const g = new Grid({ cols: 5, rows: 3, layers: 2, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [4, 1] }], blocked: [[2, 1]] });
    path(g, 0, [0, 1], [1, 1]);
    g.toggleVia(g.cellAt(1, 1));
    path(g, 1, [1, 1], [1, 0], [2, 0], [3, 0], [3, 1]);
    g.toggleVia(g.cellAt(3, 1));
    path(g, 0, [3, 1], [4, 1]);
    expect(table(g)).toEqual([[0, 0], [1, 1]]);
    // Area: lớp 1 có (1,1),(3,1); lớp 2 có (1,1),(1,0),(2,0),(3,0),(3,1); 2 via
    expect(areaOf(g)).toBe(2 + 5 + 2);
    g.toggleVia(g.cellAt(3, 1));
    expect(diagnose(g).ok).toBe(false);
  });

  it('cầu vượt thật: 2 tín hiệu giao nhau nhờ lớp 2, không chập', () => {
    const g = new Grid({ cols: 5, rows: 5, layers: 2, inputs: [{ id: 'A', cell: [0, 2] }, { id: 'B', cell: [2, 0] }], outputs: [{ id: 'X', cell: [4, 2] }, { id: 'Y', cell: [2, 4] }] });
    path(g, 0, [0, 2], [1, 2], [2, 2], [3, 2], [4, 2]); // A → X ngang, lớp 1
    path(g, 0, [2, 0], [2, 1]);
    g.toggleVia(g.cellAt(2, 1));
    path(g, 1, [2, 1], [2, 2], [2, 3]); // vượt qua (2,2) ở lớp 2
    g.toggleVia(g.cellAt(2, 3));
    path(g, 0, [2, 3], [2, 4]);
    expect(table(g)).toEqual([[0, 0, 0, 0], [0, 1, 0, 1], [1, 0, 1, 0], [1, 1, 1, 1]]);
  });

  it('dây lớp 2 đi ngang qua cổng không nối vào cổng', () => {
    const g = new Grid(two);
    gate(g, [3, 3], 'NOT');
    path(g, 1, [2, 3], [3, 3], [4, 3]);
    const { netlist } = gridToNetlist(g);
    expect(netlist.gates[0]!.inputs).toEqual([]);
  });
});

describe('netlist – cổng', () => {
  /** A (0,2) và B (0,5) vào cổng ở (3,3) từ phía Bắc và Nam, ra Đông tới Y (5,3). */
  function twoInput(type: GateType): Grid {
    const g = new Grid(two);
    gate(g, [3, 3], type);
    path(g, 0, [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]); // vào từ Bắc
    path(g, 0, [0, 5], [1, 5], [2, 5], [3, 5], [3, 4], [3, 3]); // vào từ Nam
    path(g, 0, [3, 3], [4, 3], [5, 3]); // ra Đông
    return g;
  }

  it.each([
    ['AND', [0, 0, 0, 1]],
    ['OR', [0, 1, 1, 1]],
    ['XOR', [0, 1, 1, 0]],
    ['NAND', [1, 1, 1, 0]],
    ['NOR', [1, 0, 0, 0]],
    ['XNOR', [1, 0, 0, 1]],
  ] as const)('%s trên lưới cho đúng bảng chân trị', (type, ys) => {
    expect(table(twoInput(type)).map((r) => r[2])).toEqual(ys);
  });

  it('d04: NOT với chân vào phía Tây', () => {
    const g = new Grid({ cols: 5, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [4, 1] }] });
    gate(g, [2, 1], 'NOT');
    path(g, 0, [0, 1], [1, 1], [2, 1], [3, 1], [4, 1]);
    expect(table(g)).toEqual([[0, 1], [1, 0]]);
    expect(areaOf(g)).toBe(3); // 2 ô dây + 1 cổng
  });

  it('thiếu dây vào → lỗi số chân, tô đúng ô cổng', () => {
    const g = new Grid(two);
    gate(g, [3, 3], 'AND');
    path(g, 0, [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]);
    path(g, 0, [3, 3], [4, 3], [5, 3]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    const p = d.problems.find((x) => x.kind === 'arity');
    expect(p?.message).toBe('Cổng AND cần 2 dây vào nhưng đang có 1.');
    expect(p?.nodes.map((n) => g.colRow(n.cell))).toEqual([[3, 3]]);
  });

  it('3 dây vào cổng 2 chân → lỗi số chân', () => {
    const g = twoInput('AND');
    path(g, 0, [2, 3], [3, 3]); // thêm dây vào phía Tây
    path(g, 0, [2, 4], [2, 3]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.some((p) => p.kind === 'arity')).toBe(true);
  });

  it('dây nối nguồn vào CHÂN RA của cổng = chập (2 nguồn lái 1 dây)', () => {
    const g = twoInput('AND');
    path(g, 0, [4, 3], [4, 2], [3, 2]); // nối dây ra của cổng với dây A
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.some((p) => p.kind === 'short')).toBe(true);
  });

  it('chân ra chưa nối: cổng vẫn hợp lệ, nhưng đèn báo chưa nối', () => {
    const g = new Grid(two);
    gate(g, [3, 3], 'AND');
    path(g, 0, [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]);
    path(g, 0, [0, 5], [1, 5], [2, 5], [3, 5], [3, 4], [3, 3]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (!d.ok) expect(d.problems.map((p) => p.kind)).toEqual(['led-unconnected']);
    expect(gridToNetlist(g).netlist.gates[0]!.output).toBe('g3_3.out');
  });

  it('dây hở vào cổng (không có nguồn) → lỗi "dây hở" kèm ô cổng', () => {
    const g = new Grid(two);
    gate(g, [3, 3], 'NOT');
    path(g, 0, [1, 3], [2, 3], [3, 3], [4, 3], [5, 3]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    const open = d.problems.find((p) => p.kind === 'open');
    expect(open?.nodes.map((n) => g.colRow(n.cell))).toContainEqual([3, 3]);
  });

  it('xoay cổng: chân ra phía Bắc', () => {
    const g = new Grid({ cols: 3, rows: 4, layers: 1, inputs: [{ id: 'A', cell: [1, 3] }], outputs: [{ id: 'Y', cell: [1, 0] }] });
    gate(g, [1, 1], 'NOT', 3);
    path(g, 0, [1, 3], [1, 2], [1, 1], [1, 0]);
    expect(table(g)).toEqual([[0, 1], [1, 0]]);
  });

  it('2 cổng kề nhau nối thẳng chân ra → chân vào (d08: NAND = AND + NOT)', () => {
    const g = new Grid(two);
    gate(g, [2, 3], 'AND');
    gate(g, [3, 3], 'NOT');
    path(g, 0, [0, 2], [1, 2], [2, 2], [2, 3]);
    path(g, 0, [0, 5], [1, 5], [2, 5], [2, 4], [2, 3]);
    path(g, 0, [2, 3], [3, 3], [4, 3], [5, 3]);
    expect(table(g).map((r) => r[2])).toEqual([1, 1, 1, 0]);
  });

  it('vòng lặp: chân ra quay về chân vào của chính nó', () => {
    const g = new Grid(two);
    gate(g, [3, 3], 'AND');
    path(g, 0, [0, 2], [1, 2], [2, 2], [2, 3], [3, 3]); // vào từ Tây
    path(g, 0, [3, 3], [4, 3], [4, 4], [3, 4], [3, 3]); // ra Đông rồi vòng về phía Nam
    path(g, 0, [4, 3], [5, 3]);
    const d = diagnose(g);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    const loop = d.problems.find((p) => p.kind === 'loop');
    expect(loop?.nodes.map((n) => g.colRow(n.cell))).toEqual([[3, 3]]);
  });
});

describe('netlist – mạch hoàn chỉnh & PPA', () => {
  it('d11: half adder trên lưới khớp mạch mẫu; Delay 1, Power 8 như SPEC', () => {
    const g = new Grid({
      cols: 6,
      rows: 8,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 6] }],
      outputs: [{ id: 'S', cell: [5, 2] }, { id: 'C', cell: [5, 5] }],
    });
    gate(g, [3, 2], 'XOR');
    gate(g, [3, 5], 'AND');
    // A: (0,1) → (3,1) vào XOR từ Bắc; rẽ nhánh xuống cột 1 tới (1,4) → (3,4) vào AND từ Bắc
    path(g, 0, [0, 1], [1, 1], [2, 1], [3, 1], [3, 2]);
    path(g, 0, [1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [3, 5]);
    // B: (0,6) → (3,6) vào AND từ Nam; nhánh lên ở cột 2 bị dây A chắn tại (2,4) → đi lớp 2 qua via
    path(g, 0, [0, 6], [1, 6], [2, 6], [3, 6], [3, 5]);
    path(g, 0, [2, 6], [2, 5]);
    g.toggleVia(g.cellAt(2, 5));
    path(g, 1, [2, 5], [2, 4], [2, 3]);
    g.toggleVia(g.cellAt(2, 3));
    path(g, 0, [2, 3], [2, 2], [3, 2]); // vào XOR từ Tây
    path(g, 0, [3, 2], [4, 2], [5, 2]);
    path(g, 0, [3, 5], [4, 5], [5, 5]);
    const d = diagnose(g);
    if (!d.ok) throw new Error(d.problems.map((p) => p.message).join(' | '));
    expect(compareTruthTable(truthTable(d.circuit), truthTable(compileOrThrow(halfAdder))).pass).toBe(true);
    expect(logicDepth(d.circuit)).toBe(1);
    expect(toggleCount(d.circuit)).toBe(8);
  });

  it('tên net ổn định: cùng lưới → cùng netlist', () => {
    const build = (): Grid => {
      const g = new Grid(two);
      gate(g, [3, 3], 'OR');
      path(g, 0, [0, 2], [1, 2], [2, 2], [3, 2], [3, 3]);
      path(g, 0, [0, 5], [1, 5], [2, 5], [3, 5], [3, 4], [3, 3]);
      path(g, 0, [3, 3], [4, 3], [5, 3]);
      return g;
    };
    expect(gridToNetlist(build()).netlist).toEqual(gridToNetlist(build().clone()).netlist);
    expect(gridToNetlist(build()).netlist).toEqual({ inputs: ['A', 'B'], outputs: ['Y'], gates: [{ id: 'g3_3', type: 'OR', inputs: ['B', 'A'], output: 'Y' }] });
  });
});
