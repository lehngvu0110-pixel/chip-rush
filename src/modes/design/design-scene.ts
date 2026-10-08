// Màn THIẾT KẾ: kéo ngón tay vẽ dây trên lưới 2 lớp, đặt/xoay cổng, via, tẩy, hoàn tác,
// mô phỏng trực tiếp (dây sáng theo bit), kiểm tra bảng chân trị và chấm PPA so với "AI kỹ sư".
// Logic mạch ở core/ (grid, netlist, level); file này chỉ vẽ + nhận thao tác + thanh công cụ DOM.
import { Grid, type GridState, type Side } from '../../core/circuit/grid';
import { gridToNetlist, type NetNode } from '../../core/circuit/netlist';
import { compile, evaluateRow, truthTable, type CompiledCircuit } from '../../core/circuit/simulate';
import type { Bit, GateType } from '../../core/circuit/types';
import type { DesignLevel } from '../../core/level/types';
import { aiSolutionGrid, evaluateDesign, expectedRows, gateUsage, gridFor, levelPar, type Evaluation } from '../../core/level/validate';
import { ppaOf } from '../../core/scoring/design';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { Particles, drawGlow } from '../../render/fx';
import { drawGateSymbol } from '../../render/gate-symbol';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { GamePointer } from '../../input/pointer';
import type { Scene } from '../../scene';
import { cellAtPoint, layoutDesign, stepCells, tableColAtPoint, type DesignLayout } from './layout';

export type Tool = 'wire' | 'gate' | 'via' | 'erase';
type PassResult = Extract<Evaluation, { status: 'pass' }>;

export interface DesignSceneDeps {
  /** lớp DOM để gắn thanh công cụ */
  ui: HTMLElement;
  audio: GameAudio;
  /** gọi khi qua màn (main hiện thẻ kết quả + lưu tiến độ) */
  onPass: (level: DesignLevel, result: PassResult) => void;
}

const LAYER_COL = ['#3d7fd6', '#a07cff'] as const; // lớp 1: xanh đồng; lớp 2: tím
const BIT0 = '#26355f';
const UNDO_MAX = 60;

