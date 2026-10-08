// "AI kỹ sư" của chế độ THIẾT KẾ (SPEC mục 5.1) — AI cổ điển (tìm kiếm), không phải LLM.
//
// Bài toán: cho mạch logic (netlist cố định: loại cổng + cách nối) và lưới của màn, tìm cách
//   (1) đặt mỗi cổng vào 1 ô + chọn hướng chân ra, và
//   (2) đi dây mọi net trên lưới 2 lớp (không chập, không cắt nhau cùng lớp)
// sao cho Area nhỏ nhất. Delay và Power chỉ phụ thuộc mạch logic (không phụ thuộc vị trí),
// nên với mạch logic cho trước, tối ưu chi phí C = A + 3D + P chính là tối ưu Area.
//
// Thuật toán:
// - Đặt cổng: duyệt HẾT mọi cách đặt nếu số tổ hợp nhỏ; nếu lớn thì beam search theo tổng HPWL.
// - Branch-and-bound: mỗi cách đặt có CẬN DƯỚI của Area (mục lowerBound); cận ≥ kết quả tốt nhất → bỏ.
// - Đi dây từng net: cây Steiner xấp xỉ — nối lần lượt từng chân đọc vào cây bằng Dijkstra
//   đa nguồn (chi phí = số ô mới chiếm + số via), thử nhiều thứ tự net.
// - Tối ưu "chứng minh được": khi duyệt hết cách đặt và Area tìm được = cận dưới nhỏ nhất
//   trên mọi cách đặt, thì không cách nào tốt hơn → `proven: true`. Ngược lại chỉ là "tốt nhất tìm được".
import { Grid, opposite, SIDES, type GridSpec, type GridState, type Side } from '../core/circuit/grid';
import type { GateType, Netlist } from '../core/circuit/types';

export interface SolveOptions {
  /** dừng sau thời gian này (ms); kết quả khi đó chắc chắn không "proven" */
  timeLimitMs?: number;
  /** số cách đặt tối đa được duyệt hết; vượt ngưỡng thì chuyển sang beam search */
  exhaustiveLimit?: number;
  beamWidth?: number;
  /** số thứ tự net thử cho mỗi cách đặt tốt */
  orders?: number;
  /** beam search: số cách đặt tốt nhất được đi dây kỹ (nhiều thứ tự + thương lượng tắc nghẽn) */
  deepCount?: number;
  /** cấm nối thẳng chân ra cổng này vào cổng kia (KIỂM THỬ cần mọi net có dây để đo) */
  noDirect?: boolean;
  seed?: number;
}

export interface SolveResult {
  state: GridState;
  area: number;
  /** cận dưới Area trên mọi cách đặt đã xét (chỉ có nghĩa khi exhaustive) */
  lowerBound: number;
  /** true = đã chứng minh không có cách đặt + đi dây nào có Area nhỏ hơn (với mạch logic này) */
  proven: boolean;
  exhaustive: boolean;
  placementsTried: number;
  routings: number;
  ms: number;
}

interface Reader {
  kind: 'pin' | 'gate';
  /** pin: ô chân đèn; gate: chỉ số cổng */
  ref: number;
}
interface Net {
  name: string;
  driver: { kind: 'pin'; cell: number } | { kind: 'gate'; gate: number };
  readers: Reader[];
}

interface Placement {
  cell: number[];
  out: Side[];
}

