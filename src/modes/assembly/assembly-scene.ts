// Màn LẮP RÁP: chọn linh kiện trong khay → chạm vị trí trên bo để cắm → xoay cho đúng chiều → CẤP NGUỒN.
// Khi có điện, mạch chạy thời gian thực (core/assembly/circuit.ts): LED sáng theo dòng, linh kiện quá tải bốc khói,
// ấn giữ nút nhấn ngay trên bo để thử; chạm linh kiện để đo dòng/áp như đồng hồ vạn năng.
// Mọi thao tác chính đều có nút DOM (bàn phím, trình đọc màn hình, test tự động).
import { BoardSim, KIND_NAME, PIN_COUNT, assemblyStars, evaluate, formatValue, partLabel, type AsmLevel, type Placement, type Report } from '../../core/assembly/board';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { GamePointer } from '../../input/pointer';
import type { Scene } from '../../scene';
import { drawAssemblyBoard, drawPart, footprintAt, layoutAssembly } from './board-draw';

export interface AssemblyResult {
  stars: number;
  powerOns: number;
  report: Report;
}

export interface AssemblySceneDeps {
  ui: HTMLElement;
  audio: GameAudio;
  onPass: (level: AsmLevel, r: AssemblyResult) => void;
  isBlocked?: () => boolean;
  /** hướng dẫn lần đầu ở màn a01 */
  tutorial?: boolean;
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function btn(cls: string, text: string, onClick?: () => void): HTMLButtonElement {
  const b = h('button', `btn ${cls}`, text);
  b.type = 'button';
  if (onClick) b.addEventListener('click', onClick);
  return b;
}

const fmtA = (a: number): string => (Math.abs(a) >= 1 ? `${a.toFixed(2).replace('.', ',')} A` : `${(a * 1000).toFixed(Math.abs(a) < 0.01 ? 1 : 0).replace('.', ',')} mA`);
const fmtV = (v: number): string => `${v.toFixed(2).replace('.', ',')} V`;

/** Ảnh nhỏ của linh kiện cho khay (vẽ 2D giống trên bo). */
function trayIcon(kind: AsmLevel['tray'][number]['kind'], value: number): HTMLCanvasElement {
  const W = 64;
  const H = 40;
  const cv = h('canvas', 'asm-icon');
  cv.setAttribute('aria-hidden', 'true');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = W * dpr;
  cv.height = H * dpr;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const g = cv.getContext('2d');
  if (!g) return cv;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = kind === 'U555' ? 11 : kind === 'Q' || kind === 'M' ? 17 : 16;
  let pins: [number, number][];
  if (kind === 'U555') pins = Array.from({ length: 8 }, (_, k): [number, number] => (k < 4 ? [15 + k * c, 37] : [15 + (7 - k) * c, 4]));
  else if (PIN_COUNT[kind] === 3) pins = [[32 - c, 26], [32, 26], [32 + c, 26]];
  else {
    const span = kind === 'R' || kind === 'D' ? 44 : 30;
    pins = [[32 - span / 2, 20], [32 + span / 2, 20]];
  }
  drawPart(g, kind, value, pins, c, { bright: 0, burnt: false, pressed: false, time: 0, fancy: false });
  return cv;
}

export class AssemblyScene implements Scene {
  placement: Placement = {};
  selTray: number | null = null;
  selFp: string | null = null;
  sim: BoardSim | null = null;
  report: Report | null = null;
  powerOns = 0;
  passed = false;
  private readonly pressed = new Set<string>();
  private readonly pointerFp = new Map<number, string>();
  private readonly pcb = new PcbBackdrop(4242, { pulses: 5, intensity: 0.5 });
  private time = 0;
  private surf: RenderSurface | null = null;
  private passTimer = 0;

