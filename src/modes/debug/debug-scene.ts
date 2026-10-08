// Màn KIỂM THỬ: chip có đúng 1 lỗi ẩn. Công tắc và đèn xem miễn phí; chạm 1 dây = 1 lần ĐO (đọc giá trị
// dây ở hàng đầu vào đang đặt). Tìm ra lỗi rồi BÁO: đúng → qua màn; báo sai 2 lần hoặc đo quá giới hạn → thua.
// Lõi: core/debug (lớp lỗi), core/level/debug-setup (dựng màn, chấm), ai/debug-solver (par minimax).
import type { NetNode } from '../../core/circuit/netlist';
import type { Bit, Fault } from '../../core/circuit/types';
import { debugSetup, debugStars, isCorrectAnswer, probeLimit, type DebugSetup } from '../../core/level/debug-setup';
import type { DebugLevel } from '../../core/level/types';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { Particles } from '../../render/fx';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { GamePointer } from '../../input/pointer';
import type { Scene } from '../../scene';
import { Board } from '../design/board';
import { debugCoach, goldenValue, type CoachStep } from '../../core/tutorial';
import { cellAtPoint, layoutDesign, tableColAtPoint, type DesignLayout } from '../design/layout';

export type DebugTool = 'probe' | 'report';

export interface DebugResult {
  win: boolean;
  probes: number;
  par: number;
  stars: number;
  wrong: number;
  /** lý do thua (để hiện) */
  reason?: string;
  /** mô tả lỗi thật */
  answer: string;
}

export interface DebugSceneDeps {
  ui: HTMLElement;
  audio: GameAudio;
  onEnd: (level: DebugLevel, r: DebugResult) => void;
  /** hướng dẫn lần đầu: AI chỉ dây nên đo tiếp và giải thích kết quả đo (không trừ sao) */
  tutorial?: boolean;
}

interface Probe {
  net: number;
  row: number;
  value: Bit;
  cell: number;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const TOOL_HINT: Record<DebugTool, string> = {
  probe: 'Chạm một DÂY để đo giá trị ở hàng đầu vào đang đặt (tốn 1 lần đo). Đổi công tắc thì miễn phí.',
  report: 'Chạm vào chỗ nghi hỏng rồi bấm nút báo lỗi bên dưới. Báo sai 2 lần là thua.',
};

export class DebugScene implements Scene {
  readonly setup: DebugSetup;
  readonly board: Board;
  private layout: DesignLayout;
  private readonly pcb = new PcbBackdrop(2610, { pulses: 6, intensity: 0.6 });
  private readonly particles = new Particles(60);
  tool: DebugTool = 'probe';
  probes: Probe[] = [];
  wrong = 0;
  private selected: { cell: number; net?: number } | null = null;
  private reveal: NetNode[] = [];
  private ended = false;
  private time = 0;
  private surf: RenderSurface | null = null;
  private readonly expected: Bit[][];
  readonly limit: number;

  // DOM
  private readonly bar: HTMLDivElement;
  private readonly strip: HTMLDivElement;
  private readonly msg: HTMLDivElement;
  private readonly hint: HTMLSpanElement;
  private readonly ctxBox: HTMLDivElement;
  private readonly toolBtns = new Map<DebugTool, HTMLButtonElement>();
  private readonly answerBtns: HTMLButtonElement[] = [];
  private msgTimer = 0;
  /** hướng dẫn lần đầu (null = tắt) */
  coach: CoachStep | null = null;

