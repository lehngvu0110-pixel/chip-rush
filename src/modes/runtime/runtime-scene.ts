// Màn chơi VẬN HÀNH: "con chip" mang 2 bit A, B rơi xuống Ổ CẮM; người chơi chọn cổng cắm vào ổ
// để chip cho ra đúng bit mục tiêu (chạm nút hoặc phím 1–4).
// Logic nằm trong game.ts; file này chỉ vẽ (phong cách bo mạch neon), nhận thao tác và tạo hiệu ứng/âm thanh.
import { RUNTIME } from '../../config';
import type { GateType } from '../../core/circuit/types';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { clamp01, easeOutBack, easeOutCubic, mixHex, rgba } from '../../render/color';
import { inRect, roundRectPath } from '../../render/draw';
import { Particles, drawGlow, fontsReady, makeLayer } from '../../render/fx';
import { drawGateSymbol, drawLock } from '../../render/gate-symbol';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { GamePointer } from '../../input/pointer';
import type { Scene } from '../../scene';
import type { RuntimeGame, RuntimeResult } from './game';
import { RUNTIME_GATES } from './spawner';

/** Gợi ý ngắn cho người chưa biết cổng logic — hiện ngay trên nút. */
export const GATE_HINT: Record<string, string> = {
  AND: '1 khi cả hai là 1',
  OR: '1 khi có ít nhất một 1',
  XOR: '1 khi hai bit khác nhau',
  NAND: 'ngược lại của AND',
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RuntimeLayout {
  laneTop: number;
  /** đáy làn rơi = ổ cắm cổng */
  slotY: number;
  buttons: { gate: GateType; rect: Rect }[];
}

const BTN_H = 72; // ≥ 44 px vùng chạm
const GAP = 12;
const SIDE = 16;
const BOTTOM = 40; // chừa thanh home của iPhone
const PACKET_W = 220;
const PACKET_H = 84;
const SOCKET_H = 40;
const BTN_PAD = 3; // lề cache nút cho nét viền 2 px
const PKT_PAD = 2;
const PIN_H = 9;

/** Bố cục tính thuần từ kích thước màn hình (test được, và dùng chung cho hit-test). */
export function layoutRuntime(w: number, h: number): RuntimeLayout {
  const maxW = Math.min(w, 520); // màn ngang/desktop: không kéo nút quá rộng
  const left = (w - maxW) / 2 + SIDE;
  const bw = (maxW - 2 * SIDE - GAP) / 2;
  const gridTop = h - BOTTOM - 2 * BTN_H - GAP;
  const buttons = RUNTIME_GATES.map((gate, i) => ({
    gate,
    rect: { x: left + (i % 2) * (bw + GAP), y: gridTop + Math.floor(i / 2) * (BTN_H + GAP), w: bw, h: BTN_H },
  }));
  return { laneTop: 104, slotY: gridTop - 56, buttons };
}

interface Float {
  text: string;
  x: number;
  y: number;
  t: number;
  color: string;
}

export class RuntimeScene implements Scene {
  private layout: RuntimeLayout = layoutRuntime(360, 640);
  private readonly pcb = new PcbBackdrop(20261009, { pulses: 10, intensity: 0.85 });
  private readonly particles = new Particles(70);
  private floats: Float[] = [];
  private flash: { color: string; t: number } | null = null;
  private ring: { x: number; y: number; t: number; color: string } | null = null;
  private vignette = 0; // viền đỏ khi sai
  private shake = 0;
  private banner: { text: string; t: number; color: string } | null = { text: 'Chọn cổng cho ra đúng bit mục tiêu', t: 3.5, color: THEME.accent };
  private hintExpected: { text: string; t: number } | null = null;
  /** cổng vừa cắm vào ổ (hiện ký hiệu trong ổ một lúc) */
  private socketGate: { gate: GateType; ok: boolean; t: number } | null = null;
  private pressed: { gate: GateType; ok: boolean; t: number } | null = null;
  private unlockGlow: { gate: GateType; t: number } | null = null;
  private lastPacket: unknown = null;
  private readonly btnCache = new Map<string, HTMLCanvasElement>();
  private packetImg: { key: string; img: HTMLCanvasElement } | null = null;
  private packetIn = 1; // 0→1: hoạt cảnh chip mới xuất hiện
  private shownScore = 0;
  private scorePop = 0;
  private lastMult = 1;
  private lifeLost = 0;
  private time = 0;
  private surf: RenderSurface | null = null;
  private endSent = false;
  private reduced = false;
  private readonly onKey = (e: KeyboardEvent): void => {
    const i = ['1', '2', '3', '4'].indexOf(e.key);
    const byLetter: Record<string, GateType> = { a: 'AND', o: 'OR', x: 'XOR', n: 'NAND' };
    const gate = i >= 0 ? RUNTIME_GATES[i] : byLetter[e.key.toLowerCase()];
    if (gate) this.choose(gate);
  };

  constructor(
    readonly game: RuntimeGame,
    private readonly audio: GameAudio,
    private readonly onEnd: (r: RuntimeResult) => void,
  ) {}

  enter(s: RenderSurface): void {
    this.layout = layoutRuntime(s.width, s.height);
    this.reduced = s.reducedMotion;
    window.addEventListener('keydown', this.onKey);
  }

  exit(): void {
    window.removeEventListener('keydown', this.onKey);
  }

  pause(): void {
    this.game.pause();
  }

  resume(): void {
    this.game.resume();
  }

  onPointer(p: GamePointer): void {
    if (p.phase !== 'down') return;
    const hit = this.layout.buttons.find((b) => inRect(p.x, p.y, b.rect));
    if (hit) this.choose(hit.gate);
  }

  private choose(gate: GateType): void {
    if (this.game.ended || this.game.paused) return;
    if (!this.game.unlocked.includes(gate)) {
      this.audio.play('error');
      return;
    }
    const valid = this.game.packet.validGates.includes(gate);
    if (this.game.answer(gate)) {
      this.pressed = { gate, ok: valid, t: 0.18 };
      this.socketGate = { gate, ok: valid, t: 0.45 };
    }
  }

  private socketCenter(): { x: number; y: number } {
    return { x: this.packetX(), y: this.layout.slotY + SOCKET_H / 2 };
  }

  update(dt: number): void {
    this.time += dt;
    const lives0 = this.game.lives;
    this.game.update(dt);
    const sc = this.socketCenter();
    const fx = !this.reduced;
    for (const ev of this.game.drainEvents()) {
      switch (ev.type) {
        case 'correct': {
          this.audio.play('ting');
          this.flash = { color: THEME.bit1, t: 0.3 };
          this.scorePop = 0.25;
          // Chỉ giữ 1 chữ nổi: trả lời nhanh liên tiếp sẽ không chồng chữ lên nhau
          this.floats = [{ text: ev.multiplier > 1 ? `+${ev.points} ×${ev.multiplier}` : `+${ev.points}`, x: sc.x, y: this.layout.slotY - 24, t: 0.9, color: ev.multiplier > 1 ? THEME.accent : THEME.bit1 }];
          if (fx) {
            this.particles.burst(sc.x, sc.y, THEME.bit1, 16, { speed: 220, size: 7 });
            this.ring = { x: sc.x, y: sc.y, t: 0, color: THEME.bit1 };
            this.pcb.burst(2);
          }
          if (ev.multiplier > this.lastMult) {
            this.banner = { text: `Chuỗi đúng! Hệ số ×${ev.multiplier}`, t: 1.6, color: THEME.accent };
            if (fx) {
              this.particles.burst(sc.x, sc.y, THEME.accent, 22, { speed: 320, size: 8, life: 0.8 });
              this.pcb.burst(5, THEME.accent);
            }
          }
          this.lastMult = ev.multiplier;
          break;
        }
        case 'wrong':
        case 'miss':
          this.audio.play('error');
          this.flash = { color: THEME.error, t: 0.35 };
          this.lastMult = 1;
          if (fx) {
            this.shake = 0.25;
            this.vignette = 0.45;
            // tia lửa: nhanh, rơi xuống
            this.particles.burst(sc.x, sc.y, THEME.error, 14, { speed: 300, size: 5, life: 0.5, gravity: 600 });
          }
          this.floats = [];
          // Gói mới đã xuất hiện nên ghi rõ đây là đáp án của gói VỪA RỒI
          this.hintExpected = { text: `${ev.type === 'miss' ? 'Chậm quá! ' : ''}Gói vừa rồi cần: ${ev.expected.join(' / ')}`, t: 1.4 };
          break;
        case 'unlock':
          this.audio.play('unlock');
          this.banner = { text: `Mở khóa ${ev.gate}: ${GATE_HINT[ev.gate] ?? ''}`, t: 2.5, color: THEME.accent };
          this.unlockGlow = { gate: ev.gate, t: 1.6 };
          break;
        case 'end':
          if (!this.endSent) {
            this.endSent = true;
            this.onEnd(this.game.result());
          }
          break;
      }
    }
    if (this.game.lives < lives0) this.lifeLost = 0.6;
    if (this.game.packet !== this.lastPacket) {
      this.lastPacket = this.game.packet;
      this.packetIn = fx ? 0 : 1;
    }
    this.packetIn = Math.min(1, this.packetIn + dt / 0.18);

    // điểm chạy dần tới giá trị thật (đếm số), bị trừ điểm thì nhảy luôn
    const target = this.game.score;
    this.shownScore = target < this.shownScore ? target : this.shownScore + (target - this.shownScore) * Math.min(1, dt * 14);
    if (target - this.shownScore < 0.5) this.shownScore = target;

    for (const f of this.floats) {
      f.t -= dt;
      if (!this.reduced) f.y -= 40 * dt;
    }
    this.floats = this.floats.filter((f) => f.t > 0);
    this.particles.update(dt);
    if (this.surf) this.pcb.update(dt, this.surf); // xung điện nền chạy theo thời gian thật
    const dec = (v: number): number => Math.max(0, v - dt);
    this.shake = dec(this.shake);
    this.vignette = dec(this.vignette);
    this.scorePop = dec(this.scorePop);
    this.lifeLost = dec(this.lifeLost);
    if (this.ring && (this.ring.t += dt) > 0.4) this.ring = null;
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.hintExpected && (this.hintExpected.t -= dt) <= 0) this.hintExpected = null;
    if (this.pressed && (this.pressed.t -= dt) <= 0) this.pressed = null;
    if (this.socketGate && (this.socketGate.t -= dt) <= 0) this.socketGate = null;
    if (this.unlockGlow && (this.unlockGlow.t -= dt) <= 0) this.unlockGlow = null;
  }

  private packetX(): number {
    const b0 = this.layout.buttons[0]?.rect;
    const b1 = this.layout.buttons[1]?.rect;
    return b0 && b1 ? (b0.x + b1.x + b1.w) / 2 : 180;
  }

  render(s: RenderSurface): void {
    const L = (this.layout = layoutRuntime(s.width, s.height));
    const ctx = s.ctx;
    const g = this.game;
    const cx = this.packetX();
    const laneW = PACKET_W + 36;

    // --- Nền bo mạch (tránh làn rơi, HUD và vùng nút để chữ luôn dễ đọc) ---
    this.pcb.ensure(
      s,
      [
        { x: cx - laneW / 2, y: L.laneTop - 8, w: laneW, h: L.slotY + SOCKET_H - L.laneTop + 16 },
        { x: 0, y: 0, w: s.width, h: 90 },
      ],
      (g) => {
        // 2 thanh ray có vạch chia mỗi 24 px (cảm giác tốc độ) — tĩnh nên vẽ 1 lần vào nền
        const l = cx - laneW / 2;
        const r = cx + laneW / 2;
        g.strokeStyle = rgba('#2c3866', 0.9);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(l, L.laneTop);
        g.lineTo(l, L.slotY);
        g.moveTo(r, L.laneTop);
        g.lineTo(r, L.slotY);
        for (let y = L.laneTop; y < L.slotY; y += 24) {
          g.moveTo(l, y);
          g.lineTo(l + 6, y);
          g.moveTo(r, y);
          g.lineTo(r - 6, y);
        }
        g.stroke();
      },
    );
    this.surf = s;
    this.pcb.draw(s);

    const shakeX = this.shake > 0 ? Math.sin(this.shake * 80) * 6 : 0;
    ctx.save();
    ctx.translate(shakeX, 0);

    // --- Làn rơi: 3 đường tín hiệu từ chân chip xuống ổ cắm (ray đã nằm ở lớp nền) ---
    const progress = clamp01(g.progress);
    const urgency = clamp01((progress - 0.55) / 0.45);

    const py = L.laneTop + (L.slotY - L.laneTop - PACKET_H - 10) * progress;
    const px = cx - PACKET_W / 2;
    const pinXs = this.pinXs(px);
    const p = g.packet;
    const lineCols = [p.a ? THEME.bit1 : '#33406b', p.b ? THEME.bit1 : '#33406b', THEME.accent];
    for (const [i, x] of pinXs.entries()) {
      ctx.strokeStyle = rgba(lineCols[i] === '#33406b' ? '#33406b' : (lineCols[i] as string), lineCols[i] === '#33406b' ? 0.8 : 0.35 + urgency * 0.4);
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.lineDashOffset = this.reduced ? 0 : -this.time * 30;
      ctx.beginPath();
      ctx.moveTo(x, py + PACKET_H + 8);
      ctx.lineTo(x, L.slotY);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // --- Ổ cắm cổng ---
    this.drawSocket(s, cx, L.slotY, pinXs, urgency);

    // --- Chip (gói bit) ---
    const k = easeOutBack(this.packetIn);
    ctx.save();
    ctx.globalAlpha = clamp01(this.packetIn * 1.5);
    ctx.translate(cx, py + PACKET_H / 2);
    ctx.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    ctx.translate(-cx, -(py + PACKET_H / 2));
    this.drawPacket(s, px, py, urgency);
    ctx.restore();

    // --- Hiệu ứng ---
    if (this.ring) {
      const t = this.ring.t / 0.4;
      ctx.strokeStyle = rgba(this.ring.color, 1 - t);
      ctx.lineWidth = 3 * (1 - t) + 1;
      ctx.beginPath();
      ctx.ellipse(this.ring.x, this.ring.y, 30 + 110 * easeOutCubic(t), 12 + 40 * easeOutCubic(t), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    this.particles.draw(ctx);
    ctx.restore(); // hết rung

    // --- Thông báo ---
    ctx.textAlign = 'center';
    if (this.hintExpected) {
      ctx.font = `700 16px ${THEME.font}`;
      ctx.fillStyle = THEME.error;
      ctx.fillText(this.hintExpected.text, cx, L.slotY - 14, s.width - 24);
    }
    for (const f of this.floats) {
      ctx.globalAlpha = Math.min(1, f.t * 2);
      ctx.font = `700 22px ${THEME.monoFont}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    this.drawHud(s);
    if (this.banner) {
      const a = Math.min(1, this.banner.t * 3);
      ctx.globalAlpha = a;
      ctx.font = `700 15px ${THEME.font}`;
      const tw = Math.min(s.width - 24, ctx.measureText(this.banner.text).width + 28);
      roundRectPath(ctx, s.width / 2 - tw / 2, 82, tw, 26, 13);
      ctx.fillStyle = rgba('#0b1020', 0.85);
      ctx.fill();
      ctx.strokeStyle = rgba(this.banner.color, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = this.banner.color;
      ctx.textAlign = 'center';
      ctx.fillText(this.banner.text, s.width / 2, 100, s.width - 40);
      ctx.globalAlpha = 1;
    }

    // --- 4 nút cổng ---
    for (const [i, b] of L.buttons.entries()) this.drawButton(s, b.gate, b.rect, i + 1);

    // viền đỏ khi sai (gradient ở 2 mép, rẻ hơn blur)
    if (this.vignette > 0) {
      const a = this.vignette / 0.45;
      const edge = Math.min(80, s.width * 0.2);
      for (const [x0, x1] of [[0, edge], [s.width, s.width - edge]] as const) {
        const gr = ctx.createLinearGradient(x0, 0, x1, 0);
        gr.addColorStop(0, rgba(THEME.error, 0.35 * a));
        gr.addColorStop(1, rgba(THEME.error, 0));
        ctx.fillStyle = gr;
        ctx.fillRect(Math.min(x0, x1), 0, edge, s.height);
      }
    }

    if (g.paused) {
      ctx.fillStyle = 'rgba(11,16,32,0.6)';
      ctx.fillRect(0, 0, s.width, s.height);
    }
  }

  /** x của 3 chân chip: A, B (đầu vào) và chân ra (mục tiêu). Ổ cắm có lỗ đúng các vị trí này. */
  private pinXs(px: number): [number, number, number] {
    return [px + 40, px + 92, px + 172];
  }

  private drawHud(s: RenderSurface): void {
    const ctx = s.ctx;
    const g = this.game;
    // Điểm
    ctx.textAlign = 'left';
    ctx.font = `700 11px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText('ĐIỂM', 20, 24);
    const pop = this.scorePop > 0 ? 1 + 0.18 * (this.scorePop / 0.25) : 1;
    ctx.save();
    ctx.translate(20, 52);
    ctx.scale(pop, pop);
    ctx.font = `700 32px ${THEME.monoFont}`;
    if (s.quality === 'high' && !s.reducedMotion) {
      ctx.shadowColor = THEME.bit1;
      ctx.shadowBlur = 12;
    }
    ctx.fillStyle = THEME.text;
    ctx.fillText(String(Math.round(this.shownScore)), 0, 0);
    ctx.restore();

    // Thanh chuỗi đúng: 5 vạch = tiến tới hệ số kế tiếp
    const mult = Math.min(RUNTIME.maxMultiplier, 1 + Math.floor(g.combo / RUNTIME.comboStep));
    const maxed = mult >= RUNTIME.maxMultiplier;
    const filled = maxed ? RUNTIME.comboStep : g.combo % RUNTIME.comboStep;
    for (let i = 0; i < RUNTIME.comboStep; i++) {
      const x = 20 + i * 15;
      roundRectPath(ctx, x, 64, 11, 6, 2);
      if (i < filled) {
        ctx.fillStyle = maxed ? THEME.accent : THEME.bit1;
        ctx.fill();
      } else {
        ctx.fillStyle = '#1d2647';
        ctx.fill();
      }
    }
    ctx.font = `700 13px ${THEME.monoFont}`;
    ctx.fillStyle = mult > 1 ? THEME.accent : THEME.textDim;
    ctx.fillText(`×${mult}`, 20 + RUNTIME.comboStep * 15 + 4, 71);
    ctx.font = `12px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText(`Chuỗi đúng ${g.combo}`, 20 + RUNTIME.comboStep * 15 + 32, 71);

    // Mạng (LED) hoặc đồng hồ
    ctx.textAlign = 'right';
    if (g.mode === 'sixty') {
      const left = Math.ceil(g.timeLeft);
      const warn = left <= 10;
      ctx.font = `700 22px ${THEME.monoFont}`;
      ctx.fillStyle = warn ? THEME.accent : THEME.text;
      ctx.fillText(`0:${String(left).padStart(2, '0')}`, s.width - 20, 76);
      // thanh thời gian chạy dọc mép trên
      const frac = clamp01(g.timeLeft / RUNTIME.sixtyDuration);
      ctx.fillStyle = rgba(warn ? THEME.accent : THEME.bit1, 0.8);
      ctx.fillRect(0, 0, s.width * frac, 3);
    } else {
      for (let i = 0; i < RUNTIME.lives; i++) {
        const x = s.width - 24 - (RUNTIME.lives - 1 - i) * 24;
        const y = 70;
        const on = i < g.lives;
        const justLost = !on && i === g.lives && this.lifeLost > 0;
        if (on) {
          const breathe = this.reduced ? 1 : 0.85 + 0.15 * Math.sin(this.time * 3 + i);
          drawGlow(ctx, THEME.bit1, 14, x, y, breathe);
        } else if (justLost && Math.floor(this.lifeLost * 20) % 2 === 0) {
          drawGlow(ctx, THEME.error, 14, x, y, 1);
        }
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = on ? '#bff8ff' : '#141b33';
        ctx.fill();
        ctx.strokeStyle = on ? THEME.bit1 : '#2c3866';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  private drawSocket(s: RenderSurface, cx: number, y: number, pinXs: number[], urgency: number): void {
    const ctx = s.ctx;
    const w = Math.min(280, s.width - 40);
    const x = cx - w / 2;
    const base = this.flash ? this.flash.color : urgency > 0 ? mixHex('#2c3866', THEME.accent, urgency) : '#2c3866';
    if (this.flash && !this.reduced) drawGlow(ctx, this.flash.color, 60, cx, y + SOCKET_H / 2, 1.2 * (this.flash.t / 0.3));
    roundRectPath(ctx, x, y, w, SOCKET_H, 8);
    const gr = ctx.createLinearGradient(0, y, 0, y + SOCKET_H);
    gr.addColorStop(0, '#141c38');
    gr.addColorStop(1, '#0a0f22');
    ctx.fillStyle = gr;
    ctx.fill();
    ctx.strokeStyle = base;
    ctx.lineWidth = 2;
    ctx.stroke();
    // lỗ cắm khớp vị trí chân chip
    for (const px of pinXs) {
      ctx.fillStyle = '#05070f';
      ctx.fillRect(px - 5, y + 4, 10, 7);
      ctx.strokeStyle = rgba('#7f93bf', 0.5);
      ctx.lineWidth = 1;
      ctx.strokeRect(px - 5, y + 4, 10, 7);
    }
    if (this.socketGate) {
      const col = this.socketGate.ok ? THEME.bit1 : THEME.error;
      ctx.globalAlpha = Math.min(1, this.socketGate.t * 4);
      drawGateSymbol(ctx, this.socketGate.gate, cx - 30, y + 13, 60, 24, { stroke: col, lineWidth: 2.5 });
      ctx.globalAlpha = 1;
    } else {
      ctx.textAlign = 'center';
      ctx.font = `700 11px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText('Ổ CẮM CỔNG', cx, y + 29);
    }
  }

  private drawPacket(s: RenderSurface, x: number, y: number, urgency: number): void {
    const ctx = s.ctx;
    const p = this.game.packet;
    const w = PACKET_W;
    const h = PACKET_H;
    const edge = urgency < 0.5 ? mixHex(THEME.bit1, THEME.accent, urgency * 2) : mixHex(THEME.accent, THEME.error, (urgency - 0.5) * 2);
    if (!this.reduced && s.quality === 'high') drawGlow(ctx, edge, 70, x + w / 2, y + h / 2, 1.05);
    // Thân chip + chữ chỉ đổi khi sang gói mới → vẽ sẵn; viền đổi màu theo độ gấp nên vẽ trực tiếp.
    const key = `${p.a}${p.b}${p.target}|${fontsReady ? 1 : 0}`;
    if (!this.packetImg || this.packetImg.key !== key) {
      this.packetImg = { key, img: makeLayer(w, h + PIN_H, PKT_PAD, (g) => this.paintPacketBody(g, p.a, p.b, p.target)) };
    }
    ctx.drawImage(this.packetImg.img, x - PKT_PAD, y - PKT_PAD, w + 2 * PKT_PAD, h + PIN_H + 2 * PKT_PAD);
    roundRectPath(ctx, x, y, w, h, 10);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    // vết khuyết (chi tiết của vỏ chip thật) cắt qua viền
    ctx.beginPath();
    ctx.arc(x + w / 2, y, 7, 0, Math.PI);
    ctx.fillStyle = '#0b1020';
    ctx.fill();
  }

  /** Thân chip ở gốc (0, 0), không có viền ngoài — gọi khi tạo cache. */
  private paintPacketBody(ctx: CanvasRenderingContext2D, a: number, b: number, target: number): void {
    const w = PACKET_W;
    const h = PACKET_H;
    const y = 0;
    const pins = this.pinXs(0);
    // chân chip (cắm xuống ổ): A, B sáng nếu bit = 1; chân ra màu cam
    const pinCol = [a ? THEME.bit1 : '#46557f', b ? THEME.bit1 : '#46557f', THEME.accent];
    for (const [i, px] of pins.entries()) {
      ctx.fillStyle = pinCol[i] as string;
      ctx.fillRect(px - 4, h, 8, PIN_H);
    }
    roundRectPath(ctx, 0, 0, w, h, 10);
    const gr = ctx.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1d2852');
    gr.addColorStop(1, '#0d1430');
    ctx.fillStyle = gr;
    ctx.fill();
    // chấm đánh dấu chân số 1
    ctx.beginPath();
    ctx.arc(12, 12, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#46557f';
    ctx.fill();

    const bit = (label: string, v: number, bx: number, color: string): void => {
      ctx.textAlign = 'center';
      ctx.font = `700 11px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(label, bx, y + 24);
      ctx.font = `700 32px ${THEME.monoFont}`;
      ctx.fillStyle = color;
      ctx.fillText(String(v), bx, y + 62);
    };
    // bit 1 sáng, bit 0 tối — luôn kèm chữ số nên không phụ thuộc màu
    bit('A', a, pins[0], a ? THEME.bit1 : THEME.textDim);
    bit('B', b, pins[1], b ? THEME.bit1 : THEME.textDim);
    // mũi tên
    ctx.strokeStyle = THEME.textDim;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(116, y + 51);
    ctx.lineTo(136, y + 51);
    ctx.moveTo(130, y + 45);
    ctx.lineTo(136, y + 51);
    ctx.lineTo(130, y + 57);
    ctx.stroke();
    // ô mục tiêu
    roundRectPath(ctx, pins[2] - 28, y + 10, 56, h - 20, 8);
    ctx.fillStyle = rgba(THEME.accent, 0.1);
    ctx.fill();
    ctx.strokeStyle = rgba(THEME.accent, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();
    bit('CẦN RA', target, pins[2], THEME.accent);
  }

  private drawButton(s: RenderSurface, gate: GateType, r: Rect, key: number): void {
    const ctx = s.ctx;
    const open = this.game.unlocked.includes(gate);
    const pressed = this.pressed?.gate === gate ? this.pressed : null;
    const glowing = this.unlockGlow?.gate === gate ? this.unlockGlow : null;
    const y = r.y + (pressed ? 2 : 0);
    if (glowing && !this.reduced) drawGlow(ctx, THEME.accent, 90, r.x + r.w / 2, y + r.h / 2, 0.8 + 0.2 * Math.sin(this.time * 10));
    // Nút chỉ có vài trạng thái → vẽ sẵn từng trạng thái một lần, mỗi frame chỉ drawImage.
    const state = !open ? 'locked' : pressed ? (pressed.ok ? 'ok' : 'bad') : glowing ? 'glow' : 'open';
    if (this.btnCache.size > 64) this.btnCache.clear(); // đổi cỡ màn nhiều lần: không giữ cache cũ mãi
    const cacheKey = `${gate}|${state}|${key}|${Math.round(r.w)}x${Math.round(r.h)}|${fontsReady ? 1 : 0}`;
    let img = this.btnCache.get(cacheKey);
    if (!img) {
      img = makeLayer(r.w, r.h, BTN_PAD, (g) => this.paintButton(g, gate, r.w, r.h, key, open, pressed, glowing !== null));
      this.btnCache.set(cacheKey, img);
    }
    ctx.drawImage(img, r.x - BTN_PAD, y - BTN_PAD, r.w + 2 * BTN_PAD, r.h + 2 * BTN_PAD);
  }

  /** Vẽ 1 nút ở gốc (0, 0) — gọi khi tạo cache. */
  private paintButton(
    ctx: CanvasRenderingContext2D,
    gate: GateType,
    w: number,
    h: number,
    key: number,
    open: boolean,
    pressed: { ok: boolean } | null,
    glowing: boolean,
  ): void {
    const r = { x: 0, y: 0, w, h };
    const y = 0;
    roundRectPath(ctx, r.x, y, r.w, r.h, 14);
    if (pressed) {
      ctx.fillStyle = pressed.ok ? 'rgba(56,232,255,0.28)' : 'rgba(255,107,154,0.28)';
    } else {
      const gr = ctx.createLinearGradient(0, y, 0, y + r.h);
      gr.addColorStop(0, open ? '#16224a' : '#0f1530');
      gr.addColorStop(1, open ? '#0c1330' : '#0b1020');
      ctx.fillStyle = gr;
    }
    ctx.fill();
    ctx.strokeStyle = !open ? '#1d2647' : pressed && !pressed.ok ? THEME.error : glowing ? THEME.accent : rgba(THEME.bit1, 0.75);
    ctx.lineWidth = 2;
    ctx.stroke();
    // vệt sáng mép trên (cảm giác nút nổi)
    if (open) {
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(r.x + 14, y + 3);
      ctx.lineTo(r.x + r.w - 14, y + 3);
      ctx.stroke();
    }

    const symColor = open ? THEME.bit1 : '#2c3866';
    drawGateSymbol(ctx, gate, r.x + 12, y + 12, 38, 24, { stroke: symColor, fill: open ? rgba(THEME.bit1, 0.08) : undefined, lineWidth: 2 });
    ctx.textAlign = 'left';
    ctx.font = `700 20px ${THEME.font}`;
    ctx.fillStyle = open ? THEME.text : '#3b4878';
    ctx.fillText(gate, r.x + 58, y + 32);
    // phím tắt (máy tính)
    ctx.font = `700 11px ${THEME.monoFont}`;
    roundRectPath(ctx, r.x + r.w - 26, y + 8, 18, 18, 4);
    ctx.strokeStyle = '#2c3866';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = THEME.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(String(key), r.x + r.w - 17, y + 21);
    ctx.textAlign = 'left';
    ctx.font = `12px ${THEME.font}`;
    if (open) {
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(GATE_HINT[gate] ?? '', r.x + 14, y + 58, r.w - 24);
    } else {
      const need = (RUNTIME.unlockAt as Partial<Record<GateType, number>>)[gate];
      drawLock(ctx, r.x + 12, y + 46, 14, '#3b4878');
      ctx.fillStyle = '#56649a';
      ctx.fillText(`Mở ở ${need ?? 0} điểm`, r.x + 32, y + 58, r.w - 44);
    }
  }
}
