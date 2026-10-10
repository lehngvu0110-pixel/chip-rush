// Nền bo mạch neon: phần tĩnh vẽ MỘT LẦN vào canvas phụ (chỉ vẽ lại khi đổi cỡ màn hình),
// mỗi frame chỉ drawImage + vài "xung điện" chạy dọc đường mạch → rẻ cả trên máy yếu.
import type { RenderSurface } from './canvas';
import { MAX_DPR } from './canvas';
import { rgba } from './color';
import { drawGlow } from './fx';
import { generatePcb, pointAt, polylineLengths, type Box, type PcbLayout } from './pcb-layout';
import { roundRectPath } from './draw';
import { THEME } from './theme';

const lastOf = (a: number[] | undefined): number => (a && a.length ? (a[a.length - 1] as number) : 0);

interface Pulse {
  trace: number;
  d: number;
  speed: number;
  color: string;
  /** xung "bùng" sau khi trả lời đúng: chạy 1 lần rồi biến mất */
  oneShot: boolean;
}

export interface PcbOptions {
  /** số xung chạy nền ở chất lượng cao (thấp hoặc giảm chuyển động: 0) */
  pulses: number;
  /** độ sáng đường mạch 0..1 */
  intensity?: number;
}

export class PcbBackdrop {
  layout: PcbLayout | null = null;
  private lengths: number[][] = [];
  private key = '';
  private pulses: Pulse[] = [];

  constructor(
    private readonly seed: number,
    private readonly opts: PcbOptions,
  ) {}

  /** Tạo lại bố cục nếu kích thước/vùng tránh thay đổi. Gọi đầu mỗi render (rẻ khi không đổi). */
  ensure(s: RenderSurface, avoid: Box[] = [], decorate?: (g: CanvasRenderingContext2D) => void): void {
    const key = `${Math.round(s.width)}x${Math.round(s.height)}|${avoid.map((a) => `${Math.round(a.x)},${Math.round(a.y)},${Math.round(a.w)},${Math.round(a.h)}`).join(';')}`;
    if (key === this.key && s.backdropOwner === this) return;
    if (key !== this.key) {
      this.layout = generatePcb(s.width, s.height, this.seed, avoid);
      this.lengths = this.layout.traces.map(polylineLengths);
      this.pulses = [];
    }
    this.key = key;
    if (this.layout) this.paint(s.backdrop, s.width, s.height, this.layout, decorate);
    s.backdropOwner = this;
  }