  constructor(
    readonly level: DebugLevel,
    private readonly deps: DebugSceneDeps,
  ) {
    this.setup = debugSetup(level);
    this.board = new Board(this.setup.grid);
    this.board.recompute();
    this.expected = (this.board.actualRows ?? []).map((r) => [...r]); // mạch CHƯA hỏng
    this.board.fault = this.setup.fault;
    this.board.recompute();
    this.limit = probeLimit(this.setup.par);
    const lv = level.grid;
    this.layout = layoutDesign(360, 640, lv.cols, lv.rows, lv.inputs.length, lv.outputs.length * 2);

    this.bar = h('div', 'design-bar');
    this.strip = h('div', 'design-strip');
    this.msg = h('div', 'design-msg');
    this.msg.setAttribute('role', 'status');
    this.hint = h('span', 'design-hint');
    this.ctxBox = h('div', 'design-ctx');
    this.ctxBox.append(this.hint);
    this.strip.append(this.ctxBox, this.msg);
    const tools = h('div', 'design-row');
    for (const [t, label] of [['probe', 'Đo'], ['report', 'Báo lỗi']] as const) {
      const b = h('button', 'btn tool', label);
      b.type = 'button';
      b.addEventListener('click', () => this.setTool(t));
      this.toolBtns.set(t, b);
      tools.append(b);
    }
    const actions = h('div', 'design-row');
    if (level.model === 'gate-invert') {
      const b = h('button', 'btn btn-primary check wide', 'BÁO: CỔNG NÀY HỎNG');
      b.type = 'button';
      b.addEventListener('click', () => this.submit());
      this.answerBtns.push(b);
    } else {
      for (const v of [0, 1] as const) {
        const b = h('button', `btn ${v ? 'btn-primary check' : 'check'}`, `BÁO: KẸT Ở ${v}`);
        b.type = 'button';
        b.addEventListener('click', () => this.submit(v));
        this.answerBtns.push(b);
      }
    }
    actions.append(...this.answerBtns);
    this.bar.append(tools, actions);
    this.sync();
  }

  get grid() {
    return this.board.grid;
  }

  private setTool(t: DebugTool): void {
    this.tool = t;
    this.hideMsg();
    this.sync();
    this.toolBtns.get('report')?.classList.toggle('tut-pulse', this.coach?.next === null && t !== 'report' && !this.ended);
  }

  private sync(): void {
    for (const [t, b] of this.toolBtns) {
      b.classList.toggle('active', t === this.tool);
      b.setAttribute('aria-pressed', String(t === this.tool));
    }
    this.hint.textContent = TOOL_HINT[this.tool];
    for (const b of this.answerBtns) b.disabled = !this.selected || this.ended;
  }

  private say(text: string, kind: 'info' | 'bad' | 'good' = 'info', seconds = 4): void {
    this.msg.textContent = text;
    this.msg.dataset.kind = kind;
    this.msg.hidden = false;
    this.ctxBox.hidden = true;
    window.clearTimeout(this.msgTimer);
    this.msgTimer = window.setTimeout(() => this.hideMsg(), seconds * 1000);
  }

  private hideMsg(): void {
    this.msg.hidden = true;
    this.ctxBox.hidden = false;
  }

  enter(s: RenderSurface): void {
    this.surf = s;
    this.deps.ui.append(this.bar, this.strip);
    if (this.deps.tutorial) this.updateCoach(`${this.level.intro} `);
    else this.say(this.level.intro, 'info', 8);
  }

  exit(): void {
    window.clearTimeout(this.msgTimer);
    this.bar.remove();
    this.strip.remove();
  }

  pause(): void {}
  resume(): void {}

  private rowLabel(row: number): string {
    const ids = this.level.grid.inputs.map((p) => p.id);
    return ids.map((id, i) => `${id}=${(row >> (ids.length - 1 - i)) & 1}`).join(', ');
  }