/** RNG nhỏ có seed để kết quả tái lập được. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class DesignSolver {
  readonly grid: Grid;
  readonly nets: Net[];
  readonly gates: { type: GateType; inputs: string[] }[];
  private readonly N: number;
  private readonly L: number;
  routings = 0;

  constructor(
    readonly spec: GridSpec,
    readonly logic: Netlist,
  ) {
    this.grid = new Grid(spec);
    this.N = this.grid.size;
    this.L = spec.layers;
    if (logic.inputs.length !== spec.inputs.length || logic.outputs.length !== spec.outputs.length) {
      throw new Error('Số đầu vào/đầu ra của mạch logic không khớp với lưới');
    }
    this.gates = logic.gates.map((g) => ({ type: g.type, inputs: [...g.inputs] }));
    const byName = new Map<string, Net>();
    const net = (name: string): Net => {
      let n = byName.get(name);
      if (!n) {
        n = { name, driver: { kind: 'pin', cell: -1 }, readers: [] };
        byName.set(name, n);
      }
      return n;
    };
    logic.inputs.forEach((name, i) => (net(name).driver = { kind: 'pin', cell: this.grid.inputCells[i] as number }));
    logic.gates.forEach((g, k) => (net(g.output).driver = { kind: 'gate', gate: k }));
    logic.gates.forEach((g, k) => g.inputs.forEach((name) => net(name).readers.push({ kind: 'gate', ref: k })));
    logic.outputs.forEach((name, j) => net(name).readers.push({ kind: 'pin', ref: this.grid.outputCells[j] as number }));
    for (const n of byName.values()) {
      if (n.driver.kind === 'pin' && n.driver.cell < 0) throw new Error(`Net ${n.name} không có nguồn`);
    }
    // net không ai đọc (chân ra cổng bỏ trống) thì không cần đi dây
    this.nets = [...byName.values()].filter((n) => n.readers.length > 0);
  }

  // ---------------- cận dưới ----------------
  private xy(cell: number): [number, number] {
    return this.grid.colRow(cell);
  }

  /** Số ô ít nhất để nối 2 ô a, b khi KHÔNG có net nào khác (BFS, có tính vật cản và via). */
  private pathCells(a: number, b: number, place: Placement): number {
    // BFS theo số ô (mỗi bước sang ô kề +1; đổi lớp tại ô thường +1 vì via tính vào Area)
    const N = this.N;
    const gateCells = new Set(place.cell);
    const dist = new Int32Array(this.L * N).fill(-1);
    const dq: number[] = [a];
    dist[a] = 0;
    const passable = (layer: number, c: number): boolean => {
      if (this.grid.blocked.has(c)) return false;
      if (c === a || c === b) return layer === 0 || !gateCells.has(c);
      if (layer === 0 && (gateCells.has(c) || this.grid.pins.has(c))) return false;
      return true;
    };
    // 0-1 BFS không cần: mọi bước đều +1 → BFS thường
    for (let qi = 0; qi < dq.length; qi++) {
      const node = dq[qi] as number;
      const layer = Math.floor(node / N);
      const c = node % N;
      if (c === b && layer === 0) return dist[node] as number;
      const d = dist[node] as number;
      for (const s of SIDES) {
        const m = this.grid.neighbor(c, s);
        if (m < 0 || !passable(layer, m)) continue;
        const nn = layer * N + m;
        if (dist[nn] !== -1) continue;
        dist[nn] = d + 1;
        dq.push(nn);
      }
      if (this.L === 2 && !this.grid.pins.has(c) && !gateCells.has(c) && !this.grid.blocked.has(c)) {
        const nn = (1 - layer) * N + c;
        if (dist[nn] === -1) {
          dist[nn] = d + 1;
          dq.push(nn);
        }
      }
    }
    return Infinity;
  }

  /** Các điểm đại diện cho chân của net (để tính cận dưới). */
  private netPoints(net: Net, place: Placement): { pts: number[]; free: number } | null {
    const pts: number[] = [];
    let free = 0; // số điểm KHÔNG tính vào Area (ô chân, ô cổng)
    if (net.driver.kind === 'pin') {
      pts.push(net.driver.cell);
      free++;
    } else {
      const g = net.driver.gate;
      const port = this.grid.neighbor(place.cell[g] as number, place.out[g] as Side);
      if (port < 0) return null;
      pts.push(port);
      if (this.grid.pins.has(port) || place.cell.includes(port)) free++;
    }
    for (const r of net.readers) {
      pts.push(r.kind === 'pin' ? r.ref : (place.cell[r.ref] as number));
      free++;
    }
    return { pts, free };
  }

  /**
   * Cận dưới Area của một cách đặt: số cổng + Σ cận dưới từng net.
   * - Net 2 chân: số ô trên đường ngắn nhất (BFS có vật cản) — đúng tối ưu nếu net đứng một mình.
   * - Net nhiều chân: cây Steiner chữ nhật có độ dài ≥ HPWL (nửa chu vi hình bao) → số nút ≥ HPWL + 1.
   * Trừ đi các nút không tính Area (ô chân, ô cổng). Net khác chỉ làm đường dài thêm nên đây là cận dưới hợp lệ.
   */
  lowerBound(place: Placement): number {
    let lb = this.gates.length;
    for (const net of this.nets) {
      const np = this.netPoints(net, place);
      if (!np) return Infinity;
      const uniq = [...new Set(np.pts)];
      if (uniq.length <= 1) continue;
      let nodes: number;
      if (uniq.length === 2) {
        const d = this.pathCells(uniq[0] as number, uniq[1] as number, place);
        if (!Number.isFinite(d)) return Infinity;
        nodes = d + 1;
      } else {
        const xs = uniq.map((c) => this.xy(c)[0]);
        const ys = uniq.map((c) => this.xy(c)[1]);
        nodes = Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys) + 1;
      }
      const freeUniq = Math.min(np.free, uniq.length);
      lb += Math.max(0, nodes - freeUniq);
    }
    return lb;
  }

  // ---------------- đi dây ----------------
  /**
   * Đi dây mọi net theo thứ tự `order`. Trả về Area và trạng thái lưới, hoặc null nếu không đi được.
   * `cutoff`: dừng sớm khi Area đã ≥ cutoff (branch-and-bound).
   */
  route(place: Placement, order: number[], cutoff = Infinity): { area: number; state: GridState } | null {
    this.routings++;
    const N = this.N;
    const g = this.grid;
    const owner = new Int16Array(this.L * N).fill(-1); // -1 trống, -2 cấm, k = net k
    const gateAt = new Map<number, number>();
    place.cell.forEach((c, k) => gateAt.set(c, k));
    for (let c = 0; c < N; c++) {
      if (g.blocked.has(c)) for (let l = 0; l < this.L; l++) owner[l * N + c] = -2;
      if (gateAt.has(c)) owner[c] = -2;
    }
    // ô chân thuộc net của chân đó
    const netIndex = new Map(this.nets.map((n, i) => [n.name, i]));
    this.logic.inputs.forEach((name, i) => {
      const c = g.inputCells[i] as number;
      owner[c] = netIndex.get(name) ?? -2; // chân vào không ai dùng: cấm đi qua
    });
    this.logic.outputs.forEach((name, j) => {
      const c = g.outputCells[j] as number;
      owner[c] = netIndex.get(name) ?? -2;
    });
    const usedSide: Set<Side>[] = place.cell.map(() => new Set<Side>());
    place.out.forEach((o, k) => usedSide[k]?.add(o));
    const wires: [number, number, number][] = [];
    const vias = new Set<number>();
    let area = this.gates.length;
    const addWire = (layer: number, a: number, b: number): void => {
      wires.push([layer, Math.min(a, b), Math.max(a, b)]);
    };
    const claim = (node: number, k: number): void => {
      if (owner[node] === -1) {
        owner[node] = k;
        const c = node % N;
        if (!g.pins.has(c)) area++;
      }
    };
    const viaOk = (c: number): boolean => this.L === 2 && !g.pins.has(c) && !gateAt.has(c) && !g.blocked.has(c);

    for (const k of order) {
      const net = this.nets[k] as Net;
      const tree = new Set<number>();
      // --- nguồn ---
      let readers = [...net.readers];
      if (net.driver.kind === 'pin') {
        tree.add(net.driver.cell);
      } else {
        const gi = net.driver.gate;
        const gc = place.cell[gi] as number;
        const port = g.neighbor(gc, place.out[gi] as Side);
        if (port < 0) return null;
        const h = gateAt.get(port);
        if (h !== undefined) {
          // cổng nối thẳng vào cổng: chỉ được khi net có đúng 1 chân đọc là cổng h, phía đó là chân vào của h
          const side = opposite(place.out[gi] as Side);
          const only = !this.noDirect && readers.length === 1 && readers[0]?.kind === 'gate' && readers[0].ref === h;
          if (!only || usedSide[h]?.has(side)) return null;
          usedSide[h]?.add(side);
          addWire(0, gc, port);
          continue;
        }
        if (owner[port] !== -1 && owner[port] !== k) return null;
        claim(port, k);
        tree.add(port);
        addWire(0, gc, port);
      }
      // nối chân đọc gần trước
      const [sx, sy] = this.xy([...tree][0] as number);
      const pos = (r: Reader): number => (r.kind === 'pin' ? r.ref : (place.cell[r.ref] as number));
      readers = readers.sort((a, b) => {
        const [ax, ay] = this.xy(pos(a));
        const [bx, by] = this.xy(pos(b));
        return Math.abs(ax - sx) + Math.abs(ay - sy) - (Math.abs(bx - sx) + Math.abs(by - sy));
      });
      for (const r of readers) {
        // đích: ô chân đèn, hoặc ô kề cổng ở một phía chân vào còn trống
        const targets = new Map<number, Side | -1>(); // nút lớp 0 → phía vào cổng
        if (r.kind === 'pin') targets.set(r.ref, -1);
        else {
          const h = r.ref;
          const hc = place.cell[h] as number;
          for (const s of SIDES) {
            if (usedSide[h]?.has(s)) continue;
            const m = g.neighbor(hc, s);
            if (m < 0 || gateAt.has(m)) continue;
            if (owner[m] !== -1 && owner[m] !== k) continue;
            targets.set(m, s);
          }
          if (targets.size === 0) return null;
        }
        // Dijkstra đa nguồn từ cây (chi phí 0–2 mỗi bước → hàng đợi theo bucket)
        const size = this.L * N;
        const dist = new Float64Array(size).fill(Infinity);
        const prev = new Int32Array(size).fill(-1);
        const buckets: number[][] = [[]];
        for (const t of tree) {
          dist[t] = 0;
          buckets[0]?.push(t);
        }
        const passable = (node: number): boolean => owner[node] === -1 || owner[node] === k;
        const stepCost = (node: number): number => (owner[node] === k || tree.has(node) || g.pins.has(node % N) ? 0 : 1);
        let found = -1;
        for (let d = 0; d < buckets.length && found < 0; d++) {
          const q = buckets[d] ?? [];
          for (let qi = 0; qi < q.length; qi++) {
            const node = q[qi] as number;
            if ((dist[node] as number) < d) continue;
            if (node < N && targets.has(node)) {
              found = node;
              break;
            }
            const layer = Math.floor(node / N);
            const c = node % N;
            const push = (nn: number, nd: number): void => {
              if (nd < (dist[nn] as number)) {
                dist[nn] = nd;
                prev[nn] = node;
                (buckets[nd] ??= []).push(nn);
              }
            };
            // ô chân/đèn của net khác hoặc của chính net (không phải đích) không đi xuyên qua ở lớp 1
            if (layer === 0 && g.pins.has(c) && !targets.has(c) && !tree.has(c)) continue;
            for (const s of SIDES) {
              const m = g.neighbor(c, s);
              if (m < 0) continue;
              const nn = layer * N + m;
              if (!passable(nn)) continue;
              push(nn, d + stepCost(nn));
            }
            if (viaOk(c)) {
              const nn = (1 - layer) * N + c;
              if (passable(nn)) push(nn, d + 1 + stepCost(nn) + (vias.has(c) ? -1 : 0));
            }
          }
        }
        if (found < 0) return null;
        // dựng lại đường, chiếm ô, thêm dây/via
        let cur = found;
        while (!tree.has(cur)) {
          const p = prev[cur] as number;
          claim(cur, k);
          tree.add(cur);
          if (p < 0) break;
          const lc = Math.floor(cur / N);
          const lp = Math.floor(p / N);
          if (lc === lp) addWire(lc, cur % N, p % N);
          else if (!vias.has(cur % N)) {
            vias.add(cur % N);
            area++;
          }
          cur = p;
        }
        if (r.kind === 'gate') {
          const s = targets.get(found) as Side;
          usedSide[r.ref]?.add(s);
          addWire(0, found, place.cell[r.ref] as number);
        }
        if (area >= cutoff) return null;
      }
    }
    // khử trùng lặp dây
    const seen = new Set<string>();
    const uniqWires = wires.filter((w) => {
      const key = w.join(',');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return {
      area,
      state: {
        wires: uniqWires,
        vias: [...vias].sort((a, b) => a - b),
        gates: this.gates.map((gt, i) => ({ type: gt.type, cell: place.cell[i] as number, out: place.out[i] as Side })),
      },
    };
  }

  /**
   * Đi dây kiểu "thương lượng tắc nghẽn" (PathFinder — McMurchie & Ebeling, FPGA 1995):
   * cho phép các net tạm dùng chung ô nhưng phạt; sau mỗi vòng, ô bị tranh chấp bị tăng "giá lịch sử",
   * net nào cũng đi lại → dần dần tự nhường nhau tới khi không còn ô chung. Giải được những bố trí chật
   * mà cách đi dây tham lam từng net (route) bế tắc.
   */
  routeNegotiated(place: Placement, maxIter = 40): { area: number; state: GridState } | null {
    this.routings++;
    const N = this.N;
    const g = this.grid;
    const size = this.L * N;
    const gateAt = new Map<number, number>();
    place.cell.forEach((c, k) => gateAt.set(c, k));
    const hard = new Int16Array(size).fill(-1); // -2 cấm; k ≥ 0: chỉ net k được dùng (ô chân)
    for (let c = 0; c < N; c++) {
      if (g.blocked.has(c)) for (let l = 0; l < this.L; l++) hard[l * N + c] = -2;
      if (gateAt.has(c)) hard[c] = -2;
    }
    const netIndex = new Map(this.nets.map((n, i) => [n.name, i]));
    this.logic.inputs.forEach((name, i) => (hard[g.inputCells[i] as number] = netIndex.get(name) ?? -2));
    this.logic.outputs.forEach((name, j) => (hard[g.outputCells[j] as number] = netIndex.get(name) ?? -2));
    const viaOk = (c: number): boolean => this.L === 2 && !g.pins.has(c) && !gateAt.has(c) && !g.blocked.has(c);

    const occ = new Int16Array(size); // số net đang dùng nút
    const hist = new Float64Array(size);
    let pfac = 0.6;
    type Routed = { nodes: Set<number>; wires: [number, number, number][]; vias: Set<number>; sides: [number, Side][] };
    const routed: (Routed | null)[] = this.nets.map(() => null);
    // chân ra của cổng (cố định theo hướng đặt)
    const ports: number[] = [];
    for (const [gi, c] of place.cell.entries()) {
      const p = g.neighbor(c, place.out[gi] as Side);
      if (p < 0 || hard[p] === -2) {
        // chân ra chĩa vào cổng khác: chỉ hợp lệ nếu là nối thẳng (xử lý ở dưới); vào ô cấm thì bỏ
        if (p < 0 || !gateAt.has(p)) return null;
      }
      ports.push(p);
    }

    const routeNet = (k: number): Routed | null => {
      const net = this.nets[k] as Net;
      const nodes = new Set<number>();
      const wires: [number, number, number][] = [];
      const vias = new Set<number>();
      const sides: [number, Side][] = [];
      const usedBy = (h: number): Set<Side> => {
        const set = new Set<Side>([place.out[h] as Side]);
        for (const [j, r] of routed.entries()) if (j !== k && r) for (const [hh, sd] of r.sides) if (hh === h) set.add(sd);
        return set;
      };
      if (net.driver.kind === 'pin') nodes.add(net.driver.cell);
      else {
        const gi = net.driver.gate;
        const gc = place.cell[gi] as number;
        const port = ports[gi] as number;
        const h = gateAt.get(port);
        if (h !== undefined) {
          const side = opposite(place.out[gi] as Side);
          const only = !this.noDirect && net.readers.length === 1 && net.readers[0]?.kind === 'gate' && net.readers[0].ref === h;
          if (!only || usedBy(h).has(side)) return null;
          sides.push([h, side]);
          wires.push([0, Math.min(gc, port), Math.max(gc, port)]);
          return { nodes, wires, vias, sides };
        }
        if (hard[port] !== -1 && hard[port] !== k) return null;
        nodes.add(port);
        wires.push([0, Math.min(gc, port), Math.max(gc, port)]);
      }
      const pos = (r: Reader): number => (r.kind === 'pin' ? r.ref : (place.cell[r.ref] as number));
      const [sx, sy] = this.xy([...nodes][0] as number);
      const readers = [...net.readers].sort((a, b) => {
        const [ax, ay] = this.xy(pos(a));
        const [bx, by] = this.xy(pos(b));
        return Math.abs(ax - sx) + Math.abs(ay - sy) - (Math.abs(bx - sx) + Math.abs(by - sy));
      });
      const ok = (n: number): boolean => hard[n] === -1 || hard[n] === k;
      const cost = (n: number): number => {
        if (nodes.has(n) || g.pins.has(n % N)) return 0;
        return (1 + (hist[n] as number)) * (1 + pfac * (occ[n] as number));
      };
      for (const r of readers) {
        const targets = new Map<number, Side | -1>();
        if (r.kind === 'pin') targets.set(r.ref, -1);
        else {
          const h = r.ref;
          const hc = place.cell[h] as number;
          const taken = usedBy(h);
          for (const [hh, sd] of sides) if (hh === h) taken.add(sd);
          for (const sd of SIDES) {
            if (taken.has(sd)) continue;
            const m = g.neighbor(hc, sd);
            if (m < 0 || gateAt.has(m) || !ok(m)) continue;
            targets.set(m, sd);
          }
          if (targets.size === 0) return null;
        }
        // Dijkstra (heap nhị phân) đa nguồn từ cây hiện tại
        const dist = new Float64Array(size).fill(Infinity);
        const prev = new Int32Array(size).fill(-1);
        const heap: [number, number][] = [];
        const push = (d: number, n: number): void => {
          heap.push([d, n]);
          let i = heap.length - 1;
          while (i > 0) {
            const pi = (i - 1) >> 1;
            if ((heap[pi] as [number, number])[0] <= d) break;
            [heap[i], heap[pi]] = [heap[pi] as [number, number], heap[i] as [number, number]];
            i = pi;
          }
        };
        const pop = (): [number, number] | undefined => {
          const top = heap[0];
          const last = heap.pop();
          if (heap.length > 0 && last) {
            heap[0] = last;
            let i = 0;
            for (;;) {
              const l = 2 * i + 1;
              const rr = l + 1;
              let m = i;
              if (l < heap.length && (heap[l] as [number, number])[0] < (heap[m] as [number, number])[0]) m = l;
              if (rr < heap.length && (heap[rr] as [number, number])[0] < (heap[m] as [number, number])[0]) m = rr;
              if (m === i) break;
              [heap[i], heap[m]] = [heap[m] as [number, number], heap[i] as [number, number]];
              i = m;
            }
          }
          return top;
        };
        for (const t of nodes) {
          dist[t] = 0;
          push(0, t);
        }
        let found = -1;
        for (let it = pop(); it; it = pop()) {
          const [d, node] = it;
          if (d > (dist[node] as number)) continue;
          if (node < N && targets.has(node)) {
            found = node;
            break;
          }
          const layer = Math.floor(node / N);
          const c = node % N;
          if (layer === 0 && g.pins.has(c) && !targets.has(c) && !nodes.has(c)) continue;
          for (const sd of SIDES) {
            const m = g.neighbor(c, sd);
            if (m < 0) continue;
            const nn = layer * N + m;
            if (!ok(nn)) continue;
            const nd = d + cost(nn);
            if (nd < (dist[nn] as number)) {
              dist[nn] = nd;
              prev[nn] = node;
              push(nd, nn);
            }
          }
          if (viaOk(c)) {
            const nn = (1 - layer) * N + c;
            if (ok(nn)) {
              const nd = d + (vias.has(c) ? 0 : 1) + cost(nn);
              if (nd < (dist[nn] as number)) {
                dist[nn] = nd;
                prev[nn] = node;
                push(nd, nn);
              }
            }
          }
        }
        if (found < 0) return null;
        let cur = found;
        while (!nodes.has(cur)) {
          const p = prev[cur] as number;
          nodes.add(cur);
          if (p < 0) break;
          if (Math.floor(cur / N) === Math.floor(p / N)) wires.push([Math.floor(cur / N), Math.min(cur % N, p % N), Math.max(cur % N, p % N)]);
          else vias.add(cur % N);
          cur = p;
        }
        if (r.kind === 'gate') {
          const sd = targets.get(found) as Side;
          sides.push([r.ref, sd]);
          wires.push([0, Math.min(found, place.cell[r.ref] as number), Math.max(found, place.cell[r.ref] as number)]);
        }
      }
      return { nodes, wires, vias, sides };
    };

    const order = [...this.nets.keys()];
    for (let iter = 0; iter < maxIter; iter++) {
      for (const k of order) {
        const old = routed[k];
        if (old) for (const n of old.nodes) occ[n] = (occ[n] as number) - 1;
        routed[k] = null;
        const r = routeNet(k);
        if (!r) return null; // không có đường nào kể cả khi được dùng chung → bố trí này bế tắc
        routed[k] = r;
        for (const n of r.nodes) occ[n] = (occ[n] as number) + 1;
      }
      // hợp lệ: không nút nào bị 2 net dùng; không phía cổng nào bị 2 net dùng
      let overused = false;
      for (let n = 0; n < size; n++) {
        if ((occ[n] as number) > 1) {
          overused = true;
          hist[n] = (hist[n] as number) + 0.5 * ((occ[n] as number) - 1);
        }
      }
      const sideKeys = new Set<string>();
      for (const r of routed) for (const [h, sd] of r?.sides ?? []) {
        const key = `${h}:${sd}`;
        if (sideKeys.has(key)) overused = true;
        sideKeys.add(key);
      }
      if (!overused) {
        // Area = cổng + ô dây mọi lớp (trừ ô chân) + via
        let area = this.gates.length;
        const wires: [number, number, number][] = [];
        const vias = new Set<number>();
        const seen = new Set<string>();
        for (const r of routed) {
          if (!r) continue;
          for (const n of r.nodes) if (!g.pins.has(n % N)) area++;
          for (const v of r.vias) vias.add(v);
          for (const w of r.wires) {
            const key = w.join(',');
            if (!seen.has(key)) {
              seen.add(key);
              wires.push(w);
            }
          }
        }
        area += vias.size;
        return {
          area,
          state: {
            wires,
            vias: [...vias].sort((a, b) => a - b),
            gates: this.gates.map((gt, i) => ({ type: gt.type, cell: place.cell[i] as number, out: place.out[i] as Side })),
          },
        };
      }
      pfac *= 1.6;
      // đổi thứ tự net mỗi vòng để không net nào luôn được ưu tiên
      order.push(order.shift() as number);
    }
    return null;
  }

  // ---------------- đặt cổng ----------------
  /** Các (ô, hướng) hợp lệ cho một cổng. */
  private candidates(): [number, Side][] {
    const g = this.grid;
    const out: [number, Side][] = [];
    for (let c = 0; c < this.N; c++) {
      if (!g.canPlaceGate(c)) continue;
      for (const s of SIDES) {
        const port = g.neighbor(c, s);
        if (port < 0 || g.blocked.has(port)) continue;
        out.push([c, s]);
      }
    }
    return out;
  }

  /**
   * Loại sớm cách đặt chắc chắn không đi dây được (dùng trong beam search):
   * chân ra chĩa vào ô cấm / chân của net khác / cổng khác (trừ khi nối thẳng hợp lệ),
   * hoặc cổng mới nằm đè lên ô chân ra của cổng đã đặt.
   */
  private plausible(place: Placement, n: number): boolean {
    const g = this.grid;
    const netOfGate = (gi: number): Net | undefined => this.nets.find((nt) => nt.driver.kind === 'gate' && nt.driver.gate === gi);
    for (let gi = 0; gi < n; gi++) {
      const port = g.neighbor(place.cell[gi] as number, place.out[gi] as Side);
      if (port < 0 || g.blocked.has(port)) return false;
      const net = netOfGate(gi);
      const pin = g.pins.get(port);
      if (pin) {
        if (pin.kind !== 'out' || !net || !net.readers.some((r) => r.kind === 'pin' && r.ref === port)) return false;
      }
      const h = place.cell.indexOf(port);
      if (h >= 0 && h < n) {
        const only = !this.noDirect && net && net.readers.length === 1 && net.readers[0]?.kind === 'gate' && net.readers[0].ref === h;
        if (!only || place.out[h] === opposite(place.out[gi] as Side)) return false;
      }
    }
    return true;
  }

  private hpwl(place: Placement, gatesPlaced: number): number {
    let total = 0;
    for (const net of this.nets) {
      const pts: number[] = [];
      if (net.driver.kind === 'pin') pts.push(net.driver.cell);
      else if (net.driver.gate < gatesPlaced) pts.push(this.grid.neighbor(place.cell[net.driver.gate] as number, place.out[net.driver.gate] as Side));
      for (const r of net.readers) {
        if (r.kind === 'pin') pts.push(r.ref);
        else if (r.ref < gatesPlaced) pts.push(place.cell[r.ref] as number);
      }
      if (pts.length < 2) continue;
      const xs = pts.map((c) => this.xy(c)[0]);
      const ys = pts.map((c) => this.xy(c)[1]);
      total += Math.max(...xs) - Math.min(...xs) + Math.max(...ys) - Math.min(...ys);
    }
    return total;
  }

  noDirect = false;

  solve(opts: SolveOptions = {}): SolveResult | null {
    this.noDirect = opts.noDirect ?? false;
    const t0 = Date.now();
    const limit = opts.timeLimitMs ?? 20_000;
    const rand = rng(opts.seed ?? 1);
    const cand = this.candidates();
    const k = this.gates.length;
    const combos = cand.length ** k;
    const exhaustive = combos <= (opts.exhaustiveLimit ?? 60_000);
    const allOrders = this.orders(opts.orders ?? 24, rand);
    let best: { area: number; state: GridState } | null = null;
    let minLB = Infinity;
    let tried = 0;
    let timedOut = false;

    const tryPlacement = (place: Placement, deep: boolean): void => {
      tried++;
      const lb = this.lowerBound(place);
      if (lb < minLB) minLB = lb;
      if (best && lb >= best.area) return; // không thể tốt hơn → cắt nhánh
      const orders = deep ? allOrders : allOrders.slice(0, 2);
      for (const o of orders) {
        const r = this.route(place, o, best ? best.area : Infinity);
        if (r && (!best || r.area < best.area)) best = r;
        if (best && best.area <= lb) return; // chạm cận dưới: không cần thử thêm
      }
      // bố trí chật: đi dây tham lam có thể bế tắc → thử thương lượng tắc nghẽn
      if (deep) {
        const r = this.routeNegotiated(place);
        if (r && (!best || r.area < best.area)) best = r;
      }
    };

    if (k === 0) {
      tryPlacement({ cell: [], out: [] }, true);
    } else if (exhaustive) {
      // duyệt hết, cách đặt có cận dưới nhỏ trước (tìm nghiệm tốt sớm → cắt nhánh nhiều hơn)
      const all: Placement[] = [];
      const rec = (i: number, cells: number[], outs: Side[]): void => {
        if (i === k) {
          all.push({ cell: [...cells], out: [...outs] });
          return;
        }
        for (const [c, s] of cand) {
          if (cells.includes(c)) continue;
          cells.push(c);
          outs.push(s);
          rec(i + 1, cells, outs);
          cells.pop();
          outs.pop();
        }
      };
      rec(0, [], []);
      const scored = all.map((p) => ({ p, lb: this.lowerBound(p) })).filter((x) => Number.isFinite(x.lb));
      scored.sort((a, b) => a.lb - b.lb);
      minLB = scored[0]?.lb ?? Infinity;
      for (const [i, { p }] of scored.entries()) {
        if (Date.now() - t0 > limit) {
          timedOut = true;
          break;
        }
        tryPlacement(p, i < 200);
      }
      minLB = Math.min(minLB, ...scored.map((x) => x.lb));
    } else {
      // beam search: đặt từng cổng, giữ W cách đặt có HPWL nhỏ nhất
      const W = opts.beamWidth ?? 120;
      let beam: Placement[] = [{ cell: [], out: [] }];
      for (let i = 0; i < k; i++) {
        const next: { p: Placement; s: number }[] = [];
        for (const p of beam) {
          for (const [c, s] of cand) {
            if (p.cell.includes(c)) continue;
            const q = { cell: [...p.cell, c], out: [...p.out, s] };
            if (!this.plausible(q, i + 1)) continue;
            next.push({ p: q, s: this.hpwl(q, i + 1) + rand() * 1.5 });
          }
        }
        next.sort((a, b) => a.s - b.s);
        beam = next.slice(0, W).map((x) => x.p);
      }
      const scored = beam.map((p) => ({ p, lb: this.lowerBound(p) })).filter((x) => Number.isFinite(x.lb));
      scored.sort((a, b) => a.lb - b.lb);
      for (const [i, { p }] of scored.entries()) {
        if (Date.now() - t0 > limit) {
          timedOut = true;
          break;
        }
        tryPlacement(p, i < (opts.deepCount ?? 40));
      }
    }
    const res = best as { area: number; state: GridState } | null;
    if (!res) return null;
    const proven = exhaustive && !timedOut && res.area <= minLB;
    return {
      state: res.state,
      area: res.area,
      lowerBound: exhaustive && !timedOut ? minLB : NaN,
      proven,
      exhaustive: exhaustive && !timedOut,
      placementsTried: tried,
      routings: this.routings,
      ms: Date.now() - t0,
    };
  }

  /** Các thứ tự đi dây net: tất cả hoán vị nếu ít, không thì ngẫu nhiên (luôn gồm thứ tự "net dài trước"). */
  private orders(max: number, rand: () => number): number[][] {
    const n = this.nets.length;
    const idx = [...Array(n).keys()];
    const out: number[][] = [];
    const perm = (arr: number[], l: number): void => {
      if (out.length >= max) return;
      if (l === arr.length) {
        out.push([...arr]);
        return;
      }
      for (let i = l; i < arr.length; i++) {
        [arr[l], arr[i]] = [arr[i] as number, arr[l] as number];
        perm(arr, l + 1);
        [arr[l], arr[i]] = [arr[i] as number, arr[l] as number];
      }
    };
    if (n <= 5) perm(idx, 0);
    while (out.length < max) {
      const a = [...idx];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [a[i], a[j]] = [a[j] as number, a[i] as number];
      }
      out.push(a);
    }
    return out;
  }
}

/** Tiện ích: giải một màn từ mạch logic. */
export function solveDesign(spec: GridSpec, logic: Netlist, opts?: SolveOptions): SolveResult | null {
  return new DesignSolver(spec, logic).solve(opts);
}
