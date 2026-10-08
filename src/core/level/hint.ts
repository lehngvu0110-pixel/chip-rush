// Gợi ý THIẾT KẾ (SPEC mục 2): chỉ ra MỘT bước tiếp theo của lời giải AI kỹ sư mà lưới của người chơi chưa có.
// Thứ tự: cổng trước (đặt đúng ô, đúng hướng), rồi dây/via theo thứ tự lan ra từ công tắc trong lời giải
// — giống cách người ta tự vẽ: đi từ nguồn tín hiệu tới đích.
import { Grid, opposite, type GridState, type Side } from '../circuit/grid';
import type { GateType } from '../circuit/types';

export type Hint =
  | { kind: 'gate'; cell: number; type: GateType; out: Side; replace: boolean }
  | { kind: 'wire'; layer: number; a: number; b: number }
  | { kind: 'via'; cell: number };

export function nextHint(player: Grid, solution: GridState): Hint | null {
  // 1) cổng: thiếu, sai loại hoặc sai hướng
  for (const g of solution.gates) {
    const have = player.gateAt(g.cell);
    if (!have || have.type !== g.type || have.out !== g.out) return { kind: 'gate', cell: g.cell, type: g.type, out: g.out, replace: !!have };
  }
  // 2) dây + via theo BFS từ các công tắc trong lời giải
  const sol = new Grid(player.spec);
  sol.load(solution);
  const N = sol.size;
  const node = (layer: number, cell: number): number => layer * N + cell;
  const seen = new Set<number>();
  const queue: number[] = [];
  for (const c of sol.inputCells) {
    seen.add(node(0, c));
    queue.push(node(0, c));
  }
  // chân ra của cổng cũng là nguồn
  for (const g of sol.gates()) {
    const port = sol.neighbor(g.cell, g.out);
    if (port >= 0 && sol.hasWire(0, g.cell, port)) {
      if (!player.hasWire(0, g.cell, port)) return { kind: 'wire', layer: 0, a: g.cell, b: port };
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const u = queue[i] as number;
    const layer = Math.floor(u / N);
    const c = u % N;
    // không lan xuyên qua cổng (cổng là điểm cuối của dây vào)
    if (layer === 0 && sol.gateAt(c) && !sol.inputCells.includes(c)) continue;
    for (const s of sol.wireSides(layer, c)) {
      const m = sol.neighbor(c, s);
      if (!player.hasWire(layer, c, m)) return { kind: 'wire', layer, a: c, b: m };
      const v = node(layer, m);
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
      }
    }
    if (sol.hasVia(c)) {
      if (!player.hasVia(c)) return { kind: 'via', cell: c };
      const v = node(1 - layer, c);
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
      }
    }
    // khi tới chân vào của cổng, tiếp tục từ chân ra của cổng đó
    for (const s of sol.wireSides(layer, c)) {
      const m = sol.neighbor(c, s);
      const gt = layer === 0 ? sol.gateAt(m) : undefined;
      if (gt && opposite(s) !== gt.out) {
        const port = sol.neighbor(m, gt.out);
        const v = node(0, port);
        if (port >= 0 && !seen.has(v) && sol.hasWire(0, m, port)) {
          seen.add(v);
          queue.push(v);
        }
      }
    }
  }
  // phần còn lại (nếu lời giải có đoạn không nối từ công tắc)
  for (const w of sol.wires()) if (!player.hasWire(w.layer, w.a, w.b)) return { kind: 'wire', layer: w.layer, a: w.a, b: w.b };
  for (const v of sol.vias()) if (!player.hasVia(v)) return { kind: 'via', cell: v };
  return null;
}