  // ---------------- thao tác ----------------
  onPointer(p: GamePointer): void {
    if (p.phase !== 'down' || this.ended) return;
    const L = this.layout;
    const col = tableColAtPoint(L, p.x, p.y);
    if (col >= 0) {
      const n = this.board.inputs.length;
      this.board.inputs = this.board.inputs.map((_, i) => ((col >> (n - 1 - i)) & 1) as Bit);
      this.board.evalCurrent();
      this.deps.audio.play('tick');
      if (this.coach) this.updateCoach();
      return;
    }
    const at = cellAtPoint(L, p.x, p.y);
    if (!at) return;
    const g = this.grid;
    const cell = g.cellAt(at[0], at[1]);
    const pin = g.pins.get(cell);
    if (pin?.kind === 'in') {
      const i = g.inputCells.indexOf(cell);
      this.board.inputs[i] = (this.board.inputs[i] ? 0 : 1) as Bit;
      this.board.evalCurrent();
      this.deps.audio.play('tick');
      if (this.coach) this.updateCoach();
      return;
    }
    if (this.tool === 'probe') return this.probeAt(cell, pin?.kind === 'out');
    this.selectAt(cell);
  }

  private netOfCell(cell: number, table: Map<string, number>): number | undefined {
    return table.get(`0:${cell}`) ?? table.get(`1:${cell}`);
  }

  private probeAt(cell: number, isLed: boolean): void {
    if (isLed) return this.say('Đèn đã hiện sẵn giá trị, không cần đo.', 'info', 3);
    if (this.grid.gateAt(cell)) return this.say('Chạm vào DÂY để đo, không phải cổng.', 'info', 3);
    const net = this.netOfCell(cell, this.setup.probeCells);
    if (net === undefined) return;
    const row = this.board.currentRow();
    const v = (this.board.netVals?.[net] ?? 0) as Bit;
    if (this.probes.some((q) => q.net === net && q.row === row)) {
      this.say(`Dây này ở hàng (${this.rowLabel(row)}) đã đo rồi: ${v}. Không tính thêm.`, 'info', 3);
      return;
    }
    this.probes.push({ net, row, value: v, cell });
    this.deps.audio.play('probe');
    if (this.surf && !this.surf.reducedMotion) {
      const G = this.layout.grid;
      const [c, r] = this.grid.colRow(cell);
      this.particles.burst(G.x + (c + 0.5) * G.cell, G.y + (r + 0.5) * G.cell, v ? THEME.bit1 : '#7f93bf', 8, { speed: 120, size: 5 });
    }
    if (this.probes.length > this.limit) {
      this.finish(false, `Đã đo ${this.probes.length} lần, quá giới hạn ${this.limit}.`);
      return;
    }
    if (this.coach) {
      // giải thích bằng cách so với mạch chuẩn — đây chính là suy luận "chia đôi" mà AI kỹ sư dùng
      const w = goldenValue(this.setup, net, row);
      const why =
        v === w
          ? `Dây = ${v}, mạch chuẩn cũng = ${w} → lỗi nằm phía SAU dây này. `
          : `Dây = ${v} nhưng mạch chuẩn = ${w} → lỗi nằm phía TRƯỚC dây này. `;
      this.updateCoach(why);
      return;
    }
    this.say(`Đo lần ${this.probes.length}: dây = ${v} khi ${this.rowLabel(row)}.`, 'info', 4);
  }

  /**
   * Hướng dẫn lần đầu: tính lại phép đo tối ưu tiếp theo trên các lớp lỗi còn khớp với kết quả đo,
   * rồi nói người chơi làm gì (đổi hàng đầu vào → đo dây viền cam → báo lỗi).
   */
  private updateCoach(prefix = ''): void {
    if (this.ended) return;
    const c = debugCoach(this.setup, this.probes);
    this.coach = c;
    const reportBtn = this.toolBtns.get('report');
    reportBtn?.classList.toggle('tut-pulse', c.next === null && this.tool !== 'report');
    if (c.next === null) {
      const what = this.level.model === 'gate-invert' ? 'cổng' : 'dây';
      this.say(`${prefix}Chỉ còn 1 khả năng! Chọn "Báo lỗi", chạm ${what} bạn nghĩ là hỏng rồi bấm nút BÁO.`, 'good', 60);
      return;
    }
    const left = `Còn ${c.remaining} chỗ nghi hỏng.`;
    if (this.board.currentRow() !== c.next.row) {
      this.say(`${prefix}${left} Chạm cột ${this.rowLabel(c.next.row)} (viền cam) trong bảng để đặt đầu vào trước khi đo.`, 'info', 60);
    } else {
      if (this.tool !== 'probe') this.setTool('probe');
      this.say(`${prefix}${left} Chạm dây viền cam để đo (AI chọn dây chia đôi số chỗ nghi).`, 'info', 60);
    }
  }

