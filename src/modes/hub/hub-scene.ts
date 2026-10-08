// Màn hình chính: một con chip (die) nhìn từ trên xuống, chia 3 khối = 3 công đoạn (GDD "Câu chuyện khung"):
// THIẾT KẾ, KIỂM THỬ, VẬN HÀNH. Khối vẽ trên canvas; nút bấm thật là nút DOM trong suốt đặt đúng chỗ
// (đọc được bằng trình đọc màn hình, test tự động bấm được). Phần tĩnh vẽ sẵn 1 lần; mỗi frame chỉ vẽ xung trên bus.
import type { RenderSurface } from '../../render/canvas';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { drawGlow, fontsReady, makeLayer } from '../../render/fx';
import { drawLock } from '../../render/gate-symbol';
import { PcbBackdrop } from '../../render/pcb';
import { THEME } from '../../render/theme';
import type { Scene } from '../../scene';

export type BlockId = 'design' | 'debug' | 'runtime';

/** Vị trí 3 khối trong die (tỉ lệ 0..1) — dùng chung cho canvas và nút DOM. */
export const DIE_BLOCKS: Record<BlockId, { x: number; y: number; w: number; h: number }> = {
  design: { x: 0.07, y: 0.07, w: 0.48, h: 0.49 },
  debug: { x: 0.59, y: 0.07, w: 0.34, h: 0.49 },
  runtime: { x: 0.07, y: 0.6, w: 0.86, h: 0.33 },
};

export interface HubStats {
  designStars: number;
  designMax: number;
  debugStars: number;
  debugMax: number;
  debugOpen: boolean;
  bestEndless: number;
  best60: number;
}

const COLOR: Record<BlockId, string> = { design: THEME.bit1, debug: THEME.accent, runtime: '#a07cff' };

