// Lưới 2 lớp kim loại của chế độ THIẾT KẾ (thuần, không DOM).
//
// Mô hình (viết 07/10, ghi trong SPEC mục 2 "Làm rõ khi cài đặt", chờ Vũ duyệt):
// - Dây là CẠNH nối tâm 2 ô kề nhau (ngang/dọc) trên một lớp. Hai dây song song sát nhau
//   KHÔNG dính nhau (khác mô hình "tô ô", vốn làm dây cạnh nhau tự chập).
// - Mọi cạnh cùng lớp chạm vào một ô thường đều nối với nhau tại ô đó → hai dây CẮT NHAU
//   trên cùng lớp là chập mạch (giống dây đồng thật). Muốn vượt qua phải lên lớp 2 bằng via.
// - Cổng chiếm 1 ô ở lớp 1 (chỉ số 0). Mỗi cạnh vào ô cổng là một CHÂN riêng:
//   cạnh ở phía `out` = chân ra; cạnh ở 3 phía còn lại = chân vào. Mọi cổng 2 đầu vào trong game
//   đều giao hoán (AND/OR/XOR/NAND/NOR/XNOR) nên thứ tự chân vào không quan trọng.
// - Chân đầu vào (công tắc) và đầu ra (đèn LED) cố định ở 1 ô lớp 1; mọi cạnh vào ô đó nối vào chân.
// - Lớp 2 (chỉ số 1) đi được qua mọi ô không bị chặn, kể cả phía trên cổng/chân, và không nối gì
//   ở đó; chỉ nối xuống lớp 1 qua via (đặt ở ô thường).
import type { GateType } from './types';

/** Hướng: 0 = Đông (phải), 1 = Nam (dưới), 2 = Tây (trái), 3 = Bắc (trên). */
export type Side = 0 | 1 | 2 | 3;
export const SIDES: readonly Side[] = [0, 1, 2, 3];
const DELTA: ReadonlyArray<readonly [number, number]> = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const opposite = (s: Side): Side => ((s + 2) % 4) as Side;

export interface PinSpec {
  id: string;
  cell: [number, number]; // [cột, hàng]
}

export interface GridSpec {
  cols: number;
  rows: number;
  layers: 1 | 2;
  inputs: PinSpec[];
  outputs: PinSpec[];
  blocked?: [number, number][];
}

export interface PlacedGate {
  id: string;
  type: GateType;
  cell: number;
  /** phía có chân ra (mặc định Đông) */
  out: Side;
}

export interface Wire {
  layer: number;
  a: number;
  b: number;
}

/** Trạng thái người chơi tạo ra (không gồm phần cố định của màn) — dùng để lưu/hoàn tác. */
export interface GridState {
  wires: [number, number, number][]; // [lớp, ô a, ô b] với a < b
  vias: number[];
  gates: { type: GateType; cell: number; out: Side }[];
}

export type PinKind = { kind: 'in' | 'out'; id: string };

export class Grid {
  readonly cols: number;
  readonly rows: number;
  readonly layers: 1 | 2;
  readonly size: number;
  readonly pins = new Map<number, PinKind>();
  readonly blocked = new Set<number>();
  readonly inputCells: number[] = [];
  readonly outputCells: number[] = [];
  private readonly wireSet = new Set<number>();
  private readonly viaSet = new Set<number>();
  private readonly gateMap = new Map<number, PlacedGate>();

  constructor(readonly spec: GridSpec) {
    if (spec.cols < 1 || spec.rows < 1) throw new Error('Lưới phải có ít nhất 1 ô');
    this.cols = spec.cols;
    this.rows = spec.rows;
    this.layers = spec.layers;
    this.size = spec.cols * spec.rows;
    const place = (p: PinSpec, kind: 'in' | 'out'): number => {
      const cell = this.cellAt(p.cell[0], p.cell[1]);
      if (cell < 0) throw new Error(`Chân ${p.id} nằm ngoài lưới`);
      if (this.pins.has(cell)) throw new Error(`Hai chân trùng ô (${p.id})`);
      this.pins.set(cell, { kind, id: p.id });
      return cell;
    };
    for (const p of spec.inputs) this.inputCells.push(place(p, 'in'));
    for (const p of spec.outputs) this.outputCells.push(place(p, 'out'));
    for (const [c, r] of spec.blocked ?? []) {
      const cell = this.cellAt(c, r);
      if (cell >= 0 && !this.pins.has(cell)) this.blocked.add(cell);
    }
  }

  // ---------- toạ độ ----------
  /** chỉ số ô, hoặc -1 nếu ngoài lưới */
  cellAt(col: number, row: number): number {
    return col >= 0 && row >= 0 && col < this.cols && row < this.rows ? row * this.cols + col : -1;
  }

  colRow(cell: number): [number, number] {
    return [cell % this.cols, Math.floor(cell / this.cols)];
  }

  neighbor(cell: number, side: Side): number {
    const [c, r] = this.colRow(cell);
    const [dx, dy] = DELTA[side] as readonly [number, number];
    return this.cellAt(c + dx, r + dy);
  }

  /** phía của b nhìn từ a (a, b kề nhau), hoặc -1 */
  sideTo(a: number, b: number): Side | -1 {
    for (const s of SIDES) if (this.neighbor(a, s) === b) return s;
    return -1;
  }

