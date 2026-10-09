// Bố cục màn THIẾT KẾ, tính thuần từ kích thước màn hình (test được, dùng chung cho hit-test).

export interface DesignLayout {
  /** bảng chân trị (nằm ngang: mỗi cột = 1 hàng của bảng) */
  table: { x: number; y: number; labelW: number; colW: number; rowH: number; cols: number; rows: number };
  /** lưới */
  grid: { x: number; y: number; cell: number; cols: number; rows: number };
  /** dòng chỉ số PPA dưới lưới */
  ppaY: number;
}

/** Chiều cao thanh công cụ DOM ở đáy (2 hàng) — phải khớp CSS `.design-bar`. */
export const TOOLBAR_H = 118;
const HEADER_H = 50;
/** dải giữa lưới và thanh công cụ: gợi ý công cụ / chọn cổng / thông báo (DOM .design-strip) */
export const MSG_H = 56;
const MAX_CELL = 72;

/** Màn rộng (máy tính, tablet ngang): bảng chân trị đặt bên trái lưới thay vì phía trên. */
export const WIDE_MIN_W = 760;
const isWide = (w: number, h: number): boolean => w >= WIDE_MIN_W && w > h * 1.15;

export function layoutDesign(w: number, h: number, cols: number, rows: number, nIn: number, nOut: number): DesignLayout {
  if (isWide(w, h)) return layoutWide(w, h, cols, rows, nIn, nOut);
  const tCols = 1 << nIn;
  const rowH = 19;
  const labelW = 34;
  const colW = Math.min(40, Math.floor((Math.min(w, 520) - 32 - labelW) / tCols));
  const tRows = nIn + nOut + 1; // + 1 hàng đánh dấu đúng/sai
  const tableW = labelW + colW * tCols;
  const table = { x: Math.round((w - tableW) / 2), y: HEADER_H + 4, labelW, colW, rowH, cols: tCols, rows: tRows };
  const gridTop = table.y + tRows * rowH + 14;
  const gridBottom = h - TOOLBAR_H - MSG_H - 26;
  const cell = Math.max(24, Math.floor(Math.min((Math.min(w, 560) - 24) / cols, (gridBottom - gridTop) / rows, MAX_CELL)));
  const gw = cell * cols;
  const gh = cell * rows;
  const grid = { x: Math.round((w - gw) / 2), y: Math.round(gridTop + Math.max(0, (gridBottom - gridTop - gh) / 2)), cell, cols, rows };
  return { table, grid, ppaY: grid.y + gh + 20 };
}

/**
 * Bố cục ngang: [bảng chân trị] [khoảng cách] [lưới], cả cụm căn giữa. Lưới lấy hết chiều cao còn lại,
 * nên trên laptop thấp (1366×640) ô vẫn đủ lớn thay vì bị bảng chân trị chiếm phần trên.
 */
function layoutWide(w: number, h: number, cols: number, rows: number, nIn: number, nOut: number): DesignLayout {
  const tCols = 1 << nIn;
  const rowH = 24;
  const labelW = 40;
  const colW = 40;
  const tRows = nIn + nOut + 1;
  const tableW = labelW + colW * tCols;
  const tableH = tRows * rowH;
  const gap = 36;
  const top = HEADER_H + 10;
  const bottom = h - TOOLBAR_H - MSG_H - 26;
  const cell = Math.max(24, Math.floor(Math.min((w - 48 - tableW - gap) / cols, (bottom - top) / rows, MAX_CELL)));
  const gw = cell * cols;
  const gh = cell * rows;
  const x0 = Math.round((w - (tableW + gap + gw)) / 2);
  const gy = Math.round(top + Math.max(0, (bottom - top - gh) / 2));
  const table = { x: x0, y: Math.round(gy + Math.max(0, (gh - tableH) / 2)), labelW, colW, rowH, cols: tCols, rows: tRows };
  const grid = { x: x0 + tableW + gap, y: gy, cell, cols, rows };
  return { table, grid, ppaY: grid.y + gh + 20 };
}

/** Ô dưới điểm (x, y), hoặc null nếu ngoài lưới. */
export function cellAtPoint(L: DesignLayout, x: number, y: number): [number, number] | null {
  const c = Math.floor((x - L.grid.x) / L.grid.cell);
  const r = Math.floor((y - L.grid.y) / L.grid.cell);
  return c >= 0 && r >= 0 && c < L.grid.cols && r < L.grid.rows ? [c, r] : null;
}

/** Cột bảng chân trị dưới điểm, hoặc -1. */
export function tableColAtPoint(L: DesignLayout, x: number, y: number): number {
  const t = L.table;
  if (y < t.y || y > t.y + t.rows * t.rowH || x < t.x + t.labelW) return -1;
  const k = Math.floor((x - t.x - t.labelW) / t.colW);
  return k >= 0 && k < t.cols ? k : -1;
}

/**
 * Các ô đi từ `from` tới `to` theo bước ngang/dọc (khi ngón tay lướt nhanh bỏ qua ô).
 * Không gồm ô `from`, gồm ô `to`. Đi theo trục lệch nhiều hơn trước để đường gần đường thẳng nhất.
 */
export function stepCells(from: [number, number], to: [number, number]): [number, number][] {
  const out: [number, number][] = [];
  let [c, r] = from;
  let guard = 0;
  while ((c !== to[0] || r !== to[1]) && guard++ < 64) {
    const dc = to[0] - c;
    const dr = to[1] - r;
    if (Math.abs(dc) >= Math.abs(dr)) c += Math.sign(dc);
    else r += Math.sign(dr);
    out.push([c, r]);
  }
  return out;
}
