import { describe, expect, it } from 'vitest';
import { GATE_ARITY } from '../src/core/circuit/gates';
import {
  MAX_INPUTS,
  compareTruthTable,
  compile,
  compileOrThrow,
  evaluateRow,
  grayOrder,
  logicDepth,
  readOutputs,
  toggleCount,
  truthTable,
} from '../src/core/circuit/simulate';
import type { Bit, Fault, GateInstance, GateType, Netlist, TruthRow } from '../src/core/circuit/types';
import { fullAdder, halfAdder, mux2, nandFromAndNot } from './fixtures/circuits';

const outs = (rows: TruthRow[]): string[] => rows.map((r) => r.outputs.join(''));

describe('truthTable – mạch mẫu', () => {
  it('half adder', () => {
    const t = truthTable(compileOrThrow(halfAdder));
    expect(t.map((r) => r.inputs.join(''))).toEqual(['00', '01', '10', '11']);
    expect(outs(t)).toEqual(['00', '10', '10', '01']); // S C
  });

  it('full adder khớp phép cộng 3 bit', () => {
    const t = truthTable(compileOrThrow(fullAdder));
    for (const row of t) {
      const sum = row.inputs.reduce<number>((a, b) => a + b, 0);
      expect(row.outputs).toEqual([sum & 1, sum >> 1]);
    }
  });

  it('NAND ghép từ AND + NOT', () => {
    expect(outs(truthTable(compileOrThrow(nandFromAndNot)))).toEqual(['1', '1', '1', '0']);
  });

  it('MUX 2:1 chọn A khi S=0, B khi S=1', () => {
    for (const row of truthTable(compileOrThrow(mux2))) {
      const [s, a, b] = row.inputs as [Bit, Bit, Bit];
      expect(row.outputs).toEqual([s ? b : a]);
    }
  });

  it('chỉ có dây (d01): đầu ra nối thẳng đầu vào, độ sâu 0', () => {
    const c = compileOrThrow({ inputs: ['A'], outputs: ['A'], gates: [] });
    expect(outs(truthTable(c))).toEqual(['0', '1']);
    expect(logicDepth(c)).toBe(0);
  });

  it('thứ tự cổng trong netlist không ảnh hưởng kết quả (sắp topo đúng)', () => {
    const reversed: Netlist = { ...fullAdder, gates: [...fullAdder.gates].reverse() };
    expect(truthTable(compileOrThrow(reversed))).toEqual(truthTable(compileOrThrow(fullAdder)));
  });
});

