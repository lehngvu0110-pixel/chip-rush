// Dựng màn KIỂM THỬ từ dữ liệu: lưới (bố trí của AI), lỗi thật đổi sang tên trên lưới, các lớp lỗi nghi ngờ.
import { Grid, type GridState } from '../circuit/grid';
import { gridToNetlist } from '../circuit/netlist';
import { compileOrThrow } from '../circuit/simulate';
import type { Fault, Netlist } from '../circuit/types';
import { faultGroup, sameClass, type FaultGroup } from '../debug/faults';
import solvedJson from './debug-solutions.json';
import type { DebugLevel, SolvedDebugLevel } from './types';

const SOLVED = solvedJson as unknown as Record<string, SolvedDebugLevel>;

export function solvedDebug(id: string): SolvedDebugLevel | undefined {
  return SOLVED[id];
}

/**
 * Đổi lỗi viết theo tên của `logic` sang tên của netlist sinh từ lưới.
 * Bố trí của solver giữ thứ tự cổng: state.gates[k] ↔ logic.gates[k].
 */
export function mapFault(level: DebugLevel, grid: Grid, state: GridState, gridNet: Netlist): Fault {
  const f = level.fault;
  const gateIdAt = (k: number): string => {
    const g = state.gates[k];
    if (!g) throw new Error(`${level.id}: thiếu cổng ${k} trong bố trí`);
    const [c, r] = grid.colRow(g.cell);
    return `g${c}_${r}`;
  };
  if (f.kind === 'gate-invert') {
    const k = level.logic.gates.findIndex((g) => g.id === f.gate);
    if (k < 0) throw new Error(`${level.id}: không có cổng ${f.gate}`);
    return { kind: 'gate-invert', gate: gateIdAt(k) };
  }
  const i = level.logic.inputs.indexOf(f.net);
  if (i >= 0) return { kind: 'stuck-at', net: gridNet.inputs[i] as string, value: f.value };
  const k = level.logic.gates.findIndex((g) => g.output === f.net);
  if (k < 0) throw new Error(`${level.id}: không có net ${f.net}`);
  const id = gateIdAt(k);
  const out = gridNet.gates.find((g) => g.id === id)?.output;
  if (!out) throw new Error(`${level.id}: cổng ${id} không có chân ra`);
  return { kind: 'stuck-at', net: out, value: f.value };
}

export interface DebugSetup {
  grid: Grid;
  netlist: Netlist;
  /** chỉ số net (trong group.circuit) người chơi đo được: có ít nhất 1 ô dây thật, không phải đèn */
  probeNets: number[];
  /** "lớp:ô" → chỉ số net, cho các ô dây đo được */
  probeCells: Map<string, number>;
  /** dây quan sát được (đo được + đèn) — định nghĩa lớp tương đương */
  obs: number[];
  fault: Fault;
  group: FaultGroup;
  par: number;
  optimal: boolean;
}

export function debugSetup(level: DebugLevel, state?: GridState): DebugSetup {
  const st = state ?? SOLVED[level.id]?.state;
  if (!st) throw new Error(`Màn ${level.id} chưa có bố trí (chạy npx tsx tools/solve-levels.ts)`);
  const grid = new Grid(level.grid);
  grid.load(st);
  const gn = gridToNetlist(grid);
  const netlist = gn.netlist;
  const fault = mapFault(level, grid, st, netlist);
  const c = compileOrThrow(netlist);
  const outs = new Set(c.outputIdx);
  const probeCells = new Map<string, number>();
  for (const [name, nodes] of gn.netCells) {
    const i = c.netIndex.get(name);
    if (i === undefined || outs.has(i)) continue;
    for (const n of nodes) {
      if (grid.pins.has(n.cell) || (n.layer === 0 && grid.gateAt(n.cell))) continue;
      probeCells.set(`${n.layer}:${n.cell}`, i);
    }
  }
  const probeNets = [...new Set(probeCells.values())].sort((a, b) => a - b);
  // quan sát được = dây đo được + đèn (thấy miễn phí); lỗi khác nhau chỉ ở dây không đo được thì gộp chung lớp
  const obs = [...probeNets, ...c.outputIdx];
  const group = faultGroup(netlist, level.model, fault, obs);
  const s = SOLVED[level.id];
  return { grid, netlist, probeNets, probeCells, obs, fault, group, par: s?.par ?? NaN, optimal: s?.optimal ?? false };
}

/** Câu trả lời của người chơi có đúng không (cùng lớp tương đương với lỗi thật). */
export function isCorrectAnswer(setup: DebugSetup, answer: Fault): boolean {
  try {
    return sameClass(setup.group.circuit, answer, setup.fault, setup.obs);
  } catch {
    return false; // lỗi trỏ tới cổng/net không tồn tại
  }
}

/** Giới hạn số lần đo trước khi thua: 2 × par (SPEC 3), tối thiểu 3 để màn par 0 không quá khắt khe. */
export const probeLimit = (par: number): number => Math.max(2 * par, 3);

/** Sao: đo ≤ par → 3; ≤ par + 2 → 2; còn lại 1 (SPEC 3). */
export const debugStars = (probes: number, par: number): number => (probes <= par ? 3 : probes <= par + 2 ? 2 : 1);
