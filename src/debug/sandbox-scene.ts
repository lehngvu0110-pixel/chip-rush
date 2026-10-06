// Màn THỬ NGHIỆM KỸ THUẬT (tạm thời, trước khi có VẬN HÀNH ngày 09/10).
// Dùng để đo trên điện thoại thật: vẽ lưới, chạm/kéo để bật ô, âm thanh, hiệu ứng glow,
// và một chấm chạy với chu kỳ đúng 3,00 s để kiểm tra màn 120 Hz không làm game chạy nhanh gấp đôi.
import type { GameAudio } from '../render/audio';
import type { RenderSurface } from '../render/canvas';
import { THEME, withGlow } from '../render/theme';
import type { GamePointer } from '../input/pointer';
import type { Scene } from '../scene';

export const CELL = 48; // ≥ 44 CSS px theo yêu cầu vùng chạm
export const BIT_PERIOD_S = 3;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export class SandboxScene implements Scene {
  private cols = 0;
  private rows = 0;
  private ox = 0;
  private oy = 0;
  private lit = new Set<number>();
  private dragging = false;
  private lastCell = -1;
  private paused = false;

  // chấm chạy: vị trí tính từ thời gian thực tích lũy (dt), KHÔNG từ số frame
  private bitT = 0;
  private wraps = 0;
  private lastWrapAt = 0;
  private measuredPeriod = 0;

  private particles: Particle[] = [];
  private w = 0;
  private h = 0;
  heavy = false;

  constructor(
    private readonly audio: GameAudio,
    private readonly now: () => number = () => performance.now(),
  ) {}

  enter(s: RenderSurface): void {
    this.layout(s);
  }

  private layout(s: RenderSurface): void {
    this.w = s.width;
    this.h = s.height;
    this.cols = Math.max(3, Math.min(7, Math.floor((s.width - 32) / CELL)));
    this.rows = Math.max(3, Math.min(8, Math.floor((s.height - 220) / CELL)));
    this.ox = Math.round((s.width - this.cols * CELL) / 2);
    this.oy = Math.round(150 + (s.height - 220 - this.rows * CELL) / 2);
  }

  /** Ô (chỉ số) dưới điểm chạm, hoặc -1. Tách riêng để test. */
  cellAt(x: number, y: number): number {
    const c = Math.floor((x - this.ox) / CELL);
    const r = Math.floor((y - this.oy) / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  onPointer(p: GamePointer): void {
    if (this.paused) return;
    if (p.phase === 'down') {
      this.dragging = true;
      this.lastCell = -1;
    }
    if (p.phase === 'up' || p.phase === 'cancel') {
      this.dragging = false;
      return;
    }
    if (!this.dragging) return;
    const cell = this.cellAt(p.x, p.y);
    if (cell >= 0 && cell !== this.lastCell) {
      this.lastCell = cell;
      if (this.lit.has(cell)) this.lit.delete(cell);
      else this.lit.add(cell);
      this.audio.play('tick');
    }
  }

  update(dt: number): void {
    if (this.paused) return;
    this.bitT += dt;
    if (this.bitT >= BIT_PERIOD_S) {
      this.bitT -= BIT_PERIOD_S;
      const t = this.now();
      if (this.wraps > 0) this.measuredPeriod = (t - this.lastWrapAt) / 1000;
      this.lastWrapAt = t;
      this.wraps++;
    }
    if (this.heavy && this.particles.length < 300) {
      for (let i = 0; i < 10; i++) {
        this.particles.push({ x: Math.random() * this.w, y: Math.random() * this.h, vx: (Math.random() - 0.5) * 120, vy: (Math.random() - 0.5) * 120 });
      }
    }
    if (!this.heavy) this.particles.length = 0;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < 0 || p.x > this.w) p.vx = -p.vx;
      if (p.y < 0 || p.y > this.h) p.vy = -p.vy;
    }
  }

  pause(): void {
    this.paused = true;
    this.dragging = false;
  }

  resume(): void {
    this.paused = false;
    // Không tính khoảng thời gian tạm dừng vào chu kỳ đo
    this.wraps = 0;
  }

  get period(): number {
    return this.measuredPeriod;
  }

  render(s: RenderSurface): void {
    if (s.width !== this.w || s.height !== this.h) this.layout(s);
    const ctx = s.ctx;
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, s.width, s.height);

    // làn chạy của chấm bit
    const laneY = 110;
    const x0 = 24;
    const x1 = s.width - 24;
    ctx.strokeStyle = THEME.gridStrong;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x0, laneY);
    ctx.lineTo(x1, laneY);
    ctx.stroke();
    const bx = x0 + ((x1 - x0) * this.bitT) / BIT_PERIOD_S;
    withGlow(s, THEME.bit1, 16, () => {
      ctx.fillStyle = THEME.bit1;
      ctx.beginPath();
      ctx.arc(bx, laneY, 9, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = THEME.textDim;
    ctx.font = `14px ${THEME.font}`;
    ctx.textAlign = 'left';
    ctx.fillText('Chu kỳ chấm chạy (chuẩn 3,00 s):', 24, 84);
    // Font mono chỉ dùng cho chữ số/ASCII; chữ có dấu tiếng Việt luôn dùng Be Vietnam Pro.
    ctx.font = this.measuredPeriod ? `14px ${THEME.monoFont}` : `14px ${THEME.font}`;
    ctx.fillStyle = THEME.text;
    ctx.textAlign = 'right';
    ctx.fillText(this.measuredPeriod ? `${this.measuredPeriod.toFixed(2)} s` : 'đang đo…', s.width - 24, 84);

    // lưới
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const i = r * this.cols + c;
        const x = this.ox + c * CELL;
        const y = this.oy + r * CELL;
        const on = this.lit.has(i);
        ctx.fillStyle = on ? 'rgba(56,232,255,0.18)' : 'transparent';
        if (on) ctx.fillRect(x + 2, y + 2, CELL - 4, CELL - 4);
        ctx.strokeStyle = on ? THEME.bit1 : THEME.grid;
        ctx.lineWidth = on ? 2 : 1;
        if (on) withGlow(s, THEME.bit1, 12, () => ctx.strokeRect(x + 2, y + 2, CELL - 4, CELL - 4));
        else ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1);
        // nhãn chữ 0/1: không phân biệt chỉ bằng màu
        ctx.fillStyle = on ? THEME.text : THEME.bit0;
        ctx.font = `700 16px ${THEME.monoFont}`;
        ctx.textAlign = 'center';
        ctx.fillText(on ? '1' : '0', x + CELL / 2, y + CELL / 2 + 6);
      }
    }

    // tải nặng: hạt phát sáng để thử giới hạn GPU
    if (this.particles.length) {
      ctx.fillStyle = THEME.accent;
      withGlow(s, THEME.accent, 10, () => {
        for (const p of this.particles) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }

    if (this.paused) {
      ctx.fillStyle = 'rgba(11,16,32,0.6)';
      ctx.fillRect(0, 0, s.width, s.height);
    }
  }
}
