import { describe, expect, it } from 'vitest';
import { GATE_ARITY, GATE_TYPES, evalGate } from '../src/core/circuit/gates';
import type { Bit, GateType } from '../src/core/circuit/types';

// Bảng chân trị chuẩn, viết tay độc lập với cài đặt (không suy ra từ phép bit) để test có ý nghĩa.
const TABLES: Record<Exclude<GateType, 'NOT'>, [Bit, Bit, Bit, Bit]> = {
  //      00 01 10 11
  AND: [0, 0, 0, 1],
  OR: [0, 1, 1, 1],
  XOR: [0, 1, 1, 0],
  NAND: [1, 1, 1, 0],
  NOR: [1, 0, 0, 0],
  XNOR: [1, 0, 0, 1],
};

describe('evalGate', () => {
  it('NOT đảo bit', () => {
    expect(evalGate('NOT', [0])).toBe(1);
    expect(evalGate('NOT', [1])).toBe(0);
  });

  for (const [type, table] of Object.entries(TABLES) as [Exclude<GateType, 'NOT'>, Bit[]][]) {
    it(`${type} đúng bảng chân trị`, () => {
      const got = ([[0, 0], [0, 1], [1, 0], [1, 1]] as Bit[][]).map((ins) => evalGate(type, ins));
      expect(got).toEqual(table);
    });
  }

  it('mọi loại cổng đều có trong bảng arity và được test', () => {
    expect(new Set(GATE_TYPES)).toEqual(new Set(['NOT', ...Object.keys(TABLES)]));
    expect(GATE_ARITY.NOT).toBe(1);
  });

  it('ném lỗi khi sai số chân', () => {
    expect(() => evalGate('AND', [1])).toThrow();
    expect(() => evalGate('NOT', [1, 0])).toThrow();
  });

  it('đầu ra luôn là 0 hoặc 1', () => {
    for (const t of GATE_TYPES) {
      const n = GATE_ARITY[t];
      for (let r = 0; r < 1 << n; r++) {
        const ins = Array.from({ length: n }, (_, i) => ((r >> i) & 1) as Bit);
        expect([0, 1]).toContain(evalGate(t, ins));
      }
    }
  });
});