  private selectAt(cell: number): void {
    const g = this.grid;
    if (this.level.model === 'gate-invert') {
      if (!g.gateAt(cell)) return this.say('Lỗi ở màn này nằm trong một CỔNG: chạm vào cổng nghi hỏng.', 'info', 3);
      this.selected = { cell };
    } else {
      // kẹt có thể ở dây bất kỳ, kể cả dây vào đèn
      const net = this.netOfCell(cell, this.board.nodeNet);
      if (net === undefined || g.gateAt(cell)) return this.say('Lỗi ở màn này là một DÂY bị kẹt: chạm vào dây nghi hỏng.', 'info', 3);
      this.selected = { cell, net };
    }
    this.deps.audio.play('tick');
    this.sync();
  }

  private submit(value?: 0 | 1): void {
    if (!this.selected || this.ended) return;
    const c = this.setup.group.circuit;
    let answer: Fault;
    if (this.level.model === 'gate-invert') {
      const [col, row] = this.grid.colRow(this.selected.cell);
      answer = { kind: 'gate-invert', gate: `g${col}_${row}` };
    } else {
      const name = c.nets[this.selected.net ?? -1];
      if (name === undefined) return;
      answer = { kind: 'stuck-at', net: name, value: value ?? 0 };
    }
    if (isCorrectAnswer(this.setup, answer)) {
      this.deps.audio.play('win');
      this.finish(true);
      return;
    }
    this.wrong++;
    this.deps.audio.play('error');
    this.selected = null;
    this.sync();
    if (this.wrong >= 2) this.finish(false, 'Báo sai 2 lần.');
    else this.say('Chưa đúng! Còn 1 lần báo. Đo thêm cho chắc nhé.', 'bad', 5);
  }

  /** Mô tả lỗi thật để hiện khi kết thúc. */
  describeFault(): string {
    const f = this.setup.fault;
    if (f.kind === 'gate-invert') {
      const gt = this.grid.gates().find((g) => {
        const [c, r] = this.grid.colRow(g.cell);
        return `g${c}_${r}` === f.gate;
      });
      return `cổng ${gt?.type ?? ''} cho ra ngược`;
    }
    return `một dây bị kẹt ở ${f.value}`;
  }

  /** Các ô của lỗi thật — gồm cả các lỗi TƯƠNG ĐƯƠNG (cùng lớp), vì báo lỗi nào trong lớp cũng đúng. */
  private faultNodes(): NetNode[] {
    const cls = this.setup.group.classes[this.setup.group.trueClass] ?? [this.setup.fault];
    const out: NetNode[] = [];
    for (const f of cls) {
      if (f.kind === 'gate-invert') {
        const gt = this.grid.gates().find((g) => {
          const [c, r] = this.grid.colRow(g.cell);
          return `g${c}_${r}` === f.gate;
        });
        if (gt) out.push({ layer: 0, cell: gt.cell });
        continue;
      }
      const idx = this.setup.group.circuit.netIndex.get(f.net);
      for (const [k, i] of this.board.nodeNet) {
        if (i !== idx) continue;
        const [layer, cell] = k.split(':').map(Number) as [number, number];
        if (!this.grid.pins.has(cell)) out.push({ layer, cell });
      }
    }
    return out;
  }

