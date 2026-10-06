// Bảng màu dùng chung cho Canvas, khớp biến CSS trong ui/styles.css.
// Cặp cyan/cam thay cho đỏ/lục để người mù màu đỏ-lục vẫn phân biệt được.
import type { RenderSurface } from './canvas';

export const THEME = {
  bg: '#0b1020',
  grid: '#1d2647',
  gridStrong: '#2c3866',
  text: '#e8ecf8',
  textDim: '#9aa6c8',
  bit1: '#38e8ff', // dây mang bit 1: sáng
  bit0: '#33406b', // dây mang bit 0: tối (luôn kèm nhãn "0")
  accent: '#ffb020',
  error: '#ff6b9a', // lỗi: hồng-đỏ, luôn kèm nét đứt + dấu ✕ vẽ bằng code
  font: "'Be Vietnam Pro', system-ui, sans-serif",
  /** CHỈ dùng cho chữ số và ASCII (nhiều font mono đặt dấu tiếng Việt sai). */
  monoFont: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
} as const;

/** Bật hiệu ứng phát sáng nếu chất lượng cho phép. `shadowBlur` khá tốn GPU trên máy yếu. */
export function withGlow(s: RenderSurface, color: string, blur: number, draw: () => void): void {
  const ctx = s.ctx;
  if (s.quality === 'high' && !s.reducedMotion) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    draw();
    ctx.restore();
  } else {
    draw();
  }
}
