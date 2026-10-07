// Ký hiệu cổng logic theo hình dạng chuẩn (ANSI/IEEE Std 91 "distinctive shape"),
// vẽ bằng path nên nét ở mọi cỡ. Dùng chung cho VẬN HÀNH (nút), THIẾT KẾ (lưới), KIỂM THỬ.
import type { GateType } from '../core/circuit/types';

export interface GateStyle {
  stroke: string;
  fill?: string;
  lineWidth?: number;
}

/** Vẽ cổng `type` trong hộp (x, y, w, h): chân vào bên trái, chân ra bên phải. */
export function drawGateSymbol(ctx: CanvasRenderingContext2D, type: GateType, x: number, y: number, w: number, h: number, st: GateStyle): void {
  const lw = st.lineWidth ?? 2;
  const top = y + h * 0.1;
  const bot = y + h * 0.9;
  const cy = y + h / 2;
  const bh = bot - top;
  const negated = type === 'NAND' || type === 'NOR' || type === 'XNOR' || type === 'NOT';
  const r = Math.max(2.5, h * 0.09); // bóng tròn = phủ định
  const bx = x + w * 0.22; // mép sau thân
  const ex = x + w * 0.8 - (negated ? 2 * r : 0); // mũi thân
  const bw = ex - bx;
  const inY = type === 'NOT' ? [cy] : [y + h * 0.3, y + h * 0.7];
  const orFamily = type === 'OR' || type === 'NOR' || type === 'XOR' || type === 'XNOR';
  const xorFamily = type === 'XOR' || type === 'XNOR';
  const gap = xorFamily ? Math.max(3, w * 0.07) : 0;
  const ob = bx + gap; // mép sau thân OR (lùi vào nếu là XOR)
  const k = bw * 0.2; // độ cong mép sau OR

  ctx.save();
  ctx.lineWidth = lw;
  ctx.strokeStyle = st.stroke;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // chân vào
  ctx.beginPath();
  for (const iy of inY) {
    ctx.moveTo(x, iy);
    // OR: chân chạm tới mép sau cong (xấp xỉ vị trí đường cong tại iy)
    const t = (iy - top) / bh; // 0..1
    const backX = orFamily ? ob + k * 1.4 * 2 * t * (1 - t) : bx;
    ctx.lineTo(backX, iy);
  }
  ctx.stroke();

  // thân
  ctx.beginPath();
  if (type === 'AND' || type === 'NAND') {
    const rr = bh / 2;
    ctx.moveTo(bx, top);
    ctx.lineTo(ex - rr, top);
    ctx.arc(ex - rr, cy, rr, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(bx, bot);
    ctx.closePath();
  } else if (orFamily) {
    const ow = ex - ob;
    ctx.moveTo(ob, top);
    ctx.quadraticCurveTo(ob + ow * 0.6, top, ex, cy);
    ctx.quadraticCurveTo(ob + ow * 0.6, bot, ob, bot);
    ctx.quadraticCurveTo(ob + k * 1.4, cy, ob, top);
    ctx.closePath();
  } else {
    // NOT: tam giác
    ctx.moveTo(bx, top);
    ctx.lineTo(ex, cy);
    ctx.lineTo(bx, bot);
    ctx.closePath();
  }
  if (st.fill) {
    ctx.fillStyle = st.fill;
    ctx.fill();
  }
  ctx.stroke();

  // XOR: thêm 1 đường cong phía sau
  if (xorFamily) {
    ctx.beginPath();
    ctx.moveTo(bx, top);
    ctx.quadraticCurveTo(bx + k * 1.4, cy, bx, bot);
    ctx.stroke();
  }

  // bóng phủ định + chân ra
  let outX = ex;
  if (negated) {
    ctx.beginPath();
    ctx.arc(ex + r, cy, r, 0, Math.PI * 2);
    if (st.fill) {
      ctx.fillStyle = st.fill;
      ctx.fill();
    }
    ctx.stroke();
    outX = ex + 2 * r;
  }
  ctx.beginPath();
  ctx.moveTo(outX, cy);
  ctx.lineTo(x + w, cy);
  ctx.stroke();
  ctx.restore();
}

/** Ổ khóa nhỏ (cổng chưa mở), vẽ trong ô vuông cạnh `size`. */
export function drawLock(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size * 0.42, size * 0.24, Math.PI, 0);
  ctx.stroke();
  ctx.fillRect(x + size * 0.18, y + size * 0.42, size * 0.64, size * 0.5);
  ctx.restore();
}
