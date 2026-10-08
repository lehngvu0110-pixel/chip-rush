// KIỂM THỬ: lớp lỗi, solver minimax (đối chiếu vét cạn), dữ liệu màn t01–t06, chấm câu trả lời.
import { describe, expect, it } from 'vitest';
import { runTree, solveDebug } from '../src/ai/debug-solver';
import { compileOrThrow, evaluateRow } from '../src/core/circuit/simulate';
import type { Netlist } from '../src/core/circuit/types';
import { enumerateFaults, faultGroup, outputSignature } from '../src/core/debug/faults';
import { DEBUG_LEVELS } from '../src/core/level/debug-levels';
import { debugSetup, debugStars, isCorrectAnswer, probeLimit, solvedDebug } from '../src/core/level/debug-setup';

const chain: Netlist = {
  inputs: ['A'],
  outputs: ['Y'],
  gates: [
    { id: 'n1', type: 'NOT', inputs: ['A'], output: 'p' },
    { id: 'n2', type: 'NOT', inputs: ['p'], output: 'q' },
    { id: 'n3', type: 'NOT', inputs: ['q'], output: 'Y' },
  ],
};

/** Vét cạn MỌI cây quyết định (không ghi nhớ, không cắt tỉa) — cài độc lập để đối chiếu với solver. */
function bruteDepth(vals: number[][], set: number[]): number {
  if (set.length <= 1) return 0;
  let best = Infinity;
  const M = vals[0]?.length ?? 0;
  for (let m = 0; m < M; m++) {
    const one = set.filter((k) => vals[k]?.[m] === 1);
    const zero = set.filter((k) => vals[k]?.[m] === 0);
    if (!one.length || !zero.length) continue;
    best = Math.min(best, 1 + Math.max(bruteDepth(vals, one), bruteDepth(vals, zero)));
  }
  return best;
}

describe('lớp lỗi', () => {
  it('chuỗi 3 NOT: đảo cổng nào Y cũng sai y hệt → 3 lớp nghi ngờ', () => {
    const g = faultGroup(chain, 'gate-invert', { kind: 'gate-invert', gate: 'n2' });
    expect(g.classes).toHaveLength(3);
    expect(g.classes[g.trueClass]?.[0]).toEqual({ kind: 'gate-invert', gate: 'n2' });
  });

  it('lỗi không gây triệu chứng ở đầu ra (dư thừa) → báo lỗi dữ liệu màn', () => {
    // Y = A OR (A AND B): kẹt 0 ở (A AND B) không đổi được Y
    const red: Netlist = {
      inputs: ['A', 'B'],
      outputs: ['Y'],
      gates: [
        { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'p' },
        { id: 'o1', type: 'OR', inputs: ['A', 'p'], output: 'Y' },
      ],
    };
    expect(() => faultGroup(red, 'stuck-at', { kind: 'stuck-at', net: 'p', value: 0 })).toThrow('không phát hiện được');
  });

  it('kẹt: mỗi net có 2 lỗi (kẹt 0, kẹt 1)', () => {
    const c = compileOrThrow(chain);
    expect(enumerateFaults(c, 'stuck-at')).toHaveLength(2 * c.nets.length);
  });
});

describe('solver minimax', () => {
  it('chuỗi 3 NOT: par = 2 = ceil(log2 3); cây tìm đúng mọi lỗi trong ≤ par lần đo', () => {
    const g = faultGroup(chain, 'gate-invert', { kind: 'gate-invert', gate: 'n1' });
    const r = solveDebug(g.circuit, g.classes);
    expect(r.par).toBe(2);
    expect(r.optimal).toBe(true);
    g.classes.forEach((cl, k) => {
      const run = runTree(g.circuit, r.tree, cl[0]!);
      expect(run.leaf).toBe(k);
      expect(run.probes).toBeLessThanOrEqual(r.par);
    });
  });

  it.each(DEBUG_LEVELS.map((l) => [l.id, l] as const))('%s: par của solver = vét cạn mọi cây; cây đúng với mọi lỗi', (_id, lv) => {
    const st = debugSetup(lv);
    const c = st.group.circuit;
    const r = solveDebug(c, st.group.classes, st.probeNets);
    // bảng giá trị (lớp × phép đo) để vét cạn độc lập
    const R = 1 << c.inputIdx.length;
    const vals = st.group.classes.map((cl) => {
      const row: number[] = [];
      for (const net of st.probeNets) for (let rr = 0; rr < R; rr++) row.push(evaluateRow(c, rr, cl[0]!)[net] as number);
      return row;
    });
    expect(r.par).toBe(bruteDepth(vals, st.group.classes.map((_, k) => k)));
    st.group.classes.forEach((cl, k) => {
      const run = runTree(c, r.tree, cl[0]!);
      expect(run.leaf).toBe(k);
      expect(run.probes).toBeLessThanOrEqual(r.par);
    });
  });
});

describe('màn KIỂM THỬ', () => {
  it.each(DEBUG_LEVELS.map((l) => [l.id, l] as const))('%s: có bố trí, par ghi sẵn khớp khi tính lại, lỗi thật có triệu chứng', (_id, lv) => {
    const solved = solvedDebug(lv.id);
    expect(solved).toBeDefined();
    const st = debugSetup(lv);
    expect(st.par).toBe(solveDebug(st.group.circuit, st.group.classes, st.probeNets).par);
    expect(solved!.classes).toBe(st.group.classes.length);
    expect(outputSignature(st.group.circuit, st.fault)).not.toBe(outputSignature(st.group.circuit));
    expect(st.group.trueClass).toBeGreaterThanOrEqual(0);
  });

  it.each(DEBUG_LEVELS.map((l) => [l.id, l] as const))('%s: báo đúng lỗi thật → đúng; báo lỗi ở lớp khác → sai', (_id, lv) => {
    const st = debugSetup(lv);
    expect(isCorrectAnswer(st, st.fault)).toBe(true);
    st.group.classes.forEach((cl, k) => {
      for (const f of cl) expect(isCorrectAnswer(st, f)).toBe(k === st.group.trueClass);
    });
    expect(isCorrectAnswer(st, { kind: 'gate-invert', gate: 'không-có' })).toBe(false);
  });

  it('sao và giới hạn đo theo SPEC 3', () => {
    expect([debugStars(2, 2), debugStars(4, 2), debugStars(5, 2)]).toEqual([3, 2, 1]);
    expect([probeLimit(0), probeLimit(1), probeLimit(3)]).toEqual([3, 3, 6]);
  });
});