  // DOM
  private readonly bar = h('div', 'asm-bar');
  private readonly strip = h('div', 'asm-strip');
  private readonly msg = h('p', 'asm-msg');
  private readonly ctxRow = h('div', 'asm-ctx');
  private readonly tray = h('div', 'asm-tray');
  private readonly powerBtn: HTMLButtonElement;
  private readonly trayBtns: HTMLButtonElement[] = [];

  constructor(
    readonly level: AsmLevel,
    private readonly deps: AssemblySceneDeps,
  ) {
    this.tray.setAttribute('role', 'group');
    this.tray.setAttribute('aria-label', 'Khay linh kiện');
    level.tray.forEach((p, i) => {
      const b = btn('asm-part', '', () => this.pickTray(i));
      b.append(trayIcon(p.kind, p.value), h('span', 'asm-part-name', partLabel(p, level.hideValues)));
      this.trayBtns.push(b);
      this.tray.append(b);
    });
    const actions = h('div', 'asm-actions');
    const hintBtn = btn('btn-small asm-hint', 'Gợi ý', () => this.say(level.hint, 'info'));
    this.powerBtn = btn('asm-power', 'CẤP NGUỒN', () => this.togglePower());
    actions.append(hintBtn, this.powerBtn);
    this.bar.append(this.tray, actions);
    this.msg.setAttribute('role', 'status');
    this.strip.append(this.msg, this.ctxRow);
    this.refresh();
  }

  // ---------------- vòng đời ----------------
  enter(s: RenderSurface): void {
    this.surf = s;
    this.deps.ui.append(this.strip, this.bar);
    this.say(this.deps.tutorial ? `${this.level.brief} Bước 1: chạm một linh kiện trong khay bên dưới, bước 2: chạm chỗ cắm sáng viền cam trên bo.` : this.level.brief, 'info');
  }

  exit(): void {
    window.clearTimeout(this.passTimer);
    this.passTimer = 0;
    this.bar.remove();
    this.strip.remove();
  }

  pause(): void {
    /* mạch chạy theo thời gian thực nhưng không tính giờ; có pause() để nút Dừng mở bảng tạm dừng */
  }

  resume(): void {}

  update(dt: number): void {
    this.time += dt;
    if (this.sim) {
      this.sim.run(Math.min(dt, 0.05));
    }
  }

  render(s: RenderSurface): void {
    this.surf = s;
    const L = layoutAssembly(s.width, s.height, this.level.cols, this.level.rows);
    this.pcb.ensure(s, [{ x: L.x - 12, y: L.y - 12, w: L.cell * this.level.cols + 24, h: L.cell * this.level.rows + 24 }]);
    this.pcb.draw(s);
    const ctx = s.ctx;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `700 11px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText(`LẮP RÁP · ${this.level.id.toUpperCase()}`, 16, 22);
    ctx.font = `700 19px ${THEME.font}`;
    ctx.fillStyle = THEME.text;
    ctx.fillText(this.level.name, 16, 46, s.width - 150);
    if (this.powerOns > 0) {
      ctx.textAlign = 'right';
      ctx.font = `12px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(`Cấp nguồn: ${this.powerOns} lần`, s.width - 112, 22);
    }
    const targets = new Set<string>();
    if (this.selTray !== null && !this.sim) {
      const kind = this.level.tray[this.selTray]!.kind;
      for (const fp of this.level.footprints) if (PIN_COUNT[fp.kind] === PIN_COUNT[kind]) targets.add(fp.id);
    }
    drawAssemblyBoard(ctx, L, this.level, {
      time: this.time,
      placement: this.placement,
      sim: this.sim,
      selected: this.selFp,
      targets,
      pressed: this.pressed,
      reducedMotion: s.reducedMotion,
      fancy: s.quality === 'high',
    });
  }

