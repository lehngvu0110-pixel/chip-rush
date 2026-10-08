// Màn THIẾT KẾ: kéo ngón tay vẽ dây trên lưới 2 lớp, đặt/xoay cổng, via, tẩy, hoàn tác,
// mô phỏng trực tiếp (dây sáng theo bit), kiểm tra bảng chân trị và chấm PPA so với "AI kỹ sư".
// Logic mạch ở core/ (grid, netlist, level); file này chỉ vẽ + nhận thao tác + thanh công cụ DOM.
import type { Grid, GridState, Side } from '../../core/circuit/grid';
import type { NetNode } from '../../core/circuit/netlist';
import type { Bit, GateType } from '../../core/circuit/types';
import type { DesignLevel } from '../../core/level/types';
import { aiSolutionGrid, evaluateDesign, expectedRows, gateUsage, gridFor, levelPar, type Evaluation } from '../../core/level/validate';
import { ppaOf } from '../../core/scoring/design';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { Particles } from '../../render/fx';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { GamePointer } from '../../input/pointer';
import type { Scene } from '../../scene';
import { Board } from './board';
import { nextHint, type Hint } from '../../core/level/hint';
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
  readonly board: Board;
  private layout: DesignLayout;
  private readonly pcb = new PcbBackdrop(1011, { pulses: 6, intensity: 0.6 });
  private readonly particles = new Particles(60);
  tool: Tool = 'wire';
  layer = 0;
  gateType: GateType | null = null;
  private undo: GridState[] = [];
  private drag: { id: number; last: [number, number]; start: [number, number]; changed: boolean; snap: GridState } | null = null;


  private problemNodes: NetNode[] = [];
  private problemT = 0;
  private wrongCols: number[] = [];
  private passed = false;
  /** đã xem lời giải AI trong lượt chơi màn này (qua màn sau đó không tính kết quả) */
  aiShown = false;
  /** đã dùng Gợi ý trong lượt chơi màn này → tối đa 2 sao (SPEC 2) */
  hinted = false;
  private hintArmed = false;
  private ghost: { hint: Hint; t: number } | null = null;
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
    this.board = new Board(gridFor(level));
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

  get grid(): Grid {
    return this.board.grid;
  }

  get inputs(): Bit[] {
    return this.board.inputs;
  }

  private recompute(): void {
    this.board.recompute();
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
    const hintBtn = btn('Gợi ý');
    hintBtn.addEventListener('click', () => this.useHint());
    actions.append(this.undoBtn, clear, hintBtn, check);
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

  private check(): void {
    const e = evaluateDesign(this.level, this.grid, this.hinted);
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
        this.board.inputs = this.inputs.map((_, i) => ((col >> (n - 1 - i)) & 1) as Bit);
        this.board.evalCurrent();
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
        this.board.inputs[i] = (this.inputs[i] ? 0 : 1) as Bit;
        this.board.evalCurrent();
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
    if (this.ghost && (this.ghost.t -= dt) <= 0) this.ghost = null;
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
    this.board.draw(s, L.grid, { time: this.time, layer: this.layer, tool: this.tool, drag: this.drag, problemNodes: this.problemNodes, problemT: this.problemT, passed: this.passed, ghost: this.ghost?.hint ?? null });
    this.particles.draw(ctx);

    // dòng PPA (trực tiếp) + mục tiêu của AI kỹ sư
    ctx.textAlign = 'center';
    ctx.font = `13px ${THEME.font}`;
    const par = levelPar(this.level);
    let line = `AI kỹ sư: chi phí ${par.C}`;
    if (this.board.circuit && this.board.strict) {
      const ppa = ppaOf(this.grid, this.board.circuit);
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
    const cur = this.board.currentRow();
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
          const actual = this.board.actualRows?.[k];
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

  /**
   * Gợi ý: lần bấm đầu chỉ cảnh báo (dùng gợi ý → tối đa 2 sao), lần sau mới hiện bước kế tiếp
   * của lời giải AI kỹ sư dưới dạng bóng mờ màu cam, và tự chuyển sang công cụ phù hợp.
   */
  private useHint(): void {
    if (!this.hinted && !this.hintArmed) {
      this.hintArmed = true;
      this.say('Dùng gợi ý thì màn này tối đa 2 sao. Bấm Gợi ý lần nữa để xem bước tiếp theo.', 'info', 5);
      return;
    }
    const ai = aiSolutionGrid(this.level);
    if (!ai) return;
    const h = nextHint(this.grid, ai.state());
    this.hinted = true;
    if (!h) {
      this.say('Mạch của bạn đã có đủ các phần của lời giải AI. Bấm KIỂM TRA (hoặc xoá phần thừa).', 'good', 5);
      return;
    }
    this.ghost = { hint: h, t: 8 };
    this.deps.audio.play('tick');
    if (h.kind === 'gate') {
      this.gateType = h.type;
      this.setTool('gate');
      const dir = ['phải', 'dưới', 'trái', 'trên'][h.out];
      this.say(
        h.replace
          ? `Gợi ý: ô sáng cam cần cổng ${h.type}, chân ra hướng ${dir}. Chạm cổng cũ để xoay, hoặc tẩy rồi đặt lại.`
          : `Gợi ý: đặt cổng ${h.type} vào ô sáng cam, rồi chạm lại để xoay chân ra hướng ${dir}.`,
        'good',
        7,
      );
    } else if (h.kind === 'via') {
      this.setTool('via');
      this.say('Gợi ý: đặt via vào ô sáng cam để nối lớp 1 với lớp 2.', 'good', 6);
    } else {
      this.layer = h.layer;
      this.setTool('wire');
      this.say(`Gợi ý: nối dây giữa 2 ô sáng cam (lớp ${h.layer + 1}).`, 'good', 6);
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