  private finish(win: boolean, reason?: string): void {
    this.ended = true;
    this.sync();
    this.toolBtns.get('report')?.classList.remove('tut-pulse');
    this.reveal = this.faultNodes();
    if (win && this.surf && !this.surf.reducedMotion) {
      const G = this.layout.grid;
      for (const n of this.reveal) {
        const [c, r] = this.grid.colRow(n.cell);
        this.particles.burst(G.x + (c + 0.5) * G.cell, G.y + (r + 0.5) * G.cell, THEME.accent, 16, { speed: 220 });
      }
      this.pcb.burst(6, THEME.accent);
    }
    const probes = this.probes.length;
    const result: DebugResult = {
      win,
      probes,
      par: this.setup.par,
      wrong: this.wrong,
      stars: win ? debugStars(probes, this.setup.par) : 0,
      reason,
      answer: this.describeFault(),
    };
    if (!win) this.deps.audio.play('lose');
    if (!win) this.say(`${reason ?? ''} Lỗi thật: ${result.answer} (tô màu trên mạch).`, 'bad', 6);
    window.setTimeout(() => this.deps.onEnd(this.level, result), win ? 800 : 1800);
  }

  // ---------------- vẽ ----------------
  update(dt: number): void {
    this.time += dt;
    this.particles.update(dt);
    if (this.surf) this.pcb.update(dt, this.surf);
  }