  onPointer(p: GamePointer): void {
    if (this.deps.isBlocked?.() || !this.surf) return;
    if (p.phase === 'up' || p.phase === 'cancel') {
      const fp = this.pointerFp.get(p.id);
      this.pointerFp.delete(p.id);
      if (fp) this.press(fp, false);
      return;
    }
    if (p.phase !== 'down') return;
    const L = layoutAssembly(this.surf.width, this.surf.height, this.level.cols, this.level.rows);
    const fp = footprintAt(L, this.level, p.x, p.y);
    if (!fp) {
      if (!this.sim) {
        this.selFp = null;
        this.refresh();
      }
      return;
    }
    if (this.sim) {
      if (this.sim.partAt(fp.id)?.kind === 'SW') {
        this.pointerFp.set(p.id, fp.id);
        this.press(fp.id, true);
      } else this.showReading(fp.id);
      return;
    }
    if (this.selTray !== null) this.place(this.selTray, fp.id);
    else {
      this.selFp = this.selFp === fp.id ? null : fp.id;
      this.refresh();
    }
  }

  // ---------------- thao tác ----------------
  /** footprint đang cắm linh kiện số `tray` (nếu có). */
  private whereIs(tray: number): string | null {
    for (const [id, pl] of Object.entries(this.placement)) if (pl && pl.tray === tray) return id;
    return null;
  }

  pickTray(i: number): void {
    if (this.sim) return this.say('Đang có điện: bấm TẮT NGUỒN trước khi thay linh kiện.', 'bad');
    const at = this.whereIs(i);
    if (at) {
      // linh kiện đã cắm: chọn chỗ đang cắm để xoay / gỡ
      this.selTray = null;
      this.selFp = at;
    } else if (this.selTray === i) this.selTray = null;
    else if (this.selFp && !this.placement[this.selFp]) {
      // đã chọn chỗ trống trước → cắm luôn
      return this.place(i, this.selFp);
    } else {
      this.selTray = i;
      this.selFp = null;
      const p = this.level.tray[i]!;
      this.say(`Đang cầm: ${partLabel(p, this.level.hideValues)}. Chạm chỗ cắm sáng viền cam trên bo.`, 'info');
    }
    this.deps.audio.play('tick');
    this.refresh();
  }

  place(tray: number, fpId: string): void {
    const fp = this.level.footprints.find((f) => f.id === fpId);
    const part = this.level.tray[tray];
    if (!fp || !part || this.sim) return;
    if (PIN_COUNT[part.kind] !== PIN_COUNT[fp.kind]) {
      this.deps.audio.play('error');
      this.say(`${fp.id} có ${PIN_COUNT[fp.kind]} lỗ, ${KIND_NAME[part.kind]} có ${PIN_COUNT[part.kind]} chân: không cắm vừa.`, 'bad');
      return;
    }
    const from = this.whereIs(tray);
    if (from) this.placement[from] = undefined;
    this.placement[fp.id] = { tray, flip: part.flip ?? false };
    this.selTray = null;
    this.selFp = fp.id;
    this.deps.audio.play('place');
    const polar: Record<string, string> = {
      LED: 'LED có cực: dấu + trên LED (chân dài) phải trùng dấu + in trên bo.',
      D: 'Diode có cực: vạch bạc trên thân phải trùng vạch in trên bo.',
      CE: 'Tụ hoá có cực: sọc trắng là cực −, dấu + trên bo là cực +.',
      Q: 'Transistor: mặt phẳng phải trùng mặt phẳng in trên bo (thứ tự E-B-C).',
      M: 'MOSFET: tab kim loại phải nằm đúng phía vạch dày trên bo (thứ tự G-D-S).',
      U555: 'IC: vết khuyết phải trùng vết khuyết in trên bo (chân 1 ở góc có chấm).',
    };
    this.say(`Đã cắm ${partLabel(part, this.level.hideValues)} vào ${fp.id}. ${polar[part.kind] ?? ''} ${polar[part.kind] ? 'Sai chiều thì bấm Xoay.' : ''}`.trim(), 'info');
    this.refresh();
  }

  rotate(fpId: string): void {
    const pl = this.placement[fpId];
    if (!pl || this.sim) return;
    pl.flip = !pl.flip;
    this.deps.audio.play('tick');
    this.say(`Đã xoay ${fpId} 180°.`, 'info');
    this.refresh();
  }