  // ---------- dây ----------
  /** Mã cạnh: (lớp, ô nhỏ hơn, hướng Đông/Nam). -1 nếu 2 ô không kề nhau. */
  wireId(layer: number, a: number, b: number): number {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const s = this.sideTo(lo, hi);
    if (s !== 0 && s !== 1) return -1;
    return (layer * this.size + lo) * 2 + s;
  }

  private decodeWire(id: number): Wire {
    const s = (id % 2) as Side;
    const rest = (id - s) / 2;
    const layer = Math.floor(rest / this.size);
    const a = rest % this.size;
    return { layer, a, b: this.neighbor(a, s) };
  }

  /** Ô có cho đi dây ở lớp này không. */
  canWire(layer: number, cell: number): boolean {
    return layer >= 0 && layer < this.layers && cell >= 0 && cell < this.size && !this.blocked.has(cell);
  }

  hasWire(layer: number, a: number, b: number): boolean {
    const id = this.wireId(layer, a, b);
    return id >= 0 && this.wireSet.has(id);
  }

  addWire(layer: number, a: number, b: number): boolean {
    const id = this.wireId(layer, a, b);
    if (id < 0 || !this.canWire(layer, a) || !this.canWire(layer, b)) return false;
    if (this.wireSet.has(id)) return false;
    this.wireSet.add(id);
    return true;
  }

  removeWire(layer: number, a: number, b: number): boolean {
    const id = this.wireId(layer, a, b);
    return id >= 0 && this.wireSet.delete(id);
  }

  /** Kéo ngón tay qua dãy ô: nối từng cặp ô liên tiếp. Bỏ qua bước không hợp lệ. Trả về số cạnh thêm mới. */
  drawPath(layer: number, cells: readonly number[]): number {
    let added = 0;
    for (let i = 1; i < cells.length; i++) if (this.addWire(layer, cells[i - 1] as number, cells[i] as number)) added++;
    return added;
  }

  /** Các phía của ô có dây ở lớp này. */
  wireSides(layer: number, cell: number): Side[] {
    return SIDES.filter((s) => {
      const n = this.neighbor(cell, s);
      return n >= 0 && this.hasWire(layer, cell, n);
    });
  }

  wires(): Wire[] {
    return [...this.wireSet].sort((x, y) => x - y).map((id) => this.decodeWire(id));
  }

  // ---------- via ----------
  canVia(cell: number): boolean {
    return this.layers === 2 && this.canWire(0, cell) && !this.pins.has(cell) && !this.gateMap.has(cell);
  }

  hasVia(cell: number): boolean {
    return this.viaSet.has(cell);
  }

  /** Bật/tắt via. Trả về false nếu ô không đặt via được. */
  toggleVia(cell: number): boolean {
    if (this.viaSet.delete(cell)) return true;
    if (!this.canVia(cell)) return false;
    this.viaSet.add(cell);
    return true;
  }

  vias(): number[] {
    return [...this.viaSet].sort((a, b) => a - b);
  }

  // ---------- cổng ----------
  canPlaceGate(cell: number): boolean {
    return this.canWire(0, cell) && !this.pins.has(cell) && !this.gateMap.has(cell) && !this.viaSet.has(cell);
  }

  placeGate(cell: number, type: GateType, out: Side = 0): PlacedGate | null {
    if (!this.canPlaceGate(cell)) return null;
    const [c, r] = this.colRow(cell);
    const g: PlacedGate = { id: `g${c}_${r}`, type, cell, out };
    this.gateMap.set(cell, g);
    return g;
  }

  removeGate(cell: number): boolean {
    return this.gateMap.delete(cell);
  }

  gateAt(cell: number): PlacedGate | undefined {
    return this.gateMap.get(cell);
  }

  /** Cổng theo thứ tự ô tăng dần (ổn định cho test và cho solver). */
  gates(): PlacedGate[] {
    return [...this.gateMap.values()].sort((a, b) => a.cell - b.cell);
  }

  /** Tẩy một ô ở một lớp: xoá mọi dây chạm ô, via, và cổng (nếu là lớp 1). */
  eraseCell(layer: number, cell: number): void {
    for (const s of this.wireSides(layer, cell)) this.removeWire(layer, cell, this.neighbor(cell, s));
    this.viaSet.delete(cell);
    if (layer === 0) this.gateMap.delete(cell);
  }

  clear(): void {
    this.wireSet.clear();
    this.viaSet.clear();
    this.gateMap.clear();
  }

  // ---------- lưu / hoàn tác ----------
  state(): GridState {
    return {
      wires: this.wires().map((w) => [w.layer, Math.min(w.a, w.b), Math.max(w.a, w.b)]),
      vias: this.vias(),
      gates: this.gates().map((g) => ({ type: g.type, cell: g.cell, out: g.out })),
    };
  }

  /** Nạp trạng thái; phần tử không hợp lệ với màn này bị bỏ qua (dữ liệu lưu cũ/hỏng không làm sập game). */
  load(st: GridState): void {
    this.clear();
    for (const g of st.gates) this.placeGate(g.cell, g.type, g.out);
    for (const v of st.vias) this.toggleVia(v);
    for (const [layer, a, b] of st.wires) this.addWire(layer, a, b);
  }

  clone(): Grid {
    const g = new Grid(this.spec);
    g.load(this.state());
    return g;
  }
}
