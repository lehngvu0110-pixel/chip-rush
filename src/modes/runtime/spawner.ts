// Sinh "gói bit" cho VẬN HÀNH. Mỗi gói = 2 bit vào (A, B) + bit mục tiêu = cổng_đáp_án(A, B).
// Người chơi đúng nếu chọn BẤT KỲ cổng đã mở nào cho ra bit mục tiêu.
import { RUNTIME } from '../../config';
import { evalGate } from '../../core/circuit/gates';
import type { Bit, GateType } from '../../core/circuit/types';
import { pick, type Rng } from '../../core/util/rng';
import type { AdaptiveDifficulty, Cell } from '../../ai/adaptive';

/** Thứ tự nút trên màn hình (phím 1–4). */
export const RUNTIME_GATES: readonly GateType[] = ['AND', 'OR', 'XOR', 'NAND'];

/** Cổng đã mở theo điểm CAO NHẤT từng đạt (mở rồi thì không khóa lại khi bị trừ điểm). */
export function unlockedGates(bestScore: number): GateType[] {
  return RUNTIME_GATES.filter((g) => {
    const need = (RUNTIME.unlockAt as Partial<Record<GateType, number>>)[g];
    return need === undefined || bestScore >= need;
  });
}

export interface Packet {
  a: Bit;
  b: Bit;
  target: Bit;
  /** ô sinh ra gói (cổng đáp án dự kiến) — dùng cho độ khó thích nghi */
  cell: Cell;
  /** mọi cổng đã mở cho ra đúng bit mục tiêu */
  validGates: GateType[];
}

const PAIRS: readonly [Bit, Bit][] = [
  [0, 0],
  [0, 1],
  [1, 0],
  [1, 1],
];

export function allCells(gates: readonly GateType[]): Cell[] {
  return gates.flatMap((gate) => PAIRS.map(([a, b]) => ({ gate, a, b })));
}

export function makePacket(cell: Cell, gates: readonly GateType[]): Packet {
  const target = evalGate(cell.gate, [cell.a, cell.b]);
  const validGates = gates.filter((g) => evalGate(g, [cell.a, cell.b]) === target);
  return { a: cell.a, b: cell.b, target, cell, validGates };
}

/** Gói "1 đáp án": chỉ đúng một cổng đã mở cho ra bit mục tiêu → không đoán bừa mà trúng được. */
export function isUnique(cell: Cell, gates: readonly GateType[]): boolean {
  return makePacket(cell, gates).validGates.length === 1;
}

export class Spawner {
  constructor(
    private readonly rng: Rng,
    private readonly adaptive: AdaptiveDifficulty | null,
  ) {}

  next(gates: readonly GateType[]): Packet {
    const cells = allCells(gates);
    const unique = cells.filter((c) => isUnique(c, gates));
    // Với xác suất uniqueRatio chỉ chọn trong ô 1 đáp án; phần còn lại chọn trong mọi ô
    // (có thể vẫn trúng ô 1 đáp án) → tỉ lệ gói 1 đáp án ≥ uniqueRatio.
    const pool = unique.length > 0 && this.rng() < RUNTIME.uniqueRatio ? unique : cells;
    const cell = this.adaptive ? this.adaptive.pickCell(pool, this.rng) : pick(this.rng, pool);
    return makePacket(cell, gates);
  }
}