  remove(fpId: string): void {
    if (!this.placement[fpId] || this.sim) return;
    this.placement[fpId] = undefined;
    this.selFp = null;
    this.deps.audio.play('tick');
    this.refresh();
  }

  private press(fpId: string, down: boolean): void {
    if (!this.sim) return;
    if (down) this.pressed.add(fpId);
    else this.pressed.delete(fpId);
    this.sim.setSwitch(fpId, down);
    if (down) this.deps.audio.play('tick');
  }

  private showReading(fpId: string): void {
    const r = this.sim?.reading(fpId);
    const part = this.sim?.partAt(fpId);
    if (!r || !part) return;
    const burnt = this.sim!.burnt().find((b) => b.id === fpId);
    this.say(burnt ? `${fpId} đã cháy: ${burnt.reason}.` : `Đo ${fpId} (${KIND_NAME[part.kind]}): dòng ${fmtA(r.i)}, điện áp ${fmtV(r.v)}.`, burnt ? 'bad' : 'info');
  }

  togglePower(): void {
    if (this.sim) {
      this.sim = null;
      this.report = null;
      this.pressed.clear();
      window.clearTimeout(this.passTimer);
      this.passTimer = 0;
      this.say('Đã tắt nguồn. Linh kiện cháy (nếu có) đã được thay mới, sửa lại rồi thử tiếp.', 'info');
      this.refresh();
      return;
    }
    const empty = this.level.footprints.filter((f) => !this.placement[f.id]).map((f) => f.id);
    if (empty.length) {
      this.deps.audio.play('error');
      this.say(`Cắm đủ linh kiện trước khi cấp nguồn: còn trống ${empty.join(', ')}.`, 'bad');
      return;
    }
    this.powerOns++;
    this.selTray = null;
    this.selFp = null;
    this.report = evaluate(this.level, this.placement);
    this.sim = new BoardSim(this.level, this.placement);
    const r = this.report;
    if (r.pass) {
      this.passed = true;
      this.deps.audio.play('win');
      this.say('Mạch chạy đúng mọi yêu cầu!', 'good');
      if (!this.passTimer)
        this.passTimer = window.setTimeout(() => {
          this.passTimer = 0;
          this.deps.onPass(this.level, { stars: assemblyStars(this.powerOns), powerOns: this.powerOns, report: r });
        }, 1500);
    } else {
      this.deps.audio.play('error');
      const lines: string[] = [];
      if (r.shorted) lines.push('Chập mạch: dòng từ pin quá lớn!');
      for (const b of r.burnt) lines.push(`${b.id} cháy: ${b.reason}.`);
      const bad = r.checks.filter((c) => !c.ok);
      for (const c of bad.slice(0, 2)) lines.push(`✕ ${c.text}: đo được ${c.got}.`);
      if (bad.length > 2) lines.push(`và ${bad.length - 2} yêu cầu khác chưa đạt.`);
      this.say(`${lines.join(' ')} Bấm TẮT NGUỒN để sửa.`, 'bad');
    }
    this.refresh();
  }

  // ---------------- DOM ----------------
  private say(text: string, kind: 'info' | 'good' | 'bad'): void {
    this.msg.textContent = text;
    this.msg.dataset.kind = kind;
  }

