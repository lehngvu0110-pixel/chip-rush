// Sinh "bo mạch in" (PCB) trang trí bằng thủ tục, THUẦN (không DOM) để test được.
// Ý tưởng: lưới ô vuông bước `step`; mỗi đường mạch đi theo 8 hướng (ngang/dọc/chéo 45°)
// như dây đồng thật trên PCB, bẻ góc ±45°, không chạm và không sát đường khác,
// tránh các vùng `avoid` (làn chơi, HUD) để không làm rối chữ.
import { createRng, randInt, type Rng } from '../core/util/rng';

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PcbLayout {
  /** mỗi đường mạch = dãy đỉnh (chỉ góc bẻ), toạ độ CSS px */
  traces: Pt[][];
  /** các ô lưới mỗi đường mạch đi qua (dùng để test không chồng nhau) */
  traceCells: number[][];
  /** lỗ via (vòng tròn) ở đầu/cuối đường */
  vias: Pt[];
  /** chip trang trí (thân + chân) */
  chips: Box[];
  /** linh kiện dán nhỏ (điện trở/tụ) */
  smd: Box[];
  step: number;
  cols: number;
  rows: number;
  ox: number;
  oy: number;
}

// 8 hướng theo chiều kim đồng hồ bắt đầu từ phải: chỉ số ±1 = bẻ 45°
const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

