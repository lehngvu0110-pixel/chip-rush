// Chấm điểm THIẾT KẾ (SPEC mục 2): PPA, chi phí C, sao, điểm chia sẻ.
import type { Grid } from '../circuit/grid';
import { areaOf } from '../circuit/netlist';
import { logicDepth, toggleCount, type CompiledCircuit } from '../circuit/simulate';

export const W_D = 3;
export const W_P = 1;

export interface PPA {
  A: number;
  D: number;
  P: number;
  C: number;
}

export function costOf(A: number, D: number, P: number): number {
  return A + W_D * D + W_P * P;
}

export function ppaOf(grid: Grid, circuit: CompiledCircuit): PPA {
  const A = areaOf(grid);
  const D = logicDepth(circuit);
  const P = toggleCount(circuit);
  return { A, D, P, C: costOf(A, D, P) };
}

/** Mỗi chỉ số A, D, P không tệ hơn par được 1 sao (0–3). Dùng Gợi ý thì tối đa 2 sao. */
export function starsFor(ppa: PPA, par: PPA, hinted = false): number {
  const s = (ppa.A <= par.A ? 1 : 0) + (ppa.D <= par.D ? 1 : 0) + (ppa.P <= par.P ? 1 : 0);
  return hinted ? Math.min(2, s) : s;
}

/** Điểm chia sẻ = round(1000 × C_par / C_người_chơi); 1000 = ngang AI kỹ sư, cao hơn = giỏi hơn. */
export function shareScore(ppa: PPA, par: PPA): number {
  return ppa.C > 0 ? Math.round((1000 * par.C) / ppa.C) : 0;
}
