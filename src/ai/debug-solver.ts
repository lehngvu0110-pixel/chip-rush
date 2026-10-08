// Solver KIỂM THỬ (SPEC mục 5.2) — AI cổ điển: cây quyết định minimax.
// Câu hỏi: cần ít nhất bao nhiêu lần đo, trong TRƯỜNG HỢP XẤU NHẤT, để chắc chắn biết lỗi thuộc lớp nào?
// Mỗi phép đo = (dây, hàng đầu vào) → 0/1, chia tập lớp nghi ngờ làm 2.
// f(S) = 0 nếu |S| ≤ 1; ngược lại f(S) = 1 + min_m max(f(S₀), f(S₁)), chỉ xét phép đo chia được S.
// Duyệt hết có ghi nhớ theo bitmask khi ≤ 16 lớp → kết quả là TỐI ƯU. Nhiều hơn: tham lam theo
// lượng thông tin (không gọi là tối ưu). Tìm cây quyết định tối ưu tổng quát là NP-đầy đủ (Hyafil & Rivest, 1976).
import { evaluateRow, type CompiledCircuit } from '../core/circuit/simulate';
import type { Fault } from '../core/circuit/types';

export interface Measurement {
  net: number;
  row: number;
}

export type DecisionNode = { leaf: number } | { m: Measurement; zero: DecisionNode; one: DecisionNode };

export interface DebugSolveResult {
  par: number;
  optimal: boolean;
  tree: DecisionNode;
  measurements: Measurement[];
}

/**
 * @param probeNets chỉ số net được phép đo (mặc định: mọi net trừ đầu ra — đèn đã thấy miễn phí)
 */
export function solveDebug(c: CompiledCircuit, classes: Fault[][], probeNets?: number[], maxExact = 16): DebugSolveResult {
  const n = classes.length;
  const outs = new Set(c.outputIdx);
  const nets = probeNets ?? c.nets.map((_, i) => i).filter((i) => !outs.has(i));
  const R = 1 << c.inputIdx.length;
  const ms: Measurement[] = [];
  for (const net of nets) for (let row = 0; row < R; row++) ms.push({ net, row });
  // vals[m] = bitmask các lớp cho giá trị 1 ở phép đo m (lấy lỗi đại diện của lớp)
  const vals: number[] = ms.map(() => 0);
  classes.forEach((cl, k) => {
    const rep = cl[0];
    if (!rep) return;
    for (let row = 0; row < R; row++) {
      const v = evaluateRow(c, row, rep);
      ms.forEach((m, j) => {
        if (m.row === row && v[m.net]) vals[j] = (vals[j] as number) | (1 << k);
      });
    }
  });
  const popcount = (x: number): number => {
    let k = 0;
    for (let y = x; y; y &= y - 1) k++;
    return k;
  };
  const lowest = (x: number): number => 31 - Math.clz32(x & -x);

  if (n <= maxExact) {
    const memo = new Map<number, { cost: number; m: number }>();
    const f = (mask: number): number => {
      if (popcount(mask) <= 1) return 0;
      const hit = memo.get(mask);
      if (hit) return hit.cost;
      let best = Infinity;
      let bestM = -1;
      // cận dưới: ceil(log2 |S|) — đạt được thì dừng sớm
      const lb = Math.ceil(Math.log2(popcount(mask)));
      for (let j = 0; j < ms.length; j++) {
        const one = mask & (vals[j] as number);
        const zero = mask & ~(vals[j] as number);
        if (!one || !zero) continue;
        const cost = 1 + Math.max(f(one), f(zero));
        if (cost < best) {
          best = cost;
          bestM = j;
          if (best <= lb) break;
        }
      }
      memo.set(mask, { cost: best, m: bestM });
      return best;
    };
    const all = n >= 31 ? -1 : (1 << n) - 1;
    const par = f(all);
    if (!Number.isFinite(par)) throw new Error('Có hai lớp lỗi không phép đo nào phân biệt được');
    const build = (mask: number): DecisionNode => {
      if (popcount(mask) <= 1) return { leaf: lowest(mask) };
      const e = memo.get(mask);
      const j = e?.m ?? -1;
      const v = vals[j] as number;
      return { m: ms[j] as Measurement, one: build(mask & v), zero: build(mask & ~v) };
    };
    return { par, optimal: true, tree: build(all), measurements: ms };
  }
  // tham lam: chọn phép đo chia đều nhất
  const greedy = (mask: number): DecisionNode => {
    if (popcount(mask) <= 1) return { leaf: lowest(mask) };
    let bestJ = -1;
    let bestBal = Infinity;
    for (let j = 0; j < ms.length; j++) {
      const a = popcount(mask & (vals[j] as number));
      const b = popcount(mask) - a;
      if (!a || !b) continue;
      const bal = Math.abs(a - b);
      if (bal < bestBal) {
        bestBal = bal;
        bestJ = j;
      }
    }
    if (bestJ < 0) throw new Error('Có hai lớp lỗi không phép đo nào phân biệt được');
    const v = vals[bestJ] as number;
    return { m: ms[bestJ] as Measurement, one: greedy(mask & v), zero: greedy(mask & ~v) };
  };
  const depth = (t: DecisionNode): number => ('leaf' in t ? 0 : 1 + Math.max(depth(t.zero), depth(t.one)));
  const tree = greedy((1 << n) - 1);
  return { par: depth(tree), optimal: false, tree, measurements: ms };
}

/** Đi theo cây với lỗi thật `fault`: trả về (lớp tìm được, số lần đo). Dùng để kiểm chứng. */
export function runTree(c: CompiledCircuit, tree: DecisionNode, fault: Fault): { leaf: number; probes: number } {
  let t = tree;
  let probes = 0;
  while (!('leaf' in t)) {
    const v = evaluateRow(c, t.m.row, fault)[t.m.net];
    t = v ? t.one : t.zero;
    probes++;
  }
  return { leaf: t.leaf, probes };
}