export function generatePcb(w: number, h: number, seed: number, avoid: Box[] = [], step = 24): PcbLayout {
  const rng: Rng = createRng(seed);
  const cols = Math.max(2, Math.floor(w / step));
  const rows = Math.max(2, Math.floor(h / step));
  const ox = (w - (cols - 1) * step) / 2;
  const oy = (h - (rows - 1) * step) / 2;
  const px = (c: number): number => ox + c * step;
  const py = (r: number): number => oy + r * step;
  const idx = (c: number, r: number): number => r * cols + c;
  const inside = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < cols && r < rows;

  // 0 = trống, -1 = cấm (avoid/chip), k>0 = thuộc đường mạch k
  const owner = new Int32Array(cols * rows);
  const pad = step * 0.5;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = px(c);
      const y = py(r);
      if (avoid.some((a) => x >= a.x - pad && x <= a.x + a.w + pad && y >= a.y - pad && y <= a.y + a.h + pad)) owner[idx(c, r)] = -1;
    }
  }

  // --- Chip trang trí: khối chữ nhật cần cả vùng (kèm viền 1 ô) trống ---
  const chips: Box[] = [];
  const chipStarts: { c: number; r: number; d: number }[] = [];
  const nChips = Math.min(3, Math.floor((cols * rows) / 140));
  for (let t = 0; t < 40 && chips.length < nChips; t++) {
    const cw = 3 + randInt(rng, 2);
    const ch = 2 + randInt(rng, 2);
    const c0 = 1 + randInt(rng, Math.max(1, cols - cw - 2));
    const r0 = 1 + randInt(rng, Math.max(1, rows - ch - 2));
    let free = true;
    for (let r = r0 - 1; r <= r0 + ch && free; r++) for (let c = c0 - 1; c <= c0 + cw && free; c++) if (!inside(c, r) || owner[idx(c, r)] !== 0) free = false;
    if (!free) continue;
    for (let r = r0; r < r0 + ch; r++) for (let c = c0; c < c0 + cw; c++) owner[idx(c, r)] = -1;
    chips.push({ x: px(c0) - step * 0.3, y: py(r0) - step * 0.3, w: (cw - 1) * step + step * 0.6, h: (ch - 1) * step + step * 0.6 });
    // chân chip: đường mạch xuất phát từ ô ngay trên/dưới thân chip
    for (let c = c0; c < c0 + cw; c++) {
      chipStarts.push({ c, r: r0 - 1, d: 6 }); // đi lên
      chipStarts.push({ c, r: r0 + ch, d: 2 }); // đi xuống
    }
  }

  const traces: Pt[][] = [];
  const traceCells: number[][] = [];
  const vias: Pt[] = [];

  /** ô (c, r) dùng được cho đường k: trống, và 4 ô kề không thuộc đường KHÁC (giữ khe hở). */
  const usable = (c: number, r: number, k: number): boolean => {
    if (!inside(c, r) || owner[idx(c, r)] !== 0) return false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dx;
      const nr = r + dy;
      if (!inside(nc, nr)) continue;
      const o = owner[idx(nc, nr)] ?? 0;
      if (o > 0 && o !== k) return false;
    }
    return true;
  };

  const tryTrace = (c0: number, r0: number, d0: number, minLen: number): void => {
    const k = traces.length + 1;
    if (!usable(c0, r0, k)) return;
    const cells = [idx(c0, r0)];
    owner[idx(c0, r0)] = k;
    const pts: Pt[] = [{ x: px(c0), y: py(r0) }];
    let c = c0;
    let r = r0;
    let d = d0;
    const segs = 2 + randInt(rng, 4);
    for (let s = 0; s < segs; s++) {
      const len = 2 + randInt(rng, 5);
      let moved = 0;
      for (let i = 0; i < len; i++) {
        const [dx, dy] = DIRS[d] as readonly [number, number];
        const nc = c + dx;
        const nr = r + dy;
        if (!usable(nc, nr, k)) break;
        // đi chéo: 2 ô "góc" cũng phải trống, để 2 đường chéo không cắt nhau giữa 4 ô
        if (dx !== 0 && dy !== 0 && (!usable(c + dx, r, k) || !usable(c, r + dy, k))) break;
        c = nc;
        r = nr;
        owner[idx(c, r)] = k;
        cells.push(idx(c, r));
        moved++;
      }
      if (moved === 0) break;
      pts.push({ x: px(c), y: py(r) });
      d = (d + (rng() < 0.5 ? 1 : 7)) % 8; // bẻ góc 45° trái/phải
    }
    if (cells.length < minLen) {
      for (const cell of cells) owner[cell] = 0; // ngắn quá: bỏ, trả ô lại
      return;
    }
    traces.push(pts);
    traceCells.push(cells);
    vias.push(pts[pts.length - 1] as Pt);
    if (rng() < 0.5) vias.push(pts[0] as Pt);
  };

  for (const st of chipStarts) if (rng() < 0.7) tryTrace(st.c, st.r, st.d, 3);
  const attempts = Math.floor((cols * rows) / 5);
  for (let t = 0; t < attempts; t++) {
    const d = rng() < 0.75 ? 2 * randInt(rng, 4) : 2 * randInt(rng, 4) + 1; // ưu tiên ngang/dọc
    tryTrace(randInt(rng, cols), randInt(rng, rows), d, 4);
  }

  // --- Linh kiện dán: 2 pad nhỏ ở ô trống ---
  const smd: Box[] = [];
  for (let t = 0; t < 60 && smd.length < Math.floor((cols * rows) / 90); t++) {
    const c = randInt(rng, cols - 1);
    const r = randInt(rng, rows);
    if (owner[idx(c, r)] !== 0 || owner[idx(c + 1, r)] !== 0) continue;
    owner[idx(c, r)] = owner[idx(c + 1, r)] = -1;
    smd.push({ x: px(c) - 4, y: py(r) - 4, w: step + 8, h: 8 });
  }

  return { traces, traceCells, vias, chips, smd, step, cols, rows, ox, oy };
}

/** Độ dài từng đường mạch và độ dài tích lũy tại mỗi đỉnh (dùng để chạy xung điện). */
export function polylineLengths(pts: Pt[]): number[] {
  const acc = [0];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1] as Pt;
    const b = pts[i] as Pt;
    acc.push((acc[i - 1] as number) + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return acc;
}

/** Điểm nằm cách đầu đường `d` px (kẹp vào [0, tổng độ dài]). */
export function pointAt(pts: Pt[], acc: number[], d: number): Pt {
  const total = acc[acc.length - 1] ?? 0;
  const dd = Math.max(0, Math.min(total, d));
  for (let i = 1; i < pts.length; i++) {
    const a1 = acc[i] as number;
    if (dd <= a1) {
      const a0 = acc[i - 1] as number;
      const p = pts[i - 1] as Pt;
      const q = pts[i] as Pt;
      const t = a1 === a0 ? 0 : (dd - a0) / (a1 - a0);
      return { x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t };
    }
  }
  return pts[pts.length - 1] ?? { x: 0, y: 0 };
}
