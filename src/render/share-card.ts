// Ảnh thẻ kết quả 1080×1350 (tỉ lệ 4:5 hợp Instagram/Facebook) vẽ bằng Canvas — không dùng ảnh ngoài.
import { rgba } from './color';
import { roundRectPath } from './draw';
import { THEME } from './theme';

export interface ShareCardData {
  /** THIẾT KẾ / KIỂM THỬ / VẬN HÀNH */
  mode: string;
  /** ví dụ "D11 · Cộng nửa" */
  title: string;
  big: string;
  bigLabel: string;
  lines: string[];
  stars?: number;
  /** dòng nhấn mạnh màu cam (ví dụ "Vượt AI kỹ sư!") */
  badge?: string;
  url: string;
}

export const CARD_W = 1080;
export const CARD_H = 1350;

function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Vẽ thẻ vào ctx kích thước CARD_W × CARD_H. */
export function drawShareCard(ctx: CanvasRenderingContext2D, d: ShareCardData): void {
  const W = CARD_W;
  const H = CARD_H;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#111a3a');
  bg.addColorStop(1, '#05080f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  // đường mạch trang trí
  ctx.strokeStyle = 'rgba(61,111,168,0.35)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  const traces: [number, number][][] = [
    [[60, 180], [200, 180], [260, 240], [260, 420]],
    [[1020, 260], [880, 260], [820, 320], [820, 520]],
    [[80, 1180], [240, 1180], [300, 1120], [520, 1120]],
    [[1000, 1040], [860, 1040], [800, 1100], [800, 1240]],
  ];
  for (const t of traces) {
    ctx.beginPath();
    t.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    const [ex, ey] = t[t.length - 1] as [number, number];
    ctx.beginPath();
    ctx.arc(ex, ey, 10, 0, Math.PI * 2);
    ctx.stroke();
  }
  // logo chip nhỏ + tên game
  const lx = W / 2 - 250;
  roundRectPath(ctx, lx, 96, 96, 96, 16);
  ctx.fillStyle = '#1d2852';
  ctx.fill();
  ctx.strokeStyle = THEME.bit1;
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.fillStyle = THEME.accent;
  ctx.beginPath();
  ctx.moveTo(lx + 58, 112);
  ctx.lineTo(lx + 34, 148);
  ctx.lineTo(lx + 50, 148);
  ctx.lineTo(lx + 42, 178);
  ctx.lineTo(lx + 66, 138);
  ctx.lineTo(lx + 50, 138);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = 'left';
  ctx.font = `700 88px ${THEME.font}`;
  ctx.fillStyle = THEME.bit1;
  ctx.fillText('CHIP RUSH', lx + 124, 176);

  // thẻ chính
  roundRectPath(ctx, 90, 280, W - 180, 860, 48);
  ctx.fillStyle = 'rgba(19,27,58,0.92)';
  ctx.fill();
  ctx.strokeStyle = rgba(THEME.bit1, 0.5);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.font = `700 40px ${THEME.font}`;
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(d.mode, W / 2, 370);
  ctx.font = `700 56px ${THEME.font}`;
  ctx.fillStyle = THEME.text;
  ctx.fillText(d.title, W / 2, 450, W - 260);
  if (d.stars !== undefined) {
    for (let i = 0; i < 3; i++) {
      star(ctx, W / 2 + (i - 1) * 110, 560, 46);
      ctx.fillStyle = i < d.stars ? THEME.accent : '#2c3866';
      ctx.fill();
    }
  }
  ctx.font = `700 220px ${THEME.monoFont}`;
  ctx.fillStyle = THEME.bit1;
  ctx.fillText(d.big, W / 2, d.stars !== undefined ? 820 : 760);
  ctx.font = `700 44px ${THEME.font}`;
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(d.bigLabel, W / 2, d.stars !== undefined ? 885 : 830);
  let y = d.stars !== undefined ? 970 : 930;
  ctx.font = `40px ${THEME.font}`;
  for (const ln of d.lines.slice(0, 3)) {
    ctx.fillStyle = THEME.text;
    ctx.fillText(ln, W / 2, y, W - 260);
    y += 58;
  }
  if (d.badge) {
    ctx.font = `700 44px ${THEME.font}`;
    const tw = ctx.measureText(d.badge).width + 80;
    roundRectPath(ctx, W / 2 - tw / 2, 1180, tw, 76, 38);
    ctx.fillStyle = THEME.accent;
    ctx.fill();
    ctx.fillStyle = '#2a1a00';
    ctx.fillText(d.badge, W / 2, 1232);
  }
  ctx.font = `34px ${THEME.font}`;
  ctx.fillStyle = THEME.textDim;
  ctx.fillText(d.url.replace(/^https?:\/\//, ''), W / 2, H - 40);
}

/** Tạo file PNG của thẻ (null nếu trình duyệt không vẽ được). */
export function makeShareFile(d: ShareCardData): Promise<File | null> {
  return new Promise((resolve) => {
    try {
      const c = document.createElement('canvas');
      c.width = CARD_W;
      c.height = CARD_H;
      const ctx = c.getContext('2d');
      if (!ctx) return resolve(null);
      drawShareCard(ctx, d);
      c.toBlob((b) => resolve(b ? new File([b], 'chip-rush.png', { type: 'image/png' }) : null), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
