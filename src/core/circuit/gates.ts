import type { Bit, GateType } from './types';

/** Số chân vào của từng loại cổng. Game chỉ dùng cổng 1 hoặc 2 đầu vào. */
export const GATE_ARITY: Readonly<Record<GateType, number>> = {
  NOT: 1,
  AND: 2,
  OR: 2,
  XOR: 2,
  NAND: 2,
  NOR: 2,
  XNOR: 2,
};

export const GATE_TYPES: readonly GateType[] = Object.keys(GATE_ARITY) as GateType[];

/**
 * Tính đầu ra một cổng. Dùng phép toán bit trên 0/1 nên nhanh và không cần nhánh if
 * (solver sẽ gọi hàm này hàng triệu lần khi tìm par).
 * Ném lỗi nếu sai số chân — đó là lỗi lập trình, mạch người chơi đã được kiểm tra arity trước.
 */
export function evalGate(type: GateType, inputs: readonly Bit[]): Bit {
  const arity = GATE_ARITY[type];
  if (inputs.length !== arity) {
    throw new Error(`Cổng ${type} cần ${arity} đầu vào, nhận ${inputs.length}`);
  }
  const a = inputs[0] as Bit;
  if (type === 'NOT') return (a ^ 1) as Bit;
  const b = inputs[1] as Bit;
  switch (type) {
    case 'AND':
      return (a & b) as Bit;
    case 'OR':
      return (a | b) as Bit;
    case 'XOR':
      return (a ^ b) as Bit;
    case 'NAND':
      return ((a & b) ^ 1) as Bit;
    case 'NOR':
      return ((a | b) ^ 1) as Bit;
    case 'XNOR':
      return (a ^ b ^ 1) as Bit;
  }
}