  render(s: RenderSurface): void {
    this.surf = s;
    const lv = this.level.grid;
    const L = (this.layout = layoutDesign(s.width, s.height, lv.cols, lv.rows, lv.inputs.length, lv.outputs.length * 2));
    const G = L.grid;
    this.pcb.ensure(s, [
      { x: 0, y: 0, w: s.width, h: L.table.y + L.table.rows * L.table.rowH + 8 },
      { x: G.x - 8, y: G.y - 8, w: G.cell * G.cols + 16, h: G.cell * G.rows + 16 },
    ]);
    this.pcb.draw(s);
    const ctx = s.ctx;
    ctx.textAlign = 'left';
    ctx.font = `700 11px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText(`KIỂM THỬ · ${this.level.id.toUpperCase()}`, 16, 22);
    ctx.font = `700 19px ${THEME.font}`;
    ctx.fillStyle = THEME.text;
    ctx.fillText(this.level.name, 16, 46, s.width - 140);

    this.drawTable(s);
    const row = this.board.currentRow();
    const marks = this.probes
      .filter((q) => q.row === row)
      .map((q) => ({ cell: q.cell, text: String(q.value), color: q.value ? THEME.bit1 : '#9aa6c8' }));
    this.board.draw(s, G, {
      time: this.time,
      layer: 0,
      problemNodes: this.reveal,
      problemT: this.ended ? 3 : 0,
      passed: false,
      marks,
      selected: this.selected ? [this.selected.cell] : [],
      guide: this.coachGuide(),
    });
    this.particles.draw(ctx);

    ctx.textAlign = 'center';
    ctx.font = `13px ${THEME.font}`;
    ctx.fillStyle = this.probes.length > this.setup.par ? THEME.accent : THEME.textDim;
    ctx.fillText(`Đã đo ${this.probes.length} / tối đa ${this.limit}   ·   Báo sai ${this.wrong}/2   ·   AI kỹ sư cần ${this.setup.par} lần đo`, s.width / 2, L.ppaY, s.width - 24);
  }

  /** Ô dây cần đo tiếp (khi đã đặt đúng hàng đầu vào). */
  private coachGuide(): { wires: never[]; finger: null; cells: number[] } | null {
    const m = this.coach?.next;
    if (!m || this.ended || this.board.currentRow() !== m.row) return null;
    const cells: number[] = [];
    for (const [key, net] of this.setup.probeCells) {
      if (net !== m.net) continue;
      const cell = Number(key.split(':')[1]);
      if (!cells.includes(cell)) cells.push(cell);
    }
    return { wires: [], finger: null, cells };
  }

  /** Bảng chân trị: mỗi cột 1 hàng đầu vào; mỗi đèn có 2 dòng — CHUẨN (cam) và THẬT (đèn đang hiện). */
  private drawTable(s: RenderSurface): void {
    const ctx = s.ctx;
    const T = this.layout.table;
    const lv = this.level.grid;
    const nIn = lv.inputs.length;
    const cur = this.board.currentRow();
    roundRectPath(ctx, T.x - 6, T.y - 4, T.labelW + T.colW * T.cols + 12, T.rows * T.rowH + 8, 10);
    ctx.fillStyle = 'rgba(11,16,36,0.85)';
    ctx.fill();
    ctx.strokeStyle = '#1d2647';
    ctx.lineWidth = 1;
    ctx.stroke();
    roundRectPath(ctx, T.x + T.labelW + cur * T.colW + 2, T.y - 2, T.colW - 4, T.rows * T.rowH + 4, 6);
    ctx.fillStyle = rgba(THEME.bit1, 0.12);
    ctx.fill();
    const want = this.coach?.next;
    if (want && !this.ended && want.row !== cur) {
      roundRectPath(ctx, T.x + T.labelW + want.row * T.colW + 2, T.y - 2, T.colW - 4, T.rows * T.rowH + 4, 6);
      ctx.strokeStyle = rgba(THEME.accent, 0.55 + 0.45 * Math.sin(this.time * 5));
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    const actual = this.board.actualRows ?? [];
    const lines: { label: string; color: string; value: (k: number) => number | null; bad?: (k: number) => boolean }[] = [];
    lv.inputs.forEach((p, i) => lines.push({ label: p.id, color: THEME.textDim, value: (k) => (k >> (nIn - 1 - i)) & 1 }));
    lv.outputs.forEach((p, j) => {
      lines.push({ label: `${p.id}`, color: THEME.accent, value: (k) => this.expected[k]?.[j] ?? 0 });
      lines.push({
        label: 'thật',
        color: '#ffd0de',
        value: (k) => actual[k]?.[j] ?? null,
        bad: (k) => actual[k]?.[j] !== this.expected[k]?.[j],
      });
    });
    ctx.textAlign = 'center';
    for (const [i, ln] of lines.entries()) {
      const y = T.y + i * T.rowH + 15;
      ctx.font = `700 ${ln.label.length > 3 ? 10 : 12}px ${THEME.font}`;
      ctx.fillStyle = ln.color;
      ctx.fillText(ln.label, T.x + T.labelW / 2, y);
      for (let k = 0; k < T.cols; k++) {
        const v = ln.value(k);
        if (v === null) continue;
        const cx = T.x + T.labelW + (k + 0.5) * T.colW;
        const bad = ln.bad?.(k) ?? false;
        if (bad) {
          roundRectPath(ctx, cx - T.colW / 2 + 3, y - 14, T.colW - 6, 18, 4);
          ctx.fillStyle = rgba(THEME.error, 0.28);
          ctx.fill();
        }
        ctx.font = `700 14px ${THEME.monoFont}`;
        ctx.fillStyle = bad ? '#ff9dbb' : ln.color === THEME.accent ? (v ? THEME.accent : rgba(THEME.accent, 0.45)) : v ? THEME.text : THEME.textDim;
        ctx.fillText(String(v), cx, y);
      }
    }
  }

  /** Cho test tự động. */
  cellCenter(c: number, r: number): { x: number; y: number } {
    const G = this.layout.grid;
    return { x: G.x + (c + 0.5) * G.cell, y: G.y + (r + 0.5) * G.cell };
  }

  /** Cho test tự động: ô của lỗi thật (cổng hoặc 1 ô dây của net kẹt). */
  faultCell(): number {
    return this.faultNodes().find((n) => !this.grid.pins.has(n.cell))?.cell ?? -1;
  }
}