  /** Cập nhật khay, hàng ngữ cảnh và nút nguồn theo trạng thái. */
  refresh(): void {
    const powered = !!this.sim;
    this.powerBtn.textContent = powered ? 'TẮT NGUỒN' : 'CẤP NGUỒN';
    this.powerBtn.classList.toggle('on', powered);
    this.powerBtn.setAttribute('aria-pressed', String(powered));
    this.level.tray.forEach((p, i) => {
      const b = this.trayBtns[i]!;
      const at = this.whereIs(i);
      b.classList.toggle('used', !!at);
      b.classList.toggle('active', this.selTray === i);
      b.setAttribute('aria-pressed', String(this.selTray === i));
      b.disabled = powered;
      const name = partLabel(p, this.level.hideValues);
      b.setAttribute('aria-label', at ? `${name}, đang cắm ở ${at}` : name);
      const tag = b.querySelector('.asm-part-at') ?? b.appendChild(h('span', 'asm-part-at'));
      tag.textContent = at ?? '';
    });

    const row: HTMLElement[] = [];
    if (powered) {
      for (const fp of this.level.footprints) {
        if (this.sim!.partAt(fp.id)?.kind !== 'SW') continue;
        const b = btn('btn-small asm-press', `Ấn giữ ${fp.id}`);
        const down = (): void => this.press(fp.id, true);
        const up = (): void => this.press(fp.id, false);
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('keydown', (e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            down();
          }
        });
        b.addEventListener('keyup', (e) => {
          if (e.key === ' ' || e.key === 'Enter') up();
        });
        row.push(b);
      }
      if (row.length === 0) row.push(h('span', 'asm-ctx-note', 'Chạm linh kiện trên bo để đo dòng và điện áp.'));
    } else if (this.selTray !== null) {
      const part = this.level.tray[this.selTray]!;
      row.push(h('span', 'asm-ctx-note', 'Cắm vào:'));
      for (const fp of this.level.footprints) {
        if (PIN_COUNT[fp.kind] !== PIN_COUNT[part.kind]) continue;
        const b = btn('btn-small asm-slot', fp.id, () => this.place(this.selTray!, fp.id));
        b.setAttribute('aria-label', `Cắm vào ${fp.id}${this.placement[fp.id] ? ' (thay linh kiện đang cắm)' : ''}`);
        row.push(b);
      }
      row.push(btn('btn-small', 'Bỏ chọn', () => this.pickTray(this.selTray!)));
    } else if (this.selFp) {
      const pl = this.placement[this.selFp];
      const fpId = this.selFp;
      if (pl) {
        const part = this.level.tray[pl.tray]!;
        row.push(h('span', 'asm-ctx-note', `${fpId}: ${partLabel(part, this.level.hideValues)}`));
        if (part.kind === 'R' && this.level.hideValues) row.push(h('span', 'asm-ctx-note', '(đọc vạch màu)'));
        row.push(btn('btn-small asm-rotate', 'Xoay 180°', () => this.rotate(fpId)), btn('btn-small', 'Gỡ ra', () => this.remove(fpId)));
      } else {
        const fp = this.level.footprints.find((f) => f.id === fpId)!;
        row.push(h('span', 'asm-ctx-note', `${fpId} cần: ${KIND_NAME[fp.kind]}. Chọn linh kiện trong khay.`));
      }
    }
    this.ctxRow.replaceChildren(...row);
    this.ctxRow.hidden = row.length === 0;
  }

  /** Cho test tự động: trạng thái gọn. */
  snapshot(): { level: string; placed: Record<string, { part: string; flip: boolean } | null>; powered: boolean; pass: boolean | null; powerOns: number; lit: Record<string, boolean> } {
    const lit: Record<string, boolean> = {};
    if (this.sim) for (const id of [...this.level.footprints.map((f) => f.id), ...(this.level.lamps ?? []).map((l) => l.id)]) if (this.sim.light(id) !== null) lit[id] = this.sim.isLit(id);
    const placed: Record<string, { part: string; flip: boolean } | null> = {};
    for (const fp of this.level.footprints) {
      const pl = this.placement[fp.id];
      const p = pl ? this.level.tray[pl.tray] : undefined;
      placed[fp.id] = pl && p ? { part: `${p.kind}${p.value ? ` ${formatValue(p.kind, p.value)}` : ''}`, flip: pl.flip } : null;
    }
    return { level: this.level.id, placed, powered: !!this.sim, pass: this.report ? this.report.pass : null, powerOns: this.powerOns, lit };
  }
}