const TOOL_HINT: Record<Tool, string> = {
  wire: 'Kéo từ ô này sang ô bên cạnh để nối dây.',
  gate: 'Chọn cổng rồi chạm vào ô trống. Chạm cổng đã đặt để xoay chân ra.',
  via: 'Chạm ô để đặt/gỡ via: nối dây lớp 1 với lớp 2.',
  erase: 'Chạm hoặc kéo để xoá dây, via, cổng ở lớp đang chọn.',
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class DesignScene implements Scene {
  readonly grid: Grid;
  private layout: DesignLayout;
  private readonly pcb = new PcbBackdrop(1011, { pulses: 6, intensity: 0.6 });
  private readonly particles = new Particles(60);
  tool: Tool = 'wire';
  layer = 0;
  gateType: GateType | null = null;
  inputs: Bit[];
  private undo: GridState[] = [];
  private drag: { id: number; last: [number, number]; start: [number, number]; changed: boolean; snap: GridState } | null = null;

  // kết quả mô phỏng trực tiếp
  private circuit: CompiledCircuit | null = null;
  private nodeNet = new Map<string, number>(); // "lớp:ô" → chỉ số net
  /** hướng dòng tín hiệu trên từng đoạn dây: khoá "lớp:ô nhỏ:ô lớn" → true nếu chảy từ ô nhỏ sang ô lớn */
  private flow = new Map<string, boolean>();
  private netVals: Uint8Array | null = null;
  private actualRows: Bit[][] | null = null;
  /** true = mạch hợp lệ hoàn toàn (không phải mô phỏng tạm khi đang vẽ dở) */
  private strict = false;
  private extraInputs = 0;
  private undriven = new Set<number>();

  private problemNodes: NetNode[] = [];
  private problemT = 0;
  private wrongCols: number[] = [];
  private passed = false;
  /** đã xem lời giải AI trong lượt chơi màn này (qua màn sau đó không tính kết quả) */
  aiShown = false;
  private time = 0;
  private surf: RenderSurface | null = null;
  private readonly expected: Bit[][];

  // DOM
  private readonly bar: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly msg: HTMLDivElement;
  private readonly ctxRow: HTMLDivElement;
  private readonly toolBtns = new Map<Tool, HTMLButtonElement>();
  private layerBtn: HTMLButtonElement | null = null;
  private undoBtn!: HTMLButtonElement;
  private msgTimer = 0;
  private readonly onKey = (e: KeyboardEvent): void => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      this.doUndo();
    }
  };

  constructor(
    readonly level: DesignLevel,
    private readonly deps: DesignSceneDeps,
  ) {
    this.grid = gridFor(level);
    this.inputs = level.grid.inputs.map(() => 0 as Bit);
    this.expected = expectedRows(level).map((r) => r.outputs);
    this.layout = layoutDesign(360, 640, level.grid.cols, level.grid.rows, level.grid.inputs.length, level.grid.outputs.length);
    this.bar = h('div', 'design-bar');
    // dải phía trên thanh công cụ: bình thường hiện gợi ý / chọn cổng; có thông báo thì thông báo đè lên
    this.strip = h('div', 'design-strip');
    this.msg = h('div', 'design-msg');
    this.msg.setAttribute('role', 'status');
    this.ctxRow = h('div', 'design-ctx');
    this.strip.append(this.ctxRow, this.msg);
    this.buildToolbar();
    this.recompute();
  }

  // ---------------- DOM: thanh công cụ ----------------
  private buildToolbar(): void {
    const btn = (label: string, cls = ''): HTMLButtonElement => {
      const b = h('button', `btn tool ${cls}`.trim(), label);
      b.type = 'button';
      return b;
    };
    const tools = h('div', 'design-row');
    const add = (t: Tool, label: string): void => {
      const b = btn(label);
      b.addEventListener('click', () => this.setTool(t));
      this.toolBtns.set(t, b);
      tools.append(b);
    };
    add('wire', 'Dây');
    if (Object.keys(this.level.gatesAllowed).length > 0) add('gate', 'Cổng');
    if (this.level.grid.layers === 2) add('via', 'Via');
    add('erase', 'Tẩy');
    if (this.level.grid.layers === 2) {
      const lb = btn('Lớp 1', 'layer');
      lb.addEventListener('click', () => {
        this.layer = this.layer === 0 ? 1 : 0;
        this.syncToolbar();
      });
      this.layerBtn = lb;
      tools.append(lb);
    }
    const actions = h('div', 'design-row');
    this.undoBtn = btn('Hoàn tác');
    this.undoBtn.addEventListener('click', () => this.doUndo());
    const clear = btn('Xoá hết');
    clear.addEventListener('click', () => {
      if (this.grid.wires().length + this.grid.gates().length + this.grid.vias().length === 0) return;
      this.pushUndo();
      this.grid.clear();
      this.changed();
    });
    const check = btn('KIỂM TRA', 'btn-primary check');
    check.addEventListener('click', () => this.check());
    actions.append(this.undoBtn, clear, check);
    this.bar.append(tools, actions);
    this.syncToolbar();
  }

  private setTool(t: Tool): void {
    this.tool = t;
    this.hideMsg();
    if (t === 'gate' && !this.gateType) this.gateType = (Object.keys(this.level.gatesAllowed)[0] as GateType) ?? null;
    this.syncToolbar();
  }

  private syncToolbar(): void {
    for (const [t, b] of this.toolBtns) {
      b.classList.toggle('active', t === this.tool);
      b.setAttribute('aria-pressed', String(t === this.tool));
    }
    if (this.layerBtn) {
      this.layerBtn.textContent = `Lớp ${this.layer + 1}`;
      this.layerBtn.classList.toggle('layer2', this.layer === 1);
      this.layerBtn.setAttribute('aria-label', `Đang vẽ ở lớp ${this.layer + 1}, chạm để đổi lớp`);
    }
    this.undoBtn.disabled = this.undo.length === 0;
    this.ctxRow.replaceChildren();
    if (this.tool === 'gate') {
      const used = gateUsage(this.grid);
      for (const [t, n] of Object.entries(this.level.gatesAllowed) as [GateType, number][]) {
        const left = n - (used[t] ?? 0);
        const chip = h('button', `btn chip${t === this.gateType ? ' active' : ''}`, `${t} ×${left}`);
        chip.type = 'button';
        chip.disabled = left <= 0 && t !== this.gateType;
        chip.setAttribute('aria-pressed', String(t === this.gateType));
        chip.addEventListener('click', () => {
          this.gateType = t;
          this.syncToolbar();
        });
        this.ctxRow.append(chip);
      }
    } else {
      this.ctxRow.append(h('span', 'design-hint', TOOL_HINT[this.tool]));
    }
  }

  /** Thông báo ngắn trên thanh công cụ. kind: info | bad | good */
  private say(text: string, kind: 'info' | 'bad' | 'good' = 'info', seconds = 4): void {
    this.msg.textContent = text;
    this.msg.dataset.kind = kind;
    this.msg.hidden = false;
    this.ctxRow.hidden = true;
    window.clearTimeout(this.msgTimer);
    this.msgTimer = window.setTimeout(() => this.hideMsg(), seconds * 1000);
  }

  private hideMsg(): void {
    this.msg.hidden = true;
    this.ctxRow.hidden = false;
  }

  // ---------------- vòng đời scene ----------------
  enter(s: RenderSurface): void {
    this.deps.ui.append(this.bar, this.strip);
    this.hideMsg();
    window.addEventListener('keydown', this.onKey);
    this.surf = s;
    this.say(this.level.intro, 'info', 7);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
    window.clearTimeout(this.msgTimer);
    this.bar.remove();
    this.strip.remove();
  }

  pause(): void {
    /* không có đồng hồ; có pause() để nút Dừng mở bảng tạm dừng (Về màn chính) */
  }

  resume(): void {}

  // ---------------- chỉnh sửa ----------------
  private pushUndo(snap: GridState = this.grid.state()): void {
    this.undo.push(snap);
    if (this.undo.length > UNDO_MAX) this.undo.shift();
  }

  private doUndo(): void {
    const st = this.undo.pop();
    if (!st) return;
    this.grid.load(st);
    this.changed();
  }

  /** Gọi sau mọi thay đổi lưới. */
  private changed(): void {
    this.passed = false;
    this.problemNodes = [];
    this.wrongCols = [];
    this.recompute();
    this.syncToolbar();
  }

  /**
   * Mô phỏng lại sau mỗi thay đổi.
   * - Mạch hợp lệ: tính giá trị mọi net cho hàng đầu vào hiện tại + cả bảng chân trị.
   * - Mạch chỉ còn lỗi "dây chưa có nguồn" (đang vẽ dở): vẫn mô phỏng, coi dây đó = chưa xác định,
   *   để người chơi thấy tín hiệu chạy dọc dây ngay khi vẽ thay vì phải nối xong mới thấy.
   */
  private recompute(): void {
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
    this.actualRows = this.strict ? truthTable(c).map((r) => r.outputs) : null;
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
  private valueAt(layer: number, cell: number): Bit | null {
    if (!this.netVals) return null;
    const idx = this.nodeNet.get(`${layer}:${cell}`);
    if (idx === undefined || this.undriven.has(idx)) return null;
    return this.netVals[idx] as Bit;
  }

  private currentRow(): number {
    return this.inputs.reduce<number>((acc, b) => (acc << 1) | b, 0);
  }

  private evalCurrent(): void {
    if (!this.circuit) return;
    // đầu vào phụ (dây chưa có nguồn) nằm ở các bit thấp, luôn = 0
    this.netVals = evaluateRow(this.circuit, this.currentRow() << this.extraInputs);
  }

  private ledValues(): (Bit | null)[] {
    const c = this.circuit;
    const v = this.netVals;
    if (!c || !v) return this.level.grid.outputs.map(() => null);
    return c.outputIdx.map((i) => (this.undriven.has(i) ? null : (v[i] as Bit)));
  }

  private check(): void {
    const e = evaluateDesign(this.level, this.grid);
    if (e.status === 'invalid') {
      this.problemNodes = e.problems.flatMap((p) => p.nodes);
      this.problemT = 3;
      const more = e.problems.length > 1 ? ` (và ${e.problems.length - 1} lỗi khác)` : '';
      this.say(`${e.problems[0]?.message ?? 'Mạch chưa hợp lệ.'}${more}`, 'bad', 5);
      this.deps.audio.play('error');
      return;
    }
    if (e.status === 'wrong') {
      this.wrongCols = e.comparison.wrongRows;
      this.say(`Mạch chạy được nhưng mới đúng ${e.comparison.correctRows}/${e.comparison.totalRows} hàng. Xem các cột có dấu X đỏ trong bảng.`, 'bad', 5);
      this.deps.audio.play('error');
      return;
    }
    this.passed = true;
    this.hideMsg();
    this.deps.audio.play('ting');
    const L = this.layout;
    if (this.surf && !this.surf.reducedMotion) {
      for (const cell of this.grid.outputCells) {
        const [c, r] = this.grid.colRow(cell);
        this.particles.burst(L.grid.x + (c + 0.5) * L.grid.cell, L.grid.y + (r + 0.5) * L.grid.cell, THEME.bit1, 24, { speed: 260 });
      }
      this.pcb.burst(6);
    }
    window.setTimeout(() => this.deps.onPass(this.level, e), 700);
  }

  // ---------------- thao tác chạm ----------------
  onPointer(p: GamePointer): void {
    const L = this.layout;
    if (p.phase === 'down') {
      const col = tableColAtPoint(L, p.x, p.y);
      if (col >= 0) {
        // chạm cột bảng chân trị = đặt công tắc theo hàng đó
        const n = this.inputs.length;
        this.inputs = this.inputs.map((_, i) => ((col >> (n - 1 - i)) & 1) as Bit);
        this.evalCurrent();
        this.deps.audio.play('tick');
        return;
      }
      const at = cellAtPoint(L, p.x, p.y);
      if (!at) return;
      const cell = this.grid.cellAt(at[0], at[1]);
      if (this.tool === 'gate') return this.tapGate(cell);
      if (this.tool === 'via') {
        const snap = this.grid.state();
        if (this.grid.toggleVia(cell)) {
          this.pushUndo(snap);
          this.deps.audio.play('tick');
          this.changed();
        } else if (this.grid.pins.has(cell) || this.grid.gateAt(cell) || this.grid.blocked.has(cell)) {
          this.say('Via chỉ đặt được ở ô trống (không phải chân, cổng hay vật cản).', 'bad', 3);
        }
        return;
      }
      this.drag = { id: p.id, last: at, start: at, changed: false, snap: this.grid.state() };
      if (this.tool === 'erase') this.eraseAt(cell);
      return;
    }
    if (!this.drag || p.id !== this.drag.id) return;
    if (p.phase === 'move') {
      const at = cellAtPoint(L, p.x, p.y);
      if (!at || (at[0] === this.drag.last[0] && at[1] === this.drag.last[1])) return;
      // chỉ nhận ô mới khi ngón tay đã vào gần tâm ô (tránh nhảy ô ở sát mép)
      const cx = L.grid.x + (at[0] + 0.5) * L.grid.cell;
      const cy = L.grid.y + (at[1] + 0.5) * L.grid.cell;
      if (Math.abs(p.x - cx) > L.grid.cell * 0.42 || Math.abs(p.y - cy) > L.grid.cell * 0.42) return;
      for (const step of stepCells(this.drag.last, at)) {
        const a = this.grid.cellAt(this.drag.last[0], this.drag.last[1]);
        const b = this.grid.cellAt(step[0], step[1]);
        if (this.tool === 'wire') {
          if (this.grid.addWire(this.layer, a, b)) {
            this.drag.changed = true;
            this.deps.audio.play('tick');
          } else if (!this.grid.canWire(this.layer, b)) {
            break; // vật cản: dừng ở đây, người chơi kéo vòng
          }
        } else if (this.tool === 'erase') {
          this.eraseAt(b);
        }
        this.drag.last = step;
      }
      if (this.drag.changed) this.recompute();
      return;
    }
    // up / cancel
    const d = this.drag;
    this.drag = null;
    if (d.changed) {
      this.pushUndo(d.snap);
      this.changed();
    } else if (p.phase === 'up' && d.start[0] === d.last[0] && d.start[1] === d.last[1]) {
      // chạm (không kéo) vào công tắc → đổi 0/1
      const cell = this.grid.cellAt(d.start[0], d.start[1]);
      const pin = this.grid.pins.get(cell);
      if (pin?.kind === 'in') {
        const i = this.grid.inputCells.indexOf(cell);
        this.inputs[i] = (this.inputs[i] ? 0 : 1) as Bit;
        this.evalCurrent();
        this.deps.audio.play('tick');
      }
    }
  }

  private eraseAt(cell: number): void {
    if (!this.drag) return;
    const before = this.grid.wireSides(this.layer, cell).length + (this.grid.hasVia(cell) ? 1 : 0) + (this.layer === 0 && this.grid.gateAt(cell) ? 1 : 0);
    if (before === 0) return;
    this.grid.eraseCell(this.layer, cell);
    this.drag.changed = true;
    this.deps.audio.play('tick');
    this.recompute();
  }

  private tapGate(cell: number): void {
    const g = this.grid.gateAt(cell);
    if (g) {
      // xoay chân ra 90° theo chiều kim đồng hồ
      this.pushUndo();
      this.grid.removeGate(cell);
      this.grid.placeGate(cell, g.type, ((g.out + 1) % 4) as Side);
      this.deps.audio.play('tick');
      this.changed();
      return;
    }
    const t = this.gateType;
    if (!t) return;
    const left = (this.level.gatesAllowed[t] ?? 0) - (gateUsage(this.grid)[t] ?? 0);
    if (left <= 0) return this.say(`Đã dùng hết cổng ${t}. Tẩy bớt hoặc chọn cổng khác.`, 'bad', 3);
    if (!this.grid.canPlaceGate(cell)) return this.say('Cổng chỉ đặt được ở ô trống.', 'bad', 3);
    this.pushUndo();
    this.grid.placeGate(cell, t, 0);
    this.deps.audio.play('tick');
    this.changed();
  }

  // ---------------- vòng lặp ----------------
  update(dt: number): void {
    this.time += dt;
    this.particles.update(dt);
    if (this.surf) this.pcb.update(dt, this.surf);
    if (this.problemT > 0) this.problemT = Math.max(0, this.problemT - dt);
  }

  render(s: RenderSurface): void {
    this.surf = s;
    const lv = this.level.grid;
    const L = (this.layout = layoutDesign(s.width, s.height, lv.cols, lv.rows, lv.inputs.length, lv.outputs.length));
    const G = L.grid;
    this.pcb.ensure(s, [
      { x: 0, y: 0, w: s.width, h: L.table.y + L.table.rows * L.table.rowH + 8 },
      { x: G.x - 8, y: G.y - 8, w: G.cell * G.cols + 16, h: G.cell * G.rows + 16 },
    ]);
    this.pcb.draw(s);
    const ctx = s.ctx;

    // tiêu đề
    ctx.textAlign = 'left';
    ctx.font = `700 11px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText(`THIẾT KẾ · ${this.level.id.toUpperCase()}`, 16, 22);
    ctx.font = `700 19px ${THEME.font}`;
    ctx.fillStyle = THEME.text;
    ctx.fillText(this.level.name, 16, 46, s.width - 140);

    this.drawTable(s);
    this.drawGrid(s);
    this.particles.draw(ctx);

    // dòng PPA (trực tiếp) + mục tiêu của AI kỹ sư
    ctx.textAlign = 'center';
    ctx.font = `13px ${THEME.font}`;
    const par = levelPar(this.level);
    let line = `AI kỹ sư: chi phí ${par.C}`;
    if (this.circuit && this.strict) {
      const ppa = ppaOf(this.grid, this.circuit);
      line = `Area ${ppa.A} · Delay ${ppa.D} · Power ${ppa.P} → chi phí ${ppa.C}   |   ${line}`;
    }
    ctx.fillStyle = THEME.textDim;
    ctx.fillText(line, s.width / 2, L.ppaY, s.width - 24);
  }

  private drawTable(s: RenderSurface): void {
    const ctx = s.ctx;
    const T = this.layout.table;
    const lv = this.level.grid;
    const labels = [...lv.inputs.map((p) => p.id), ...lv.outputs.map((p) => p.id), ''];
    const cur = this.currentRow();
    // khung
    roundRectPath(ctx, T.x - 6, T.y - 4, T.labelW + T.colW * T.cols + 12, T.rows * T.rowH + 8, 10);
    ctx.fillStyle = 'rgba(11,16,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#1d2647';
    ctx.lineWidth = 1;
    ctx.stroke();
    // cột đang chọn (khớp công tắc)
    roundRectPath(ctx, T.x + T.labelW + cur * T.colW + 2, T.y - 2, T.colW - 4, T.rows * T.rowH + 4, 6);
    ctx.fillStyle = rgba(THEME.bit1, 0.12);
    ctx.fill();
    ctx.textAlign = 'center';
    for (const [i, lab] of labels.entries()) {
      const y = T.y + i * T.rowH + 15;
      const isOut = i >= lv.inputs.length && i < lv.inputs.length + lv.outputs.length;
      ctx.font = `700 12px ${THEME.font}`;
      ctx.fillStyle = isOut ? THEME.accent : THEME.textDim;
      ctx.fillText(lab, T.x + T.labelW / 2, y);
      if (i === labels.length - 1) {
        // hàng đánh dấu: đúng / sai từng cột (vẽ dấu bằng nét, font không có ✓ ✕)
        for (let k = 0; k < T.cols; k++) {
          const cx = T.x + T.labelW + (k + 0.5) * T.colW;
          const actual = this.actualRows?.[k];
          if (!actual) continue;
          const ok = actual.every((v, j) => v === this.expected[k]?.[j]);
          const flagged = this.wrongCols.includes(k);
          ctx.strokeStyle = ok ? THEME.bit1 : flagged ? THEME.error : rgba(THEME.error, 0.7);
          ctx.lineWidth = 2;
          ctx.beginPath();
          if (ok) {
            ctx.moveTo(cx - 5, y - 4);
            ctx.lineTo(cx - 1, y);
            ctx.lineTo(cx + 6, y - 8);
          } else {
            ctx.moveTo(cx - 5, y - 9);
            ctx.lineTo(cx + 5, y + 1);
            ctx.moveTo(cx + 5, y - 9);
            ctx.lineTo(cx - 5, y + 1);
          }
          ctx.stroke();
        }
        continue;
      }
      for (let k = 0; k < T.cols; k++) {
        const cx = T.x + T.labelW + (k + 0.5) * T.colW;
        let v: number;
        if (!isOut) v = (k >> (lv.inputs.length - 1 - i)) & 1;
        else v = this.expected[k]?.[i - lv.inputs.length] ?? 0;
        ctx.font = `700 14px ${THEME.monoFont}`;
        ctx.fillStyle = isOut ? (v ? THEME.accent : rgba(THEME.accent, 0.45)) : v ? THEME.text : THEME.textDim;
        ctx.fillText(String(v), cx, y);
      }
    }
  }

  private wireColor(layer: number, a: number, b: number): string {
    const base = LAYER_COL[layer] ?? LAYER_COL[0];
    if (!this.netVals) return base;
    const key = this.nodeNet.has(`${layer}:${a}`) ? `${layer}:${a}` : `${layer}:${b}`;
    const idx = this.nodeNet.get(key);
    if (idx === undefined || this.undriven.has(idx)) return base;
    return this.netVals[idx] ? (layer === 0 ? THEME.bit1 : '#d6c6ff') : BIT0;
  }

  private drawGrid(s: RenderSurface): void {
    const ctx = s.ctx;
    const G = this.layout.grid;
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
    if (this.problemT > 0) {
      const a = 0.35 + 0.35 * Math.sin(this.time * 8);
      for (const n of this.problemNodes) {
        const [x, y] = center(n.cell);
        roundRectPath(ctx, x - cs * 0.46, y - cs * 0.46, cs * 0.92, cs * 0.92, 8);
        ctx.fillStyle = rgba(THEME.error, a * Math.min(1, this.problemT));
        ctx.fill();
      }
    }
    // dây: lớp đang chọn vẽ sau (nổi lên trên), lớp kia mờ đi
    const order = this.layer === 0 ? [1, 0] : [0, 1];
    ctx.lineCap = 'round';
    for (const layer of order) {
      if (layer >= g.layers) continue;
      ctx.globalAlpha = layer === this.layer || g.layers === 1 ? 1 : 0.45;
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
        ctx.lineDashOffset = -((this.time * cs * 1.4) % (cs * 0.5));
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
      if (outV === 1 && !s.reducedMotion) drawGlow(ctx, THEME.bit1, cs * 0.7, x, y, 0.9 + 0.1 * Math.sin(this.time * 4));
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
    if (this.drag) {
      const [x, y] = center(g.cellAt(this.drag.last[0], this.drag.last[1]));
      roundRectPath(ctx, x - cs / 2 + 2, y - cs / 2 + 2, cs - 4, cs - 4, 8);
      ctx.strokeStyle = rgba(this.tool === 'erase' ? THEME.error : (LAYER_COL[this.layer] ?? THEME.bit1), 0.8);
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.passed) {
      roundRectPath(ctx, G.x - 6, G.y - 6, cs * G.cols + 12, cs * G.rows + 12, 12);
      ctx.strokeStyle = THEME.bit1;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  /** Nạp lời giải của AI kỹ sư lên lưới (sau khi qua màn). Hoàn tác để quay lại mạch của mình. */
  showAiSolution(): void {
    const ai = aiSolutionGrid(this.level);
    if (!ai) return;
    this.aiShown = true;
    this.pushUndo();
    this.grid.load(ai.state());
    this.changed();
    this.passed = true;
    const par = levelPar(this.level);
    this.say(`Lời giải của AI kỹ sư: chi phí ${par.C}. Bấm Hoàn tác để quay lại mạch của bạn.`, 'good', 8);
  }

  /** Cho test tự động: toạ độ tâm ô (CSS px). */
  cellCenter(c: number, r: number): { x: number; y: number } {
    const G = this.layout.grid;
    return { x: G.x + (c + 0.5) * G.cell, y: G.y + (r + 0.5) * G.cell };
  }
}
