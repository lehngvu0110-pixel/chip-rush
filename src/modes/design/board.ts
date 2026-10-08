// Bảng mạch dùng chung cho THIẾT KẾ và KIỂM THỬ: giữ lưới + mô phỏng trực tiếp (có thể cài lỗi)
// + vẽ (dây sáng theo bit, dòng điện chạy đúng chiều, cổng, via, công tắc, đèn).
import type { Grid } from '../../core/circuit/grid';
import { gridToNetlist, type NetNode } from '../../core/circuit/netlist';
import { compile, evaluateRow, truthTable, type CompiledCircuit } from '../../core/circuit/simulate';
import type { Bit, Fault } from '../../core/circuit/types';
import type { RenderSurface } from '../../render/canvas';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { drawGlow } from '../../render/fx';
import { drawGateSymbol } from '../../render/gate-symbol';
import { THEME } from '../../render/theme';

export const LAYER_COL = ['#3d7fd6', '#a07cff'] as const; // lớp 1: xanh đồng; lớp 2: tím
const BIT0 = '#26355f';

export interface GridRect {
  x: number;
  y: number;
  cell: number;
  cols: number;
  rows: number;
}

export interface BoardDrawOptions {
  time: number;
  /** lớp đang thao tác (lớp kia vẽ mờ) */
  layer: number;
  tool?: string;
  drag?: { last: [number, number] } | null;
  problemNodes: NetNode[];
  problemT: number;
  passed: boolean;
  /** nhãn trên ô (giá trị đo) */
  marks?: { cell: number; text: string; color: string }[];
  /** ô được chọn (viền cam) */
  selected?: number[];
}

export class Board {
  inputs: Bit[];
  /** lỗi cài vào mạch (KIỂM THỬ), theo tên net/cổng của netlist sinh từ lưới */
  fault: Fault | null = null;
  circuit: CompiledCircuit | null = null;
  /** "lớp:ô" → chỉ số net */
  nodeNet = new Map<string, number>();
  /** hướng dòng tín hiệu trên từng đoạn dây: khoá "lớp:ô nhỏ:ô lớn" → true nếu chảy từ ô nhỏ sang ô lớn */
  private flow = new Map<string, boolean>();
  netVals: Uint8Array | null = null;
  actualRows: Bit[][] | null = null;
  /** true = mạch hợp lệ hoàn toàn (không phải mô phỏng tạm khi đang vẽ dở) */
  strict = false;
  private extraInputs = 0;
  private undriven = new Set<number>();

  constructor(readonly grid: Grid) {
    this.inputs = grid.inputCells.map(() => 0 as Bit);
  }

  /**
   * Mô phỏng lại sau mỗi thay đổi.
   * - Mạch hợp lệ: tính giá trị mọi net cho hàng đầu vào hiện tại + cả bảng chân trị.
   * - Mạch chỉ còn lỗi "dây chưa có nguồn" (đang vẽ dở): vẫn mô phỏng, coi dây đó = chưa xác định,
   *   để người chơi thấy tín hiệu chạy dọc dây ngay khi vẽ thay vì phải nối xong mới thấy.
   */
  recompute(): void {
    this.computeFlow();
    const gn = gridToNetlist(this.grid);
    let res = compile(gn.netlist);
    this.strict = res.ok;
    this.extraInputs = 0;
    this.undriven = new Set();
    if (!res.ok && res.errors.every((e) => e.kind === 'undriven-net')) {
      const nets = res.errors.flatMap((e) => (e.kind === 'undriven-net' ? [e.net] : []));
      res = compile({ ...gn.netlist, inputs: [...gn.netlist.inputs, ...nets] });
      if (res.ok) {
        this.extraInputs = nets.length;
        this.undriven = new Set(nets.map((n) => (res.ok ? res.circuit.netIndex.get(n) : undefined)).filter((i): i is number => i !== undefined));
      }
    }
    this.nodeNet.clear();
    if (!res.ok) {
      this.circuit = null;
      this.netVals = null;
      this.actualRows = null;
      return;
    }
    const c = res.circuit;
    this.circuit = c;
    // tín hiệu đi ra từ dây chưa có nguồn cũng "chưa xác định" (đừng để NOT của dây hở sáng lên)
    for (const op of c.ops) if (op.ins.some((i) => this.undriven.has(i))) this.undriven.add(op.out);
    for (const [name, nodes] of gn.netCells) {
      const i = c.netIndex.get(name);
      if (i === undefined) continue;
      for (const n of nodes) if (!(n.layer === 0 && this.grid.gateAt(n.cell))) this.nodeNet.set(`${n.layer}:${n.cell}`, i);
    }
    this.actualRows = this.strict ? truthTable(c, this.fault ?? undefined).map((r) => r.outputs) : null;
    this.evalCurrent();
  }

