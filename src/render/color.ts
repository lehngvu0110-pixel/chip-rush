// Tiện ích màu thuần (không DOM) — test được trong Node.

/** '#38e8ff' → [56, 232, 255]. Chấp nhận cả dạng rút gọn '#3ef'. */
export function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a))})`;
}

/** Trộn tuyến tính hai màu hex, t ∈ [0,1]. Trả về chuỗi rgb(). */
export function mixHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const c = ca.map((v, i) => Math.round(v + ((cb[i] ?? 0) - v) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
export const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeOutBack = (t: number): number => {
  const k = clamp01(t);
  const c1 = 1.70158;
  return 1 + (c1 + 1) * (k - 1) ** 3 + c1 * (k - 1) ** 2;
};