describe('compile – phát hiện lỗi mạch', () => {
  const kinds = (n: Netlist): string[] => {
    const r = compile(n);
    return r.ok ? [] : r.errors.map((e) => e.kind).sort();
  };

  it('đoản mạch: 2 cổng cùng lái 1 net', () => {
    const r = compile({
      inputs: ['A', 'B'],
      outputs: ['Y'],
      gates: [
        { id: 'g1', type: 'AND', inputs: ['A', 'B'], output: 'Y' },
        { id: 'g2', type: 'OR', inputs: ['A', 'B'], output: 'Y' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors).toContainEqual({ kind: 'multiple-drivers', net: 'Y', drivers: ['g1', 'g2'] });
  });

  it('đoản mạch: cổng lái vào net của công tắc đầu vào', () => {
    expect(kinds({ inputs: ['A'], outputs: ['A'], gates: [{ id: 'n', type: 'NOT', inputs: ['A'], output: 'A' }] })).toContain(
      'multiple-drivers',
    );
  });

  it('dây hở: cổng đọc net không ai lái, LED nối vào net không ai lái', () => {
    const r = compile({
      inputs: ['A'],
      outputs: ['Y', 'Z'],
      gates: [{ id: 'g', type: 'AND', inputs: ['A', 'x'], output: 'Y' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toContainEqual({ kind: 'undriven-net', net: 'x', readers: ['g'] });
      expect(r.errors).toContainEqual({ kind: 'undriven-net', net: 'Z', readers: ['out:Z'] });
    }
  });

  it('vòng lặp tổ hợp: chỉ báo cổng trong vòng, không báo cổng phía sau', () => {
    const r = compile({
      inputs: ['A'],
      outputs: ['Y'],
      gates: [
        { id: 'n1', type: 'NOT', inputs: ['q'], output: 'p' },
        { id: 'n2', type: 'NOT', inputs: ['p'], output: 'q' },
        { id: 'tail', type: 'AND', inputs: ['A', 'p'], output: 'Y' },
      ],
    });
    expect(r).toEqual({ ok: false, errors: [{ kind: 'combinational-loop', gates: ['n1', 'n2'] }] });
  });

  it('cổng tự nối vào chính nó cũng là vòng lặp', () => {
    expect(kinds({ inputs: ['A'], outputs: ['Y'], gates: [{ id: 'g', type: 'AND', inputs: ['A', 'Y'], output: 'Y' }] })).toEqual([
      'combinational-loop',
    ]);
  });

  it('sai số chân và trùng id được báo cùng lúc', () => {
    expect(
      kinds({
        inputs: ['A', 'B'],
        outputs: ['Y'],
        gates: [
          { id: 'g', type: 'NOT', inputs: ['A', 'B'], output: 'Y' },
          { id: 'g', type: 'AND', inputs: ['A'], output: 'Z' },
        ],
      }),
    ).toEqual(['arity', 'arity', 'duplicate-gate-id']);
  });

  it(`từ chối quá ${MAX_INPUTS} đầu vào`, () => {
    const inputs = Array.from({ length: MAX_INPUTS + 1 }, (_, i) => `I${i}`);
    expect(kinds({ inputs, outputs: ['I0'], gates: [] })).toEqual(['too-many-inputs']);
  });

  it('compileOrThrow ném lỗi với mạch hỏng', () => {
    expect(() => compileOrThrow({ inputs: [], outputs: ['Y'], gates: [] })).toThrow();
  });
});

describe('PPA: Delay và Power', () => {
  it('độ sâu logic các mạch mẫu', () => {
    expect(logicDepth(compileOrThrow(halfAdder))).toBe(1);
    expect(logicDepth(compileOrThrow(nandFromAndNot))).toBe(2);
    expect(logicDepth(compileOrThrow(fullAdder))).toBe(3);
    expect(logicDepth(compileOrThrow(mux2))).toBe(3);
  });

  it('mã Gray 3 bit và tính chất mỗi bước đổi đúng 1 bit', () => {
    expect(grayOrder(3)).toEqual([0, 1, 3, 2, 6, 7, 5, 4]);
    for (let n = 1; n <= 6; n++) {
      const g = grayOrder(n);
      expect(new Set(g).size).toBe(1 << n); // đủ mọi hàng, không trùng
      for (let k = 1; k < g.length; k++) {
        const diff = (g[k] as number) ^ (g[k - 1] as number);
        expect(diff & (diff - 1)).toBe(0); // đúng 1 bit
        expect(diff).not.toBe(0);
      }
    }
  });

  it('toggle của NOT = 2 (A đổi 1 lần, Y đổi 1 lần)', () => {
    expect(toggleCount(compileOrThrow({ inputs: ['A'], outputs: ['Y'], gates: [{ id: 'n', type: 'NOT', inputs: ['A'], output: 'Y' }] }))).toBe(2);
  });

  it('toggle của half adder = 8 (tính tay: 00→01: 2, 01→11: 3, 11→10: 3)', () => {
    expect(toggleCount(compileOrThrow(halfAdder))).toBe(8);
  });
});

describe('so bảng chân trị', () => {
  const expected = truthTable(compileOrThrow(halfAdder));

  it('đúng hết thì pass', () => {
    expect(compareTruthTable(expected, expected)).toEqual({ correctRows: 4, totalRows: 4, pass: true, wrongRows: [] });
  });

  it('chỉ ra hàng sai', () => {
    const swapped: Netlist = {
      ...halfAdder,
      gates: [
        { id: 'x1', type: 'OR', inputs: ['A', 'B'], output: 'S' }, // sai ở hàng 11
        { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'C' },
      ],
    };
    const r = compareTruthTable(truthTable(compileOrThrow(swapped)), expected);
    expect(r).toEqual({ correctRows: 3, totalRows: 4, pass: false, wrongRows: [3] });
  });

  it('ném lỗi khi lệch số hàng hoặc lệch đầu vào (lỗi dữ liệu màn)', () => {
    expect(() => compareTruthTable(expected.slice(1), expected)).toThrow();
    const bad = expected.map((r, i) => (i === 0 ? { ...r, inputs: [1, 1] as Bit[] } : r));
    expect(() => compareTruthTable(bad, expected)).toThrow();
  });
});

describe('mô hình lỗi (chế độ KIỂM THỬ)', () => {
  const ha = compileOrThrow(halfAdder);
  const fa = compileOrThrow(fullAdder);

  it('stuck-at-0 trên đầu ra S', () => {
    expect(outs(truthTable(ha, { kind: 'stuck-at', net: 'S', value: 0 }))).toEqual(['00', '00', '00', '01']);
  });

  it('gate-invert cổng AND biến C thành NAND', () => {
    expect(outs(truthTable(ha, { kind: 'gate-invert', gate: 'a1' })).map((s) => s[1])).toEqual(['1', '1', '1', '0']);
  });

  it('stuck-at-1 trên net đầu vào A', () => {
    for (const row of truthTable(ha, { kind: 'stuck-at', net: 'A', value: 1 })) {
      const b = row.inputs[1] as Bit;
      expect(row.outputs).toEqual([b ^ 1, b]);
    }
  });

  it('lỗi ở net giữa lan tới các cổng phía sau (full adder, p stuck-at-0)', () => {
    for (const row of truthTable(fa, { kind: 'stuck-at', net: 'p', value: 0 })) {
      const [a, b, cin] = row.inputs as [Bit, Bit, Bit];
      expect(row.outputs).toEqual([cin, a & b]);
    }
  });

  it('không có lỗi thì giống mạch gốc', () => {
    expect(truthTable(fa, undefined)).toEqual(truthTable(fa));
  });

  it('lỗi trỏ tới cổng/net không tồn tại thì ném lỗi', () => {
    expect(() => truthTable(ha, { kind: 'gate-invert', gate: 'nope' })).toThrow();
    expect(() => truthTable(ha, { kind: 'stuck-at', net: 'nope', value: 1 })).toThrow();
  });
});

// ---------------------------------------------------------------------------
// Đối chiếu ngẫu nhiên với một bộ đánh giá tham chiếu viết kiểu khác hẳn
// (đệ quy theo net, không sắp topo, không dùng mảng chỉ số), trên 500 mạch ngẫu nhiên.
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const REF_FN: Record<GateType, (x: number[]) => number> = {
  NOT: ([a]) => (a ? 0 : 1),
  AND: ([a, b]) => (a && b ? 1 : 0),
  OR: ([a, b]) => (a || b ? 1 : 0),
  XOR: ([a, b]) => (a !== b ? 1 : 0),
  NAND: ([a, b]) => (a && b ? 0 : 1),
  NOR: ([a, b]) => (a || b ? 0 : 1),
  XNOR: ([a, b]) => (a === b ? 1 : 0),
};

function randomNetlist(rnd: () => number): Netlist {
  const nIn = 1 + Math.floor(rnd() * 4);
  const nGates = Math.floor(rnd() * 9);
  const inputs = Array.from({ length: nIn }, (_, i) => `i${i}`);
  const nets = [...inputs];
  const types = Object.keys(GATE_ARITY) as GateType[];
  const gates: GateInstance[] = [];
  for (let k = 0; k < nGates; k++) {
    const type = types[Math.floor(rnd() * types.length)] as GateType;
    const ins = Array.from({ length: GATE_ARITY[type] }, () => nets[Math.floor(rnd() * nets.length)] as string);
    const out = `n${k}`;
    gates.push({ id: `g${k}`, type, inputs: ins, output: out });
    nets.push(out);
  }
  const outputs = Array.from({ length: 1 + Math.floor(rnd() * 3) }, () => nets[Math.floor(rnd() * nets.length)] as string);
  // xáo thứ tự cổng để buộc compile phải tự sắp topo
  for (let i = gates.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [gates[i], gates[j]] = [gates[j] as GateInstance, gates[i] as GateInstance];
  }
  return { inputs, outputs, gates };
}

function refNetValues(n: Netlist, row: number, fault?: Fault): Map<string, number> {
  const byOut = new Map(n.gates.map((g) => [g.output, g]));
  const memo = new Map<string, number>();
  const val = (net: string): number => {
    const cached = memo.get(net);
    if (cached !== undefined) return cached;
    let v: number;
    const idx = n.inputs.indexOf(net);
    if (idx >= 0) v = (row >> (n.inputs.length - 1 - idx)) & 1;
    else {
      const g = byOut.get(net) as GateInstance;
      v = REF_FN[g.type](g.inputs.map(val));
      if (fault?.kind === 'gate-invert' && fault.gate === g.id) v = 1 - v;
    }
    if (fault?.kind === 'stuck-at' && fault.net === net) v = fault.value;
    memo.set(net, v);
    return v;
  };
  const all = new Set([...n.inputs, ...n.gates.map((g) => g.output)]);
  for (const net of all) val(net);
  return memo;
}

function refDepth(n: Netlist): number {
  const byOut = new Map(n.gates.map((g) => [g.output, g]));
  const d = (net: string): number => {
    const g = byOut.get(net);
    return g ? 1 + Math.max(...g.inputs.map(d)) : 0;
  };
  return Math.max(...n.outputs.map(d));
}

function refToggles(n: Netlist): number {
  const rows = 1 << n.inputs.length;
  let t = 0;
  for (let k = 1; k < rows; k++) {
    const a = refNetValues(n, (k - 1) ^ ((k - 1) >> 1));
    const b = refNetValues(n, k ^ (k >> 1));
    for (const [net, v] of b) if (a.get(net) !== v) t++;
  }
  return t;
}

describe('đối chiếu ngẫu nhiên với bộ đánh giá tham chiếu', () => {
  const rnd = mulberry32(20261007);
  const cases = Array.from({ length: 500 }, () => randomNetlist(rnd));

  it('bảng chân trị, độ sâu, toggle và lỗi cài vào đều khớp', () => {
    for (const n of cases) {
      const c = compileOrThrow(n);
      const rows = 1 << n.inputs.length;
      const faults: (Fault | undefined)[] = [undefined];
      const g0 = n.gates[0];
      if (g0) faults.push({ kind: 'gate-invert', gate: g0.id }, { kind: 'stuck-at', net: g0.output, value: 1 });
      faults.push({ kind: 'stuck-at', net: n.inputs[0] as string, value: 0 });

      for (const f of faults) {
        for (let r = 0; r < rows; r++) {
          const ref = refNetValues(n, r, f);
          const got = readOutputs(c, evaluateRow(c, r, f));
          expect(got).toEqual(n.outputs.map((o) => ref.get(o)));
        }
      }
      expect(logicDepth(c)).toBe(refDepth(n));
      expect(toggleCount(c)).toBe(refToggles(n));
    }
  });
});