  /**
   * Hướng tín hiệu trên dây (để vẽ "dòng điện" chạy đúng chiều): BFS từ mọi nguồn
   * (chân công tắc, chân ra của cổng) dọc theo dây và via; cổng là điểm cuối (không đi xuyên qua).
   */
  private computeFlow(): void {
    const g = this.grid;
    const N = g.size;
    const GATE = 2 * N; // nút cổng = 2N + ô
    const adj = new Map<number, number[]>();
    const link = (a: number, b: number): void => {
      (adj.get(a) ?? adj.set(a, []).get(a))?.push(b);
      (adj.get(b) ?? adj.set(b, []).get(b))?.push(a);
    };
    const node = (layer: number, cell: number): number => (layer === 0 && g.gateAt(cell) ? GATE + cell : layer * N + cell);
    for (const w of g.wires()) link(node(w.layer, w.a), node(w.layer, w.b));
    for (const v of g.vias()) link(v, N + v);
    const parent = new Map<number, number>();
    const queue: number[] = [];
    for (const c of g.inputCells) {
      parent.set(c, -1);
      queue.push(c);
    }
    for (const gt of g.gates()) {
      const port = g.neighbor(gt.cell, gt.out);
      if (port < 0 || !g.hasWire(0, gt.cell, port)) continue;
      const pn = node(0, port);
      if (!parent.has(pn)) {
        parent.set(pn, GATE + gt.cell);
        queue.push(pn);
      }
    }
    for (let i = 0; i < queue.length; i++) {
      const u = queue[i] as number;
      for (const v of adj.get(u) ?? []) {
        if (parent.has(v) || v >= GATE) continue; // không đi xuyên cổng
        parent.set(v, u);
        queue.push(v);
      }
    }
    this.flow.clear();
    const cellOf = (n: number): number => (n >= GATE ? n - GATE : n % N);
    const layerOf = (n: number): number => (n >= GATE ? 0 : Math.floor(n / N));
    for (const [child, par] of parent) {
      if (par < 0) continue;
      if (layerOf(child) !== layerOf(par) || cellOf(child) === cellOf(par)) continue; // via
      const a = cellOf(par);
      const b = cellOf(child);
      this.flow.set(`${layerOf(child)}:${Math.min(a, b)}:${Math.max(a, b)}`, a < b);
    }
    // dây đi VÀO cổng (chân vào): hướng về phía cổng
    for (const gt of g.gates()) {
      for (const sd of g.wireSides(0, gt.cell)) {
        if (sd === gt.out) continue;
        const m = g.neighbor(gt.cell, sd);
        if (parent.has(node(0, m))) this.flow.set(`0:${Math.min(m, gt.cell)}:${Math.max(m, gt.cell)}`, m < gt.cell);
      }
    }
  }

  /** Giá trị bit trên nút (lớp, ô), hoặc null nếu chưa xác định. */
  valueAt(layer: number, cell: number): Bit | null {
    if (!this.netVals) return null;
    const idx = this.nodeNet.get(`${layer}:${cell}`);
    if (idx === undefined || this.undriven.has(idx)) return null;
    return this.netVals[idx] as Bit;
  }

  currentRow(): number {
    return this.inputs.reduce<number>((acc, b) => (acc << 1) | b, 0);
  }

  evalCurrent(): void {
    if (!this.circuit) return;
    // đầu vào phụ (dây chưa có nguồn) nằm ở các bit thấp, luôn = 0
    this.netVals = evaluateRow(this.circuit, this.currentRow() << this.extraInputs, this.fault ?? undefined);
  }

  ledValues(): (Bit | null)[] {
    const c = this.circuit;
    const v = this.netVals;
    if (!c || !v) return this.grid.outputCells.map(() => null);
    return c.outputIdx.map((i) => (this.undriven.has(i) ? null : (v[i] as Bit)));
  }

  wireColor(layer: number, a: number, b: number): string {
    const base = LAYER_COL[layer] ?? LAYER_COL[0];
    if (!this.netVals) return base;
    const key = this.nodeNet.has(`${layer}:${a}`) ? `${layer}:${a}` : `${layer}:${b}`;
    const idx = this.nodeNet.get(key);
    if (idx === undefined || this.undriven.has(idx)) return base;
    return this.netVals[idx] ? (layer === 0 ? THEME.bit1 : '#d6c6ff') : BIT0;
  }