  /** Vẽ phần tĩnh vào canvas nền (lớp dưới). Chỉ chạy khi đổi cỡ màn hình hoặc đổi scene. */
  private paint(c: HTMLCanvasElement, w: number, h: number, L: PcbLayout, decorate?: (g: CanvasRenderingContext2D) => void): void {
    const scale = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    c.width = Math.max(1, Math.round(w * scale));
    c.height = Math.max(1, Math.round(h * scale));
    const g = c.getContext('2d', { alpha: false });
    if (!g) return;
    g.setTransform(scale, 0, 0, scale, 0, 0);
    const k = this.opts.intensity ?? 1;

    // nền: xanh đen, sáng nhẹ ở giữa như ánh đèn chiếu xuống bo mạch
    const bg = g.createRadialGradient(w / 2, h * 0.38, 0, w / 2, h * 0.38, Math.max(w, h) * 0.75);
    bg.addColorStop(0, '#0f1a38');
    bg.addColorStop(1, THEME.bg);
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // chấm lưới mờ (giống lớp silkscreen)
    g.fillStyle = rgba('#5b6fa8', 0.1 * k);
    for (let r = 0; r < L.rows; r++) for (let col = 0; col < L.cols; col++) g.fillRect(L.ox + col * L.step - 0.75, L.oy + r * L.step - 0.75, 1.5, 1.5);

    // đường mạch: 2 lớp nét (viền tối + lõi sáng hơn) cho cảm giác dây đồng phủ sơn
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const [lw, col] of [[5, rgba('#1a3560', 0.55 * k)], [2, rgba('#2b5a8f', 0.6 * k)]] as const) {
      g.lineWidth = lw;
      g.strokeStyle = col;
      g.beginPath();
      for (const t of L.traces) {
        t.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y) : g.lineTo(p.x, p.y)));
      }
      g.stroke();
    }
    // via: vòng đồng + lỗ tối
    for (const v of L.vias) {
      g.beginPath();
      g.arc(v.x, v.y, 4.5, 0, Math.PI * 2);
      g.fillStyle = rgba('#3d6fa8', 0.7 * k);
      g.fill();
      g.beginPath();
      g.arc(v.x, v.y, 2, 0, Math.PI * 2);
      g.fillStyle = THEME.bg;
      g.fill();
    }
    // linh kiện dán
    for (const b of L.smd) {
      g.fillStyle = rgba('#3d6fa8', 0.45 * k);
      g.fillRect(b.x, b.y, 8, b.h);
      g.fillRect(b.x + b.w - 8, b.y, 8, b.h);
      g.fillStyle = rgba('#1a2a4d', 0.9 * k);
      g.fillRect(b.x + 8, b.y + 1, b.w - 16, b.h - 2);
    }
    // chip trang trí: thân đen bóng + hàng chân trên/dưới
    for (const b of L.chips) {
      g.fillStyle = rgba('#7f93bf', 0.35 * k);
      for (let x = b.x + 8; x < b.x + b.w - 4; x += 8) {
        g.fillRect(x - 1.5, b.y - 5, 3, 5);
        g.fillRect(x - 1.5, b.y + b.h, 3, 5);
      }
      roundRectPath(g, b.x, b.y, b.w, b.h, 4);
      g.fillStyle = rgba('#141c36', 0.95);
      g.fill();
      g.strokeStyle = rgba('#3a4f85', 0.6 * k);
      g.lineWidth = 1;
      g.stroke();
      g.beginPath();
      g.arc(b.x + 7, b.y + 7, 2, 0, Math.PI * 2);
      g.fillStyle = rgba('#3a4f85', 0.8 * k);
      g.fill();
    }
    // tối dần ở mép (vignette) để mắt tập trung vào giữa
    const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.8);
    vg.addColorStop(0, 'rgba(5,8,18,0)');
    vg.addColorStop(1, 'rgba(5,8,18,0.6)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    decorate?.(g); // phần tĩnh riêng của scene (ví dụ ray làn rơi)
  }

  private spawn(oneShot: boolean, color?: string, speed?: number): void {
    const n = this.layout?.traces.length ?? 0;
    if (n === 0) return;
    const trace = Math.floor(Math.random() * n);
    this.pulses.push({
      trace,
      d: 0,
      speed: speed ?? 50 + Math.random() * 70,
      color: color ?? (Math.random() < 0.18 ? THEME.accent : THEME.bit1),
      oneShot,
    });
  }

  /** Bắn thêm vài xung nhanh (ví dụ khi trả lời đúng). */
  burst(n: number, color: string = THEME.bit1): void {
    for (let i = 0; i < n; i++) this.spawn(true, color, 220 + Math.random() * 160);
  }

  update(dt: number, s: RenderSurface): void {
    if (!this.layout) return;
    // chất lượng thấp: lớp nền bị ẩn (xem main.ts) nên cũng không chạy xung
    const target = s.reducedMotion || s.quality !== 'high' ? 0 : this.opts.pulses;
    let ambient = this.pulses.filter((p) => !p.oneShot).length;
    while (ambient < target) {
      this.spawn(false);
      // rải vị trí ban đầu để không xuất phát cùng lúc
      const p = this.pulses[this.pulses.length - 1];
      if (p) p.d = Math.random() * lastOf(this.lengths[p.trace]);
      ambient++;
    }
    if (target === 0) this.pulses = [];
    for (const p of this.pulses) p.d += p.speed * dt;
    this.pulses = this.pulses.filter((p) => {
      const total = lastOf(this.lengths[p.trace]);
      if (p.d <= total + 30) return true;
      return false; // xung nền hết đường → bỏ, vòng sau tự sinh xung mới ở đường khác
    });
  }

  draw(s: RenderSurface): void {
    const ctx = s.ctx;
    if (!this.layout || this.pulses.length === 0) return;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.pulses) {
      const pts = this.layout.traces[p.trace];
      const acc = this.lengths[p.trace];
      if (!pts || !acc) continue;
      const total = acc[acc.length - 1] ?? 0;
      // đuôi: 3 đốm nhỏ dần phía sau đầu xung
      for (let i = 3; i >= 0; i--) {
        const d = p.d - i * 8;
        if (d < 0 || d > total) continue;
        const q = pointAt(pts, acc, d);
        ctx.globalAlpha = (1 - i / 4) * (p.oneShot ? 1 : 0.8);
        drawGlow(ctx, p.color, 10, q.x, q.y, i === 0 ? 1 : 0.6 - i * 0.1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }
}
