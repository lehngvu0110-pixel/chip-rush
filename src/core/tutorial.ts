// Hướng dẫn lần đầu (không trừ sao). Logic thuần để test được; scene chỉ vẽ + hiện chữ.
// - THIẾT KẾ: dãy bước còn thiếu so với lời giải AI, theo đúng thứ tự Gợi ý (đi từ công tắc tới đèn).
// - KIỂM THỬ: "huấn luyện viên" chọn phép đo tiếp theo tối ưu (minimax) trên các lớp lỗi còn khớp với
//   những gì người chơi đã đo — giống AI kỹ sư, nhưng cập nhật theo đúng lượt đo thật của người chơi.
import { solveDebug, type Measurement } from '../ai/debug-solver';
import { Grid, type GridState } from './circuit/grid';
import { evaluateRow } from './circuit/simulate';
import type { Fault } from './circuit/types';
import { nextHint, type Hint } from './level/hint';
import type { DebugSetup } from './level/debug-setup';

/** Áp một bước gợi ý lên lưới (dùng để "chạy thử" lời giải theo thứ tự). Trả false nếu không áp được. */
export function applyHint(g: Grid, h: Hint): boolean {
  if (h.kind === 'wire') return g.addWire(h.layer, h.a, h.b);
  if (h.kind === 'via') return !g.hasVia(h.cell) && g.toggleVia(h.cell);
  if (g.gateAt(h.cell)) g.removeGate(h.cell);
  return g.placeGate(h.cell, h.type, h.out) !== null;
}

/**
 * Các bước còn thiếu để lưới người chơi chứa lời giải AI, theo thứ tự Gợi ý.
 * Không sửa lưới gốc. Dừng sớm nếu một bước không áp được (tránh lặp vô hạn).
 */
export function designGuide(player: Grid, solution: GridState, max = 400): Hint[] {
  const g = player.clone();
  const out: Hint[] = [];
  for (let i = 0; i < max; i++) {
    const h = nextHint(g, solution);
    if (!h || !applyHint(g, h)) break;
    out.push(h);
  }
  return out;
}

/** Chuỗi điểm liên tục đầu tiên của các đoạn dây (để vẽ "ngón tay" chạy theo). */
export function guidePolyline(steps: readonly Hint[]): number[] {
  const pts: number[] = [];
  for (const s of steps) {
    if (s.kind !== 'wire') break;
    if (pts.length === 0) pts.push(s.a, s.b);
    else if (pts[pts.length - 1] === s.a) pts.push(s.b);
    else if (pts[pts.length - 1] === s.b) pts.push(s.a);
    else break;
  }
  return pts;
}

export interface ProbeRecord {
  net: number;
  row: number;
  value: number;
}

/** Chỉ số các lớp lỗi còn khớp với mọi lần đo (so bằng lỗi đại diện của lớp). */
export function consistentClasses(setup: DebugSetup, probes: readonly ProbeRecord[]): number[] {
  const { circuit, classes } = setup.group;
  const keep: number[] = [];
  classes.forEach((cl, k) => {
    const rep = cl[0];
    if (!rep) return;
    if (probes.every((p) => evaluateRow(circuit, p.row, rep)[p.net] === p.value)) keep.push(k);
  });
  return keep;
}

export interface CoachStep {
  /** số lớp lỗi còn nghi ngờ */
  remaining: number;
  /** phép đo nên làm tiếp (null = đã đủ thông tin để báo lỗi) */
  next: Measurement | null;
  /** lỗi đại diện khi chỉ còn 1 lớp (để kiểm tra; UI KHÔNG nói thẳng đáp án) */
  answer: Fault | null;
}

export function debugCoach(setup: DebugSetup, probes: readonly ProbeRecord[]): CoachStep {
  const ks = consistentClasses(setup, probes);
  const sub = ks.map((k) => setup.group.classes[k] as Fault[]);
  if (sub.length <= 1) return { remaining: sub.length, next: null, answer: sub[0]?.[0] ?? null };
  const sol = solveDebug(setup.group.circuit, sub, setup.probeNets);
  const next = 'm' in sol.tree ? sol.tree.m : null;
  return { remaining: sub.length, next, answer: null };
}

/** Giá trị của một dây trong mạch CHUẨN (không lỗi) ở một hàng đầu vào. */
export function goldenValue(setup: DebugSetup, net: number, row: number): number {
  return evaluateRow(setup.group.circuit, row)[net] ?? 0;
}

/** Một bước AI kỹ sư đo (phát lại sau khi xong màn). */
export interface AiStep {
  net: number;
  row: number;
  value: number;
  /** giá trị ở mạch chuẩn (không lỗi) */
  gold: number;
  cell: number;
  /** số khả năng còn lại SAU lần đo này */
  remaining: number;
}

/**
 * Các phép đo AI kỹ sư làm với lỗi thật của màn: mỗi bước chạy lại minimax trên các lớp lỗi còn khớp
 * (giống huấn luyện viên t01), dừng khi còn 1 khả năng. Số bước ≤ par (tests/ai-info.test.ts).
 */
export function aiProbeSteps(setup: DebugSetup): AiStep[] {
  const steps: AiStep[] = [];
  const probes: ProbeRecord[] = [];
  for (let k = 0; k < 16; k++) {
    const c = debugCoach(setup, probes);
    if (!c.next) break;
    const { net, row } = c.next;
    const value = evaluateRow(setup.group.circuit, row, setup.fault)[net] ?? 0;
    probes.push({ net, row, value });
    let cell = -1;
    for (const [key, n] of setup.probeCells) {
      if (n === net) {
        cell = Number(key.split(':')[1]);
        break;
      }
    }
    steps.push({ net, row, value, gold: goldenValue(setup, net, row), cell, remaining: consistentClasses(setup, probes).length });
  }
  return steps;
}