  draw(s: RenderSurface, G: GridRect, o: BoardDrawOptions): void {
    const ctx = s.ctx;
    const g = this.grid;
    const cs = G.cell;
    const center = (cell: number): [number, number] => {
      const [c, r] = g.colRow(cell);
      return [G.x + (c + 0.5) * cs, G.y + (r + 0.5) * cs];
    };
    // bảng mạch
    roundRectPath(ctx, G.x - 6, G.y - 6, cs * G.cols + 12, cs * G.rows + 12, 12);
    ctx.fillStyle = 'rgba(8,13,30,0.92)';
    ctx.fill();
    ctx.strokeStyle = '#24305a';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // lưới chấm + ô chặn
    for (let cell = 0; cell < g.size; cell++) {
      const [x, y] = center(cell);
      if (g.blocked.has(cell)) {
        ctx.save();
        roundRectPath(ctx, x - cs * 0.44, y - cs * 0.44, cs * 0.88, cs * 0.88, 6);
        ctx.fillStyle = '#141a30';
        ctx.fill();
        ctx.clip();
        ctx.strokeStyle = '#2a3358';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let k = -cs; k < cs; k += 8) {
          ctx.moveTo(x + k - cs / 2, y + cs / 2);
          ctx.lineTo(x + k + cs / 2, y - cs / 2);
        }
        ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.fillStyle = '#26315c';
      ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    // ô lỗi (nhấp nháy đỏ trong vài giây sau khi Kiểm tra)
    if (o.problemT > 0) {
      const a = 0.35 + 0.35 * Math.sin(o.time * 8);
      for (const n of o.problemNodes) {
        const [x, y] = center(n.cell);
        roundRectPath(ctx, x - cs * 0.46, y - cs * 0.46, cs * 0.92, cs * 0.92, 8);
        ctx.fillStyle = rgba(THEME.error, a * Math.min(1, o.problemT));
        ctx.fill();
      }
    }
    // dây: lớp đang chọn vẽ sau (nổi lên trên), lớp kia mờ đi
    const order = o.layer === 0 ? [1, 0] : [0, 1];
    ctx.lineCap = 'round';
    for (const layer of order) {
      if (layer >= g.layers) continue;
      ctx.globalAlpha = layer === o.layer || g.layers === 1 ? 1 : 0.45;
      const lw = layer === 0 ? Math.max(5, cs * 0.16) : Math.max(4, cs * 0.12);
      const fancy = s.quality === 'high' && !s.reducedMotion;
      const lit: [number, number, number, number, boolean | undefined][] = [];
      for (const w of g.wires()) {
        if (w.layer !== layer) continue;
        const [x1, y1] = center(w.a);
        const [x2, y2] = center(w.b);
        const col = this.wireColor(layer, w.a, w.b);
        const on = col === THEME.bit1 || col === '#d6c6ff';
        if (on && fancy) {
          // quầng sáng: nét rộng mờ phía dưới (rẻ hơn shadowBlur)
          ctx.strokeStyle = rgba(layer === 0 ? THEME.bit1 : '#b89cff', 0.22);
          ctx.lineWidth = lw * 2.8;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
        ctx.strokeStyle = col;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        if (layer === 1) {
          // lớp 2: lõi tối ở giữa → nhìn như "ống", phân biệt với lớp 1 không chỉ bằng màu
          ctx.strokeStyle = 'rgba(8,13,30,0.75)';
          ctx.lineWidth = lw * 0.35;
          ctx.stroke();
        }
        if (on) lit.push([x1, y1, x2, y2, this.flow.get(`${layer}:${Math.min(w.a, w.b)}:${Math.max(w.a, w.b)}`)]);
      }
      // "dòng điện": chấm sáng chạy dọc dây mang bit 1, đúng chiều từ nguồn tới đích
      if (fancy && lit.length > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(240,253,255,0.95)';
        ctx.lineWidth = Math.max(2, lw * 0.42);
        ctx.setLineDash([cs * 0.1, cs * 0.4]);
        ctx.lineDashOffset = -((o.time * cs * 1.4) % (cs * 0.5));
        for (const [x1, y1, x2, y2, fwd] of lit) {
          if (fwd === undefined) continue;
          // dây lưu theo (ô nhỏ, ô lớn); a = ô nhỏ là (x1,y1) vì wires() trả về a < b
          const [ax, ay, bx, by] = fwd ? [x1, y1, x2, y2] : [x2, y2, x1, y1];
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(bx, by);
          ctx.stroke();
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    // via
    for (const v of g.vias()) {
      const [x, y] = center(v);
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.17, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1020';
      ctx.fill();
      ctx.strokeStyle = '#d6dcff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, cs * 0.06, 0, Math.PI * 2);
      ctx.fillStyle = '#d6dcff';
      ctx.fill();
    }
    // cổng
    for (const gt of g.gates()) {
      const [x, y] = center(gt.cell);
      const t = cs * 0.8;
      // cổng đang cho ra 1 thì sáng lên
      const port = g.neighbor(gt.cell, gt.out);
      const outV = port >= 0 && g.hasWire(0, gt.cell, port) ? this.valueAt(0, port) : null;
      if (outV === 1 && !s.reducedMotion) drawGlow(ctx, THEME.bit1, cs * 0.7, x, y, 0.9 + 0.1 * Math.sin(o.time * 4));
      roundRectPath(ctx, x - t / 2, y - t / 2, t, t, 8);
      const tile = ctx.createLinearGradient(0, y - t / 2, 0, y + t / 2);
      tile.addColorStop(0, outV === 1 ? '#1b3156' : '#18224a');
      tile.addColorStop(1, '#0e1534');
      ctx.fillStyle = tile;
      ctx.fill();
      ctx.strokeStyle = outV === 1 ? THEME.bit1 : rgba(THEME.bit1, 0.55);
      ctx.lineWidth = outV === 1 ? 2 : 1.5;
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((gt.out * Math.PI) / 2);
      drawGateSymbol(ctx, gt.type, -t * 0.44, -t * 0.3, t * 0.88, t * 0.6, { stroke: THEME.bit1, fill: rgba(THEME.bit1, 0.1), lineWidth: 2 });
      ctx.restore();
      if (cs >= 40) {
        ctx.font = `700 ${Math.round(cs * 0.17)}px ${THEME.font}`;
        ctx.fillStyle = THEME.text;
        ctx.textAlign = 'center';
        ctx.fillText(gt.type, x, y + t / 2 - 3);
      }
    }
    // chân: công tắc (đầu vào) và đèn (đầu ra)
    const leds = this.ledValues();
    for (const [i, cell] of g.inputCells.entries()) {
      const [x, y] = center(cell);
      const v = this.inputs[i] ?? 0;
      const t = cs * 0.78;
      if (v && !s.reducedMotion) drawGlow(ctx, THEME.bit1, cs * 0.6, x, y, 0.9);
      roundRectPath(ctx, x - t / 2, y - t / 2, t, t, 10);
      ctx.fillStyle = v ? '#123a4a' : '#151c38';
      ctx.fill();
      ctx.strokeStyle = v ? THEME.bit1 : '#46557f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(cs * 0.2)}px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(g.pins.get(cell)?.id ?? '', x, y - t * 0.12);
      ctx.font = `700 ${Math.round(cs * 0.3)}px ${THEME.monoFont}`;
      ctx.fillStyle = v ? THEME.bit1 : THEME.text;
      ctx.fillText(String(v), x, y + t * 0.32);
    }
    for (const [i, cell] of g.outputCells.entries()) {
      const [x, y] = center(cell);
      const v = leds[i] ?? null;
      const r = cs * 0.36;
      if (v === 1 && !s.reducedMotion) drawGlow(ctx, THEME.accent, cs * 0.75, x, y, 1);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = v === 1 ? '#5a3a00' : '#151c38';
      ctx.fill();
      ctx.strokeStyle = v === 1 ? THEME.accent : '#46557f';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(cs * 0.2)}px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(g.pins.get(cell)?.id ?? '', x, y - r * 0.2);
      ctx.font = `700 ${Math.round(cs * 0.26)}px ${THEME.monoFont}`;
      ctx.fillStyle = v === 1 ? '#ffe2a6' : THEME.text;
      ctx.fillText(v === null ? '?' : String(v), x, y + r * 0.7);
    }
    // ô ngón tay đang ở (khi kéo)
    if (o.drag) {
      const [x, y] = center(g.cellAt(o.drag.last[0], o.drag.last[1]));
      roundRectPath(ctx, x - cs / 2 + 2, y - cs / 2 + 2, cs - 4, cs - 4, 8);
      ctx.strokeStyle = rgba(o.tool === 'erase' ? THEME.error : (LAYER_COL[o.layer] ?? THEME.bit1), 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (o.passed) {
      roundRectPath(ctx, G.x - 6, G.y - 6, cs * G.cols + 12, cs * G.rows + 12, 12);
      ctx.strokeStyle = THEME.bit1;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // nhãn đo (KIỂM THỬ): giá trị đã đo trên dây
    for (const m of o.marks ?? []) {
      const [x, y] = center(m.cell);
      const r = Math.max(9, cs * 0.2);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = '#0b1020';
      ctx.fill();
      ctx.strokeStyle = m.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.font = `700 ${Math.round(r * 1.1)}px ${THEME.monoFont}`;
      ctx.fillStyle = m.color;
      ctx.fillText(m.text, x, y + r * 0.4);
    }
    // ô được chọn (KIỂM THỬ: báo lỗi)
    for (const cell of o.selected ?? []) {
      const [x, y] = center(cell);
      roundRectPath(ctx, x - cs / 2 + 1, y - cs / 2 + 1, cs - 2, cs - 2, 9);
      ctx.strokeStyle = THEME.accent;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}
