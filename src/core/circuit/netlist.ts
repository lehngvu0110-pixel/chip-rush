// Chuyển lưới (grid.ts) thành netlist để mô phỏng, và dịch lỗi mạch ngược về Ô LƯỚI
// để giao diện tô đỏ đúng chỗ sai (ví dụ: tô cả đoạn dây bị chập).
import { GATE_ARITY } from './gates';
import { opposite, SIDES, type Grid, type Side } from './grid';
import { compile, type CompiledCircuit } from './simulate';
import type { CircuitError, GateInstance, Netlist } from './types';

/** Một điểm trên lưới thuộc net: ô ở lớp nào. */
export interface NetNode {
  layer: number;
  cell: number;
}

export interface GridNetlist {
  netlist: Netlist;
  /** tên net → các ô (theo lớp) thuộc net đó, để tô sáng */
  netCells: Map<string, NetNode[]>;
  /** id cổng → ô */
  gateCell: Map<string, number>;
}

/** Union-find nhỏ (nén đường đi). */
class DSU {
  private readonly p: Int32Array;
  constructor(n: number) {
    this.p = new Int32Array(n).map((_, i) => i);
  }
  find(x: number): number {
    let r = x;
    while (this.p[r] !== r) r = this.p[r] as number;
    while (this.p[x] !== r) {
      const next = this.p[x] as number;
      this.p[x] = r;
      x = next;
    }
    return r;
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.p[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

export function gridToNetlist(grid: Grid): GridNetlist {
  const N = grid.size;
  // Nút: dây (lớp, ô) = lớp*N + ô; chân cổng (ô, phía) = 2N + ô*4 + phía
  const wireNode = (layer: number, cell: number): number => layer * N + cell;
  const termNode = (cell: number, side: Side): number => 2 * N + cell * 4 + side;
  const dsu = new DSU(6 * N);
  const used = new Set<number>();

  const nodeFor = (layer: number, cell: number, side: Side): number =>
    layer === 0 && grid.gateAt(cell) ? termNode(cell, side) : wireNode(layer, cell);

  for (const w of grid.wires()) {
    const sAB = grid.sideTo(w.a, w.b);
    if (sAB === -1) continue;
    const na = nodeFor(w.layer, w.a, sAB);
    const nb = nodeFor(w.layer, w.b, opposite(sAB));
    dsu.union(na, nb);
    used.add(na);
    used.add(nb);
  }
  for (const v of grid.vias()) {
    dsu.union(wireNode(0, v), wireNode(1, v));
    used.add(wireNode(0, v));
    used.add(wireNode(1, v));
  }
  for (const c of [...grid.inputCells, ...grid.outputCells]) used.add(wireNode(0, c));

  // Đặt tên net ổn định: net chứa chân vào → tên chân vào; chứa đèn → tên đèn; còn lại n0, n1...
  const names = new Map<number, string>();
  const pinName = (cells: number[]): void => {
    for (const c of cells) {
      const root = dsu.find(wireNode(0, c));
      const pin = grid.pins.get(c);
      if (pin && !names.has(root)) names.set(root, pin.id);
    }
  };
  pinName(grid.inputCells);
  pinName(grid.outputCells);
  let k = 0;
  const nameOf = (node: number): string => {
    const root = dsu.find(node);
    let n = names.get(root);
    if (n === undefined) {
      n = `n${k++}`;
      names.set(root, n);
    }
    return n;
  };

  const gates: GateInstance[] = [];
  const gateCell = new Map<string, number>();
  for (const g of grid.gates()) {
    gateCell.set(g.id, g.cell);
    const sides = new Set(grid.wireSides(0, g.cell));
    const inputs: string[] = [];
    for (const s of SIDES) if (s !== g.out && sides.has(s)) inputs.push(nameOf(termNode(g.cell, s)));
    // chân ra chưa nối dây vẫn có net riêng (không ai đọc) để cổng luôn mô phỏng được
    const output = sides.has(g.out) ? nameOf(termNode(g.cell, g.out)) : `${g.id}.out`;
    gates.push({ id: g.id, type: g.type, inputs, output });
  }

  const netlist: Netlist = {
    inputs: grid.inputCells.map((c) => nameOf(wireNode(0, c))),
    outputs: grid.outputCells.map((c) => nameOf(wireNode(0, c))),
    gates,
  };

  // net → ô để tô sáng
  const netCells = new Map<string, NetNode[]>();
  for (const node of [...used].sort((a, b) => a - b)) {
    const name = nameOf(node);
    const item: NetNode = node < 2 * N ? { layer: Math.floor(node / N), cell: node % N } : { layer: 0, cell: Math.floor((node - 2 * N) / 4) };
    const list = netCells.get(name);
    if (!list) netCells.set(name, [item]);
    else if (!list.some((x) => x.layer === item.layer && x.cell === item.cell)) list.push(item);
  }
  return { netlist, netCells, gateCell };
}

/**
 * Area (SPEC mục 2) = số ô có dây ở lớp 1 + số ô có dây ở lớp 2 + số cổng + số via.
 * Không tính ô chân vào/đèn (cố định của màn, người chơi không đặt).
 */
export function areaOf(grid: Grid): number {
  let a = 0;
  for (let layer = 0; layer < grid.layers; layer++) {
    for (let cell = 0; cell < grid.size; cell++) {
      if (grid.pins.has(cell)) continue;
      if (layer === 0 && grid.gateAt(cell)) continue; // tính ở dưới
      if (grid.wireSides(layer, cell).length > 0) a++;
    }
  }
  return a + grid.gates().length + grid.vias().length;
}

export type ProblemKind = 'short' | 'open' | 'led-unconnected' | 'arity' | 'loop' | 'other';

/** Lỗi đã dịch sang ngôn ngữ người chơi + các ô cần tô. */
export interface Problem {
  kind: ProblemKind;
  message: string;
  nodes: NetNode[];
}

export type Diagnosis =
  | { ok: true; circuit: CompiledCircuit; netlist: Netlist }
  | { ok: false; problems: Problem[]; netlist: Netlist };

/** Kiểm tra mạch trên lưới. Trả về TẤT CẢ lỗi (mỗi lỗi kèm ô để tô), hoặc mạch đã biên dịch. */
export function diagnose(grid: Grid): Diagnosis {
  const { netlist, netCells, gateCell } = gridToNetlist(grid);
  const res = compile(netlist);
  if (res.ok) return { ok: true, circuit: res.circuit, netlist };
  const gateNode = (id: string): NetNode[] => {
    const c = gateCell.get(id);
    return c === undefined ? [] : [{ layer: 0, cell: c }];
  };
  const gateName = (id: string): string => grid.gates().find((g) => g.id === id)?.type ?? id;
  const problems = res.errors.map((e: CircuitError): Problem => {
    switch (e.kind) {
      case 'multiple-drivers':
        return { kind: 'short', message: 'Chập mạch: hai nguồn tín hiệu cùng nối vào một dây.', nodes: [...(netCells.get(e.net) ?? []), ...e.drivers.flatMap(gateNode)] };
      case 'undriven-net': {
        const leds = e.readers.filter((r) => r.startsWith('out:')).map((r) => r.slice(4));
        if (leds.length > 0 && leds.length === e.readers.length) {
          return { kind: 'led-unconnected', message: `Đèn ${leds.join(', ')} chưa được nối tới nguồn tín hiệu.`, nodes: netCells.get(e.net) ?? [] };
        }
        return { kind: 'open', message: 'Dây hở: có chân vào của cổng chưa nhận được tín hiệu.', nodes: [...(netCells.get(e.net) ?? []), ...e.readers.flatMap(gateNode)] };
      }
      case 'arity':
        return {
          kind: 'arity',
          message: `Cổng ${gateName(e.gate)} cần ${e.expected} dây vào nhưng đang có ${e.actual}.`,
          nodes: gateNode(e.gate),
        };
      case 'combinational-loop':
        return { kind: 'loop', message: 'Vòng lặp: tín hiệu ra của cổng quay ngược về chính nó.', nodes: e.gates.flatMap(gateNode) };
      default:
        return { kind: 'other', message: 'Mạch chưa hợp lệ.', nodes: [] };
    }
  });
  return { ok: false, problems, netlist };
}

/** Số chân vào cổng cần (tiện cho UI hiển thị "AND: 1/2 dây vào"). */
export const gateArity = (type: keyof typeof GATE_ARITY): number => GATE_ARITY[type];
