// Dựng lưới từ màn, chấm bài người chơi, và kiểm tra dữ liệu màn (dùng trong test + tools).
import { Grid, type GridState } from '../circuit/grid';
import { diagnose, type Problem } from '../circuit/netlist';
import { compareTruthTable, inputBit, truthTable, type TruthComparison } from '../circuit/simulate';
import type { Bit, GateType, TruthRow } from '../circuit/types';
import { ppaOf, shareScore, starsFor, type PPA } from '../scoring/design';
import type { DesignLevel, LevelSolution } from './types';

/** Bảng chân trị mong muốn dạng TruthRow (cùng thứ tự với truthTable()). */
export function expectedRows(level: DesignLevel): TruthRow[] {
  const n = level.grid.inputs.length;
  const rows: TruthRow[] = [];
  for (let r = 0; r < 1 << n; r++) {
    const inputs: Bit[] = [];
    for (let i = 0; i < n; i++) inputs.push(inputBit(r, i, n));
    const outputs = level.grid.outputs.map((o) => (level.table[o.id]?.[r] === '1' ? 1 : 0) as Bit);
    rows.push({ inputs, outputs });
  }
  return rows;
}

export function applySolution(grid: Grid, sol: LevelSolution): void {
  for (const [c, r, type, out] of sol.gates ?? []) grid.placeGate(grid.cellAt(c, r), type, out ?? 0);
  for (const [c, r] of sol.vias ?? []) grid.toggleVia(grid.cellAt(c, r));
  for (const [layer, pts] of sol.wires ?? []) grid.drawPath(layer, pts.map(([c, r]) => grid.cellAt(c, r)));
}

export function gridFor(level: DesignLevel, state?: GridState): Grid {
  const g = new Grid(level.grid);
  if (state) g.load(state);
  return g;
}

/** Số cổng mỗi loại đang dùng trên lưới. */
export function gateUsage(grid: Grid): Partial<Record<GateType, number>> {
  const u: Partial<Record<GateType, number>> = {};
  for (const g of grid.gates()) u[g.type] = (u[g.type] ?? 0) + 1;
  return u;
}

export type Evaluation =
  | { status: 'invalid'; problems: Problem[] }
  | { status: 'wrong'; comparison: TruthComparison; actual: TruthRow[] }
  | { status: 'pass'; ppa: PPA; par: PPA; stars: number; score: number; actual: TruthRow[] };

const parCache = new Map<string, PPA>();

/** Par = PPA của lời giải tham chiếu (ném lỗi nếu lời giải sai — lỗi dữ liệu màn, test bắt được). */
export function levelPar(level: DesignLevel): PPA {
  const hit = parCache.get(level.id);
  if (hit) return hit;
  const g = gridFor(level);
  applySolution(g, level.solution);
  const d = diagnose(g);
  if (!d.ok) throw new Error(`Lời giải tham chiếu màn ${level.id} không hợp lệ: ${d.problems.map((p) => p.message).join('; ')}`);
  const cmp = compareTruthTable(truthTable(d.circuit), expectedRows(level));
  if (!cmp.pass) throw new Error(`Lời giải tham chiếu màn ${level.id} sai bảng chân trị`);
  const par = ppaOf(g, d.circuit);
  parCache.set(level.id, par);
  return par;
}

/** Chấm bài: mạch hợp lệ chưa → đúng bảng chân trị chưa → PPA, sao, điểm. */
export function evaluateDesign(level: DesignLevel, grid: Grid, hinted = false): Evaluation {
  // vượt số cổng cho phép (UI đã chặn, nhưng dữ liệu lưu có thể bị sửa tay)
  const over = Object.entries(gateUsage(grid)).filter(([t, n]) => (n ?? 0) > (level.gatesAllowed[t as GateType] ?? 0));
  if (over.length > 0) {
    return {
      status: 'invalid',
      problems: over.map(([t]) => ({
        kind: 'other' as const,
        message: `Màn này chỉ cho dùng ${level.gatesAllowed[t as GateType] ?? 0} cổng ${t}.`,
        nodes: grid.gates().filter((g) => g.type === t).map((g) => ({ layer: 0, cell: g.cell })),
      })),
    };
  }
  const d = diagnose(grid);
  if (!d.ok) return { status: 'invalid', problems: d.problems };
  const actual = truthTable(d.circuit);
  const comparison = compareTruthTable(actual, expectedRows(level));
  if (!comparison.pass) return { status: 'wrong', comparison, actual };
  const ppa = ppaOf(grid, d.circuit);
  const par = levelPar(level);
  return { status: 'pass', ppa, par, stars: starsFor(ppa, par, hinted), score: shareScore(ppa, par), actual };
}

/** Kiểm tra dữ liệu một màn. Trả về danh sách lỗi (rỗng = hợp lệ). */
export function validateLevel(level: DesignLevel): string[] {
  const errs: string[] = [];
  const rows = 1 << level.grid.inputs.length;
  const outIds = level.grid.outputs.map((o) => o.id);
  for (const id of outIds) {
    const t = level.table[id];
    if (t === undefined) errs.push(`thiếu bảng chân trị cho đèn ${id}`);
    else if (t.length !== rows || /[^01]/.test(t)) errs.push(`bảng chân trị của ${id} phải gồm đúng ${rows} ký tự 0/1`);
  }
  for (const id of Object.keys(level.table)) if (!outIds.includes(id)) errs.push(`bảng chân trị có đèn lạ ${id}`);
  if (level.grid.cols > 8 || level.grid.rows > 10) errs.push('lưới vượt 8 × 10 (ô sẽ nhỏ hơn 44 px trên màn 360 px)');
  try {
    const g = gridFor(level);
    applySolution(g, level.solution);
    const usage = gateUsage(g);
    for (const [t, n] of Object.entries(usage)) if ((n ?? 0) > (level.gatesAllowed[t as GateType] ?? 0)) errs.push(`lời giải dùng quá số cổng ${t}`);
    levelPar(level);
  } catch (e) {
    errs.push((e as Error).message);
  }
  return errs;
}