/** RNG nhỏ có seed để hoạ tiết khối luôn giống nhau. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class HubScene implements Scene {
  private readonly pcb = new PcbBackdrop(2027, { pulses: 12, intensity: 0.9 });
  private surf: RenderSurface | null = null;
  private layer: { key: string; img: HTMLCanvasElement } | null = null;
  private time = 0;

  constructor(
    private readonly slot: HTMLElement,
    private readonly stats: HubStats,
  ) {}

  update(dt: number): void {
    this.time += dt;
    if (this.surf) this.pcb.update(dt, this.surf);
  }

  private dieRect(): { x: number; y: number; s: number } | null {
    const r = this.slot.getBoundingClientRect();
    if (r.width < 10 || this.slot.offsetParent === null) return null;
    return { x: r.left, y: r.top, s: Math.min(r.width, r.height) };
  }

  render(s: RenderSurface): void {
    this.surf = s;
    const d = this.dieRect();
    this.pcb.ensure(s, d ? [{ x: d.x - 12, y: d.y - 12, w: d.s + 24, h: d.s + 24 }] : []);
    this.pcb.draw(s);
    if (!d) return;
    const ctx = s.ctx;
    const key = `${Math.round(d.s)}|${fontsReady ? 1 : 0}`;
    if (!this.layer || this.layer.key !== key) this.layer = { key, img: makeLayer(d.s, d.s, 8, (g) => this.paintDie(g, d.s)) };
    if (!s.reducedMotion) drawGlow(ctx, THEME.bit1, d.s * 0.7, d.x + d.s / 2, d.y + d.s / 2, 0.55);
    ctx.drawImage(this.layer.img, d.x - 8, d.y - 8, d.s + 16, d.s + 16);
    if (!s.reducedMotion) this.drawPulses(ctx, d);
  }

  /** Xung dữ liệu chạy trên bus nối 3 khối: thiết kế → kiểm thử → vận hành. */
  private drawPulses(ctx: CanvasRenderingContext2D, d: { x: number; y: number; s: number }): void {
    const P = (fx: number, fy: number): [number, number] => [d.x + fx * d.s, d.y + fy * d.s];
    const D = DIE_BLOCKS;
    const buses: [number, number, number, number, string][] = [];
    // thiết kế → kiểm thử (ngang, giữa khe 2 khối)
    for (const fy of [0.2, 0.33, 0.46]) {
      const [x1, y] = P(D.design.x + D.design.w, fy);
      const [x2] = P(D.debug.x, fy);
      buses.push([x1, y, x2, y, COLOR.design]);
    }
    // thiết kế, kiểm thử → vận hành (dọc)
    for (const fx of [0.2, 0.36, 0.7, 0.82]) {
      const [x, y1] = P(fx, D.design.y + D.design.h);
      const [, y2] = P(fx, D.runtime.y);
      buses.push([x, y1, x, y2, fx < 0.55 ? COLOR.design : COLOR.debug]);
    }
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = 'lighter';
    buses.forEach(([x1, y1, x2, y2, col], i) => {
      const t = (this.time * 0.9 + i * 0.37) % 1;
      drawGlow(ctx, col, 7, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 1);
    });
    // khối đang "hoạt động": quầng sáng thở chậm
    for (const id of ['design', 'debug', 'runtime'] as BlockId[]) {
      if (id === 'debug' && !this.stats.debugOpen) continue;
      const b = D[id];
      const a = 0.25 + 0.15 * Math.sin(this.time * 1.6 + (id === 'debug' ? 2 : id === 'runtime' ? 4 : 0));
      ctx.globalAlpha = a;
      drawGlow(ctx, COLOR[id], d.s * 0.18, d.x + (b.x + b.w / 2) * d.s, d.y + (b.y + b.h / 2) * d.s, 1);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  /** Vẽ die tĩnh (gốc 0,0, cạnh S): khung, chân pad, 3 khối có hoạ tiết riêng, nhãn và tiến độ. */
  private paintDie(g: CanvasRenderingContext2D, S: number): void {
    const R = rng(77);
    // khung die + viền kim loại
    roundRectPath(g, 0, 0, S, S, S * 0.05);
    const bg = g.createLinearGradient(0, 0, S, S);
    bg.addColorStop(0, '#141d3f');
    bg.addColorStop(1, '#090e22');
    g.fillStyle = bg;
    g.fill();
    g.strokeStyle = '#3b4f86';
    g.lineWidth = 2;
    g.stroke();
    roundRectPath(g, S * 0.025, S * 0.025, S * 0.95, S * 0.95, S * 0.035);
    g.strokeStyle = 'rgba(122,147,200,0.25)';
    g.lineWidth = 1;
    g.stroke();
    // pad chân (bond pad) quanh mép
    g.fillStyle = 'rgba(190,200,230,0.35)';
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = 0.09 + (0.82 * i) / (n - 1);
      for (const [x, y] of [[t * S, S * 0.008], [t * S, S * 0.977], [S * 0.008, t * S], [S * 0.977, t * S]] as const) g.fillRect(x - 3, y - 0, 6, 6);
    }
    // kí hiệu góc như die thật
    g.font = `700 ${Math.max(8, S * 0.026)}px ${THEME.monoFont}`;
    g.fillStyle = 'rgba(154,166,200,0.45)';
    g.textAlign = 'right';
    g.fillText('CR-2027 · 7nm', S * 0.93, S * 0.975);
    g.beginPath();
    g.arc(S * 0.05, S * 0.05, S * 0.012, 0, Math.PI * 2);
    g.fill();

    const label = (id: BlockId, title: string, line1: string, frac: number, locked: boolean): void => {
      const b = DIE_BLOCKS[id];
      const x = b.x * S;
      const y = b.y * S;
      const w = b.w * S;
      const h = b.h * S;
      const col = COLOR[id];
      roundRectPath(g, x, y, w, h, S * 0.025);
      const f = g.createLinearGradient(0, y, 0, y + h);
      f.addColorStop(0, rgba(col, locked ? 0.05 : 0.14));
      f.addColorStop(1, rgba(col, locked ? 0.02 : 0.05));
      g.fillStyle = f;
      g.fill();
      g.strokeStyle = rgba(col, locked ? 0.25 : 0.75);
      g.lineWidth = 1.5;
      g.stroke();
      // hoạ tiết bên trong (mờ), chừa chỗ chữ ở đáy khối
      g.save();
      roundRectPath(g, x + 3, y + 3, w - 6, h - 6, S * 0.02);
      g.clip();
      g.globalAlpha = locked ? 0.25 : 0.55;
      const top = y + 6;
      const bottom = y + h * 0.52;
      if (id === 'design') {
        // hàng ô chuẩn (standard cells)
        for (let yy = top; yy < bottom; yy += 7) {
          let xx = x + 6;
          while (xx < x + w - 8) {
            const cw = 4 + Math.floor(R() * 10);
            g.fillStyle = rgba(col, 0.25 + R() * 0.35);
            g.fillRect(xx, yy, Math.min(cw, x + w - 8 - xx), 4);
            xx += cw + 2;
          }
        }
      } else if (id === 'debug') {
        // lưới điểm đo + vài que đo
        for (let yy = top + 3; yy < bottom; yy += 9) {
          for (let xx = x + 8; xx < x + w - 6; xx += 9) {
            g.fillStyle = rgba(col, R() < 0.12 ? 0.9 : 0.25);
            g.fillRect(xx, yy, 4, 4);
          }
        }
      } else {
        // làn bit chạy ngang (như ALU / đường ống)
        for (let yy = top + 2; yy < y + h * 0.5; yy += 8) {
          g.strokeStyle = rgba(col, 0.35);
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x + 6, yy);
          g.lineTo(x + w - 6, yy);
          g.stroke();
          for (let xx = x + 10 + R() * 30; xx < x + w - 14; xx += 26 + R() * 40) {
            g.fillStyle = rgba(col, 0.8);
            g.fillRect(xx, yy - 2, 8, 4);
          }
        }
      }
      g.restore();
      // chữ
      const fs = Math.max(13, S * 0.048);
      g.textAlign = 'left';
      g.font = `700 ${fs}px ${THEME.font}`;
      g.fillStyle = locked ? 'rgba(232,236,248,0.45)' : THEME.text;
      g.fillText(title, x + 10, y + h - fs * 1.75, w - 20);
      g.font = `${Math.max(11, S * 0.034)}px ${THEME.font}`;
      g.fillStyle = locked ? 'rgba(154,166,200,0.6)' : rgba(col, 0.95);
      g.fillText(line1, x + 10, y + h - fs * 0.7, w - 20);
      // thanh tiến độ
      const bw = w - 20;
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x + 10, y + h - 8, bw, 3);
      g.fillStyle = col;
      g.fillRect(x + 10, y + h - 8, bw * Math.max(0, Math.min(1, frac)), 3);
      if (locked) drawLock(g, x + w - 26, y + 10, 16, 'rgba(154,166,200,0.7)');
    };
    const st = this.stats;
    label('design', 'THIẾT KẾ', `${st.designStars}/${st.designMax} sao`, st.designMax ? st.designStars / st.designMax : 0, false);
    label('debug', 'KIỂM THỬ', st.debugOpen ? `${st.debugStars}/${st.debugMax} sao` : 'Qua D05 để mở', st.debugMax ? st.debugStars / st.debugMax : 0, !st.debugOpen);
    label('runtime', 'VẬN HÀNH', `Kỷ lục vô tận ${st.bestEndless} · 60 giây ${st.best60}`, Math.min(1, st.bestEndless / 500), false);
  }
}
