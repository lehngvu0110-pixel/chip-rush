// Hiệu ứng ánh sáng giá rẻ cho máy yếu:
// - KHÔNG dùng shadowBlur cho vật thể chuyển động (rất tốn GPU trên Redmi Note 8).
// - Thay vào đó vẽ sẵn 1 "đốm sáng" (radial gradient) vào canvas phụ, mỗi frame chỉ drawImage.
// - Vẽ chồng bằng 'lighter' (cộng màu) để chỗ nhiều hạt sáng hơn, giống ánh neon.
import { rgba } from './color';

const sprites = new Map<string, HTMLCanvasElement>();
const SPRITE_SCALE = 2; // vẽ sprite ở 2x để nét trên màn DPR 2

/** Đốm sáng bán kính `r` (CSS px), lõi trắng nhẹ, viền mờ dần. Có cache theo (màu, r). */
export function glowSprite(color: string, r: number): HTMLCanvasElement {
  const key = `${color}|${r}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const size = Math.ceil(r * 2 * SPRITE_SCALE);
  c.width = c.height = size;
  const g = c.getContext('2d');
  if (g) {
    const m = size / 2;
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    grad.addColorStop(0, 'rgba(255,255,255,0.95)');
    grad.addColorStop(0.12, rgba(color, 0.95));
    grad.addColorStop(0.35, rgba(color, 0.35));
    grad.addColorStop(1, rgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  sprites.set(key, c);
  return c;
}

/** Vẽ đốm sáng tâm (x, y), bán kính hiển thị r*scale. */
export function drawGlow(ctx: CanvasRenderingContext2D, color: string, r: number, x: number, y: number, scale = 1): void {
  const s = glowSprite(color, r);
  const d = r * scale;
  ctx.drawImage(s, x - d, y - d, d * 2, d * 2);
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
}

export interface BurstOptions {
  speed?: number;
  size?: number;
  life?: number;
  gravity?: number;
}

/** Hạt sáng có giới hạn số lượng (cap) để không bao giờ làm tụt khung trên máy yếu. */
export class Particles {
  private items: Particle[] = [];
  constructor(public cap = 80) {}

  get count(): number {
    return this.items.length;
  }

  burst(x: number, y: number, color: string, n: number, o: BurstOptions = {}): void {
    const speed = o.speed ?? 170;
    for (let i = 0; i < n; i++) {
      if (this.items.length >= this.cap) this.items.shift();
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.65);
      const life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.4);
      this.items.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, size: (o.size ?? 7) * (0.6 + Math.random() * 0.6), color, gravity: o.gravity ?? 0 });
    }
  }

  update(dt: number): void {
    const damp = Math.max(0, 1 - 3.2 * dt);
    for (const p of this.items) {
      p.vx *= damp;
      p.vy = p.vy * damp + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.items = this.items.filter((p) => p.life > 0);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.items.length === 0) return;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.items) {
      const k = p.life / p.max;
      ctx.globalAlpha = k;
      drawGlow(ctx, p.color, 8, p.x, p.y, (p.size / 8) * (0.5 + k * 0.5));
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  clear(): void {
    this.items = [];
  }
}

/** true khi font web đã tải xong — hình vẽ sẵn (cache) có chữ phải vẽ lại sau thời điểm này. */
export let fontsReady = typeof document === 'undefined' || !document.fonts;
if (typeof document !== 'undefined' && document.fonts) {
  void document.fonts.ready.then(() => {
    fontsReady = true;
  });
}

/**
 * Vẽ sẵn một hình kích thước w×h (CSS px) vào canvas phụ, nét theo DPR (≤ 2).
 * `pad`: lề thêm quanh hình để nét viền/đổ bóng không bị cắt; khi vẽ ra nhớ lùi lại `pad`.
 * Dùng cho thứ ít đổi (nút, thân chip): mỗi frame chỉ còn 1 lệnh drawImage thay vì vài chục lệnh vẽ.
 */
export function makeLayer(w: number, h: number, pad: number, draw: (g: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const scale = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
  const c = document.createElement('canvas');
  c.width = Math.ceil((w + 2 * pad) * scale);
  c.height = Math.ceil((h + 2 * pad) * scale);
  const g = c.getContext('2d');
  if (g) {
    g.scale(scale, scale);
    g.translate(pad, pad);
    draw(g);
  }
  return c;
}
