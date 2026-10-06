// Độ khó thích nghi cho VẬN HÀNH – chế độ Vô tận (docs/SPEC.md mục 5.3).
// Đây là thống kê trực tuyến đơn giản, KHÔNG phải mạng nơ-ron:
//  1) Chọn loại gói: mỗi "ô" (cổng đáp án, cặp A-B) có phân phối Beta(sai + 1, đúng + 1) cho xác suất
//     người chơi sai ô đó. Thompson sampling: rút một mẫu cho mỗi ô, chọn ô có mẫu lớn nhất → ô hay sai
//     được hỏi nhiều hơn, nhưng ô ít dữ liệu vẫn có cơ hội (vì phân phối của nó còn rộng).
//  2) Điều tốc: giữ tỉ lệ đúng trên 20 câu gần nhất trong khoảng 75–85%.
import { RUNTIME } from '../config';
import type { GateType } from '../core/circuit/types';
import type { Rng } from '../core/util/rng';

export interface Cell {
  gate: GateType;
  a: 0 | 1;
  b: 0 | 1;
}

export const cellKey = (c: Cell): string => `${c.gate}:${c.a}${c.b}`;

/** Gamma(k, 1) với k nguyên dương = tổng k biến mũ. Đủ chính xác và nhanh vì k nhỏ (số lần đúng/sai). */
function gammaInt(k: number, rng: Rng): number {
  let s = 0;
  for (let i = 0; i < k; i++) s -= Math.log(1 - rng()); // 1 - rng() ∈ (0, 1] tránh log(0)
  return s;
}

/** Mẫu Beta(α, β) với α, β nguyên dương: X/(X+Y), X~Gamma(α), Y~Gamma(β). */
export function sampleBeta(alpha: number, beta: number, rng: Rng): number {
  const x = gammaInt(alpha, rng);
  const y = gammaInt(beta, rng);
  return x / (x + y);
}

export class AdaptiveDifficulty {
  private stats = new Map<string, { wrong: number; right: number }>();
  private recent: boolean[] = [];
  private answersSinceCheck = 0;

  record(cell: Cell, correct: boolean): void {
    const k = cellKey(cell);
    const s = this.stats.get(k) ?? { wrong: 0, right: 0 };
    if (correct) s.right++;
    else s.wrong++;
    this.stats.set(k, s);
    this.recent.push(correct);
    if (this.recent.length > RUNTIME.adaptive.window) this.recent.shift();
    this.answersSinceCheck++;
  }

  /** Chọn ô kế tiếp trong danh sách ứng viên. */
  pickCell(candidates: readonly Cell[], rng: Rng): Cell {
    if (candidates.length === 0) throw new Error('pickCell: không có ô ứng viên');
    if (rng() < RUNTIME.adaptive.explore) return candidates[Math.floor(rng() * candidates.length)] as Cell;
    let best = candidates[0] as Cell;
    let bestScore = -1;
    for (const c of candidates) {
      const s = this.stats.get(cellKey(c)) ?? { wrong: 0, right: 0 };
      const score = sampleBeta(s.wrong + 1, s.right + 1, rng);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }

  /** Tỉ lệ đúng trên cửa sổ gần nhất, null nếu chưa đủ mẫu. */
  recentAccuracy(): number | null {
    if (this.recent.length < RUNTIME.adaptive.minSamples) return null;
    return this.recent.filter(Boolean).length / this.recent.length;
  }

  /**
   * Điều chỉnh thời gian rơi. Chỉ xét sau mỗi `checkEvery` câu để tốc độ không nhảy liên tục.
   * Luôn kẹp trong [minFall, maxFall].
   */
  adjustFall(fall: number): number {
    if (this.answersSinceCheck < RUNTIME.adaptive.checkEvery) return fall;
    this.answersSinceCheck = 0;
    const acc = this.recentAccuracy();
    if (acc === null) return fall;
    let next = fall;
    if (acc > RUNTIME.adaptive.high) next = fall * RUNTIME.adaptive.speedUp;
    else if (acc < RUNTIME.adaptive.low) next = fall * RUNTIME.adaptive.slowDown;
    return Math.min(RUNTIME.maxFall, Math.max(RUNTIME.minFall, next));
  }

  /** Cổng người chơi sai nhiều nhất (tỉ lệ sai cao nhất, cần ≥ 3 lần gặp), để giải thích trên màn kết quả. */
  weakestGate(): { gate: GateType; errorRate: number } | null {
    const byGate = new Map<GateType, { wrong: number; total: number }>();
    for (const [k, s] of this.stats) {
      const gate = k.split(':')[0] as GateType;
      const g = byGate.get(gate) ?? { wrong: 0, total: 0 };
      g.wrong += s.wrong;
      g.total += s.wrong + s.right;
      byGate.set(gate, g);
    }
    let worst: { gate: GateType; errorRate: number } | null = null;
    for (const [gate, g] of byGate) {
      if (g.total < 3 || g.wrong === 0) continue;
      const rate = g.wrong / g.total;
      if (!worst || rate > worst.errorRate) worst = { gate, errorRate: rate };
    }
    return worst;
  }
}
