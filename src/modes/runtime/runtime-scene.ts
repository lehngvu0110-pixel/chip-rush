// Màn chơi VẬN HÀNH: gói bit rơi xuống "khe cổng", người chơi chọn cổng (chạm nút hoặc phím 1–4).
// Logic nằm trong game.ts; file này chỉ vẽ, nhận thao tác và tạo hiệu ứng/âm thanh từ sự kiện.
import { RUNTIME } from '../../config';
import type { GateType } from '../../core/circuit/types';
import type { GameAudio } from '../../render/audio';
import type { RenderSurface } from '../../render/canvas';
import { inRect, roundRectPath } from '../../render/draw';
import { THEME, withGlow } from '../../render/theme';
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
  /** đáy làn rơi = khe cổng */
  slotY: number;
  buttons: { gate: GateType; rect: Rect }[];
}

const BTN_H = 72; // ≥ 44 px vùng chạm
const GAP = 12;
const SIDE = 16;
const BOTTOM = 40; // chừa thanh home của iPhone

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
  private floats: Float[] = [];
  private flash: { color: string; t: number } | null = null;
  private shake = 0;
  private banner: { text: string; t: number } | null = { text: 'Chọn cổng cho ra đúng bit mục tiêu', t: 3.5 };
  private hintExpected: { text: string; t: number } | null = null;
  private pressed: { gate: GateType; ok: boolean; t: number } | null = null;
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
    if (this.game.answer(gate)) this.pressed = { gate, ok: valid, t: 0.18 };
  }

  update(dt: number): void {
    this.game.update(dt);
    for (const ev of this.game.drainEvents()) {
      const x = this.packetX();
      const y = this.layout.slotY - 30;
      switch (ev.type) {
        case 'correct':
          this.audio.play('ting');
          this.flash = { color: THEME.bit1, t: 0.25 };
          // Chỉ giữ 1 chữ nổi: trả lời nhanh liên tiếp sẽ không chồng chữ lên nhau
          this.floats = [{ text: ev.multiplier > 1 ? `+${ev.points} ×${ev.multiplier}` : `+${ev.points}`, x, y, t: 0.9, color: THEME.bit1 }];
          break;
        case 'wrong':
        case 'miss':
          this.audio.play('error');
          this.flash = { color: THEME.error, t: 0.3 };
          if (!this.reduced) this.shake = 0.25;
          this.floats = [];
          // Gói mới đã xuất hiện nên ghi rõ đây là đáp án của gói VỪA RỒI
          this.hintExpected = { text: `${ev.type === 'miss' ? 'Chậm quá! ' : ''}Gói vừa rồi cần: ${ev.expected.join(' / ')}`, t: 1.4 };
          break;
        case 'unlock':
          this.banner = { text: `Mở khóa ${ev.gate}: ${GATE_HINT[ev.gate] ?? ''}`, t: 2.5 };
          break;
        case 'end':
          if (!this.endSent) {
            this.endSent = true;
            this.onEnd(this.game.result());
          }
          break;
      }
    }
    // hiệu ứng chạy theo dt (giây thật)
    for (const f of this.floats) {
      f.t -= dt;
      if (!this.reduced) f.y -= 40 * dt;
    }
    this.floats = this.floats.filter((f) => f.t > 0);
    if (this.flash && (this.flash.t -= dt) <= 0) this.flash = null;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);
    if (this.banner && (this.banner.t -= dt) <= 0) this.banner = null;
    if (this.hintExpected && (this.hintExpected.t -= dt) <= 0) this.hintExpected = null;
    if (this.pressed && (this.pressed.t -= dt) <= 0) this.pressed = null;
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
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, s.width, s.height);
    const cx = this.packetX();

    // --- HUD trên: điểm, combo, mạng/thời gian (bên phải chừa chỗ cho nút DOM) ---
    ctx.textAlign = 'left';
    ctx.fillStyle = THEME.text;
    ctx.font = `700 30px ${THEME.monoFont}`;
    ctx.fillText(String(g.score), 20, 50);
    ctx.font = `14px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    const mult = Math.min(RUNTIME.maxMultiplier, 1 + Math.floor(g.combo / RUNTIME.comboStep));
    ctx.fillText(`Chuỗi đúng ${g.combo}  ·  hệ số ×${mult}`, 20, 76);

    ctx.textAlign = 'right';
    if (g.mode === 'sixty') {
      const left = Math.ceil(g.timeLeft);
      ctx.font = `700 22px ${THEME.monoFont}`;
      ctx.fillStyle = left <= 10 ? THEME.accent : THEME.text;
      ctx.fillText(`0:${String(left).padStart(2, '0')}`, s.width - 20, 76);
    } else {
      for (let i = 0; i < RUNTIME.lives; i++) {
        const x = s.width - 20 - (RUNTIME.lives - i) * 22;
        roundRectPath(ctx, x, 62, 16, 16, 4);
        if (i < g.lives) {
          ctx.fillStyle = THEME.bit1;
          ctx.fill();
        } else {
          ctx.strokeStyle = THEME.gridStrong;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // --- Làn rơi + khe cổng ---
    ctx.strokeStyle = THEME.grid;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 8]);
    ctx.beginPath();
    ctx.moveTo(cx, L.laneTop);
    ctx.lineTo(cx, L.slotY);
    ctx.stroke();
    ctx.setLineDash([]);

    const slotW = Math.min(280, s.width - 40);
    roundRectPath(ctx, cx - slotW / 2, L.slotY, slotW, 36, 8);
    ctx.fillStyle = 'rgba(56,232,255,0.06)';
    ctx.fill();
    ctx.strokeStyle = this.flash ? this.flash.color : THEME.gridStrong;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.font = `14px ${THEME.font}`;
    ctx.fillStyle = THEME.textDim;
    ctx.fillText('KHE CỔNG', cx, L.slotY + 23);

    // --- Gói bit ---
    const pw = 210;
    const ph = 76;
    const py = L.laneTop + (L.slotY - L.laneTop - ph) * Math.min(1, g.progress);
    const sx = this.shake > 0 ? Math.sin(this.shake * 80) * 6 : 0;
    this.drawPacket(s, cx - pw / 2 + sx, py, pw, ph);

    // --- Thông báo ---
    ctx.textAlign = 'center';
    if (this.hintExpected) {
      ctx.font = `700 16px ${THEME.font}`;
      ctx.fillStyle = THEME.error;
      ctx.fillText(this.hintExpected.text, cx, L.slotY - 14);
    }
    if (this.banner) {
      ctx.font = `700 15px ${THEME.font}`;
      ctx.fillStyle = THEME.accent;
      ctx.fillText(this.banner.text, s.width / 2, 98, s.width - 32);
    }
    for (const f of this.floats) {
      ctx.globalAlpha = Math.min(1, f.t * 2);
      ctx.font = `700 20px ${THEME.monoFont}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }

    // --- 4 nút cổng ---
    for (const [i, b] of L.buttons.entries()) this.drawButton(s, b.gate, b.rect, i + 1);

    if (g.paused) {
      ctx.fillStyle = 'rgba(11,16,32,0.6)';
      ctx.fillRect(0, 0, s.width, s.height);
    }
  }

  private drawPacket(s: RenderSurface, x: number, y: number, w: number, h: number): void {
    const ctx = s.ctx;
    const p = this.game.packet;
    roundRectPath(ctx, x, y, w, h, 12);
    ctx.fillStyle = THEME.bg;
    ctx.fill();
    withGlow(s, THEME.bit1, 10, () => {
      ctx.strokeStyle = THEME.bit1;
      ctx.lineWidth = 2;
      ctx.stroke();
    });
    const bit = (label: string, v: number, bx: number, highlight: boolean): void => {
      ctx.textAlign = 'center';
      ctx.font = `12px ${THEME.font}`;
      ctx.fillStyle = THEME.textDim;
      ctx.fillText(label, bx, y + 22);
      ctx.font = `700 30px ${THEME.monoFont}`;
      // bit 1 sáng, bit 0 tối — luôn kèm chữ số nên không phụ thuộc màu
      ctx.fillStyle = highlight ? THEME.accent : v ? THEME.bit1 : THEME.textDim;
      ctx.fillText(String(v), bx, y + 58);
    };
    bit('A', p.a, x + 34, false);
    bit('B', p.b, x + 84, false);
    ctx.fillStyle = THEME.textDim;
    ctx.font = `700 22px ${THEME.font}`;
    ctx.textAlign = 'center';
    ctx.fillText('→', x + 128, y + 52);
    bit('Cần ra', p.target, x + 172, true);
  }

  private drawButton(s: RenderSurface, gate: GateType, r: Rect, key: number): void {
    const ctx = s.ctx;
    const open = this.game.unlocked.includes(gate);
    const pressed = this.pressed?.gate === gate ? this.pressed : null;
    roundRectPath(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fillStyle = pressed ? (pressed.ok ? 'rgba(56,232,255,0.25)' : 'rgba(255,107,154,0.25)') : THEME.bg;
    ctx.fill();
    ctx.strokeStyle = open ? (pressed && !pressed.ok ? THEME.error : THEME.bit1) : THEME.grid;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = `700 20px ${THEME.font}`;
    ctx.fillStyle = open ? THEME.text : THEME.bit0;
    ctx.fillText(gate, r.x + 14, r.y + 30);
    ctx.font = `12px ${THEME.monoFont}`;
    ctx.fillStyle = THEME.textDim;
    ctx.textAlign = 'right';
    ctx.fillText(String(key), r.x + r.w - 12, r.y + 24);
    ctx.textAlign = 'left';
    ctx.font = `12px ${THEME.font}`;
    const need = (RUNTIME.unlockAt as Partial<Record<GateType, number>>)[gate];
    ctx.fillText(open ? (GATE_HINT[gate] ?? '') : `Mở ở ${need ?? 0} điểm`, r.x + 14, r.y + 54, r.w - 24);
  }
}
