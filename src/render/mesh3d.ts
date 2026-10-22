// Bộ vẽ 3D siêu nhỏ trên Canvas 2D cho Thư viện linh kiện: lưới đa giác phẳng, chiếu phối cảnh,
// bỏ mặt sau (backface culling), sắp xếp xa → gần (thuật toán hoạ sĩ) và tô sáng Lambert + bóng kim loại.
// Không dùng WebGL/three.js: mô hình chỉ vài trăm tới ~1.500 mặt nên Canvas 2D đủ nhanh, và giữ đúng
// nguyên tắc "không thư viện bên thứ ba chạy trong game" (ADR-0001, COMPLIANCE IV.1).
// Phần tính toán (dựng hình, chiếu, sắp xếp) là hàm thuần để test bằng Vitest; chỉ drawProjected() chạm Canvas.

export type Vec3 = readonly [number, number, number];
export type RGB = readonly [number, number, number];
/** Ma trận 3×3 theo hàng. */
export type Mat3 = readonly [number, number, number, number, number, number, number, number, number];

/** Chữ in trên mặt (u: hướng đọc, v: hướng xuống dòng; độ dài u = cỡ chữ 1 em). */
export interface Label {
  text: string;
  u: Vec3;
  v: Vec3;
}

export interface Face {
  pts: Vec3[];
  rgb: RGB;
  /** kim loại: thêm điểm sáng phản chiếu */
  metal?: boolean;
  /** tự phát sáng (LED): tối thiểu 70% độ sáng ở mọi góc */
  glow?: boolean;
  /** cộng vào độ sâu khi sắp xếp; âm = vẽ sau mặt nằm cùng chỗ (vạch sơn, chữ dán sát mặt) */
  bias?: number;
  /** mặt không tô, chỉ in chữ ở tâm (bị ẩn khi quay lưng lại camera) */
  label?: Label;
  /** chữ luôn quay về phía người xem (tên chân linh kiện); pts[0] là vị trí, size = cỡ chữ */
  billboard?: { text: string; size: number };
}

export type Mesh = Face[];

// ---------------- Vector ----------------
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2]);
export function normalize(a: Vec3): Vec3 {
  const l = length(a);
  return l > 1e-12 ? scale(a, 1 / l) : [0, 0, 0];
}

export function centroid(pts: readonly Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
    z += p[2];
  }
  const n = pts.length || 1;
  return [x / n, y / n, z / n];
}

/** Pháp tuyến đa giác theo phương pháp Newell (đúng cả với đa giác hơi cong hoặc có đỉnh trùng). */
export function newellNormal(pts: readonly Vec3[]): Vec3 {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % pts.length]!;
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  return [nx, ny, nz];
}

/** Đảo thứ tự đỉnh nếu pháp tuyến ngược hướng `out` (để mặt luôn quay ra ngoài vật). */
export function orient(pts: Vec3[], out: Vec3): Vec3[] {
  return dot(newellNormal(pts), out) < 0 ? pts.reverse() : pts;
}

// ---------------- Màu ----------------
export function hexRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, '$&$&') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export interface FaceStyle {
  metal?: boolean;
  glow?: boolean;
  bias?: number;
}

const mk = (pts: Vec3[], color: string, st?: FaceStyle): Face => ({ pts, rgb: hexRgb(color), ...st });

// ---------------- Biến đổi ----------------
export const rotX = (a: number): Mat3 => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
export const rotY = (a: number): Mat3 => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
export const rotZ = (a: number): Mat3 => [Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a), 0, 0, 0, 1];
export const mulVec = (m: Mat3, p: Vec3): Vec3 => [m[0] * p[0] + m[1] * p[1] + m[2] * p[2], m[3] * p[0] + m[4] * p[1] + m[5] * p[2], m[6] * p[0] + m[7] * p[1] + m[8] * p[2]];
const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** p → m·p·k + t (k: hệ số co giãn đều). Trả về lưới mới, không sửa lưới cũ. */
export function transform(mesh: Mesh, m: Mat3 = IDENTITY, t: Vec3 = [0, 0, 0], k = 1): Mesh {
  const P = (p: Vec3): Vec3 => add(scale(mulVec(m, p), k), t);
  const D = (d: Vec3): Vec3 => scale(mulVec(m, d), k);
  return mesh.map((f) => ({
    ...f,
    pts: f.pts.map(P),
    label: f.label && { ...f.label, u: D(f.label.u), v: D(f.label.v) },
    billboard: f.billboard && { ...f.billboard, size: f.billboard.size * k },
  }));
}

export const translate = (mesh: Mesh, t: Vec3): Mesh => transform(mesh, IDENTITY, t);

/** Đưa tâm hộp bao về gốc toạ độ và co sao cho mọi đỉnh nằm trong mặt cầu bán kính `radius`. */
export function fit(mesh: Mesh, radius = 1): Mesh {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const f of mesh)
    for (const p of f.pts)
      for (let i = 0; i < 3; i++) {
        lo[i] = Math.min(lo[i]!, p[i]!);
        hi[i] = Math.max(hi[i]!, p[i]!);
      }
  const c: Vec3 = [(lo[0]! + hi[0]!) / 2, (lo[1]! + hi[1]!) / 2, (lo[2]! + hi[2]!) / 2];
  let r = 1e-9;
  for (const f of mesh) for (const p of f.pts) r = Math.max(r, length(sub(p, c)));
  const k = radius / r;
  return transform(mesh, IDENTITY, scale(c, -k), k);
}

// ---------------- Khối cơ bản ----------------

/**
 * Khối tròn xoay quanh trục y từ đường biên `profile` gồm các điểm [bán kính, y].
 * Quy ước: đi từ trục ở đáy, men theo mặt ngoài lên, kết thúc ở trục trên đỉnh → mọi mặt quay ra ngoài
 * (biên khép kín ngược chiều kim đồng hồ, ví dụ hình xuyến, cũng đúng).
 * `color(i, j)`: màu đoạn biên thứ i ở lát cắt góc thứ j (vẽ vạch màu điện trở, sọc tụ hoá).
 */
export function lathe(profile: readonly (readonly [number, number])[], segs: number, color: string | ((i: number, j: number) => string), st?: FaceStyle): Mesh {
  const out: Mesh = [];
  const at = (r: number, y: number, j: number): Vec3 => {
    const a = (j / segs) * Math.PI * 2;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  for (let i = 0; i + 1 < profile.length; i++) {
    const [r0, y0] = profile[i]!;
    const [r1, y1] = profile[i + 1]!;
    if (r0 === 0 && r1 === 0) continue;
    for (let j = 0; j < segs; j++) {
      const pts: Vec3[] = [];
      if (r0 > 0) pts.push(at(r0, y0, j));
      else pts.push([0, y0, 0]);
      pts.push(at(r1, y1, j));
      if (r1 > 0) pts.push(at(r1, y1, j + 1));
      if (r0 > 0) pts.push(at(r0, y0, j + 1));
      out.push(mk(pts, typeof color === 'string' ? color : color(i, j), st));
    }
  }
  return out;
}

/** Hộp chữ nhật song song trục toạ độ. */
export function box(lo: Vec3, hi: Vec3, color: string, st?: FaceStyle): Mesh {
  const [x0, y0, z0] = lo;
  const [x1, y1, z1] = hi;
  const c: Vec3 = [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2];
  const quads: Vec3[][] = [
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]],
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
    [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
  ];
  return quads.map((q) => mk(orient(q, sub(centroid(q), c)), color, st));
}

/**
 * Lăng trụ: đa giác LỒI `poly` ([x, z]) đẩy dọc trục y từ y0 tới y1 (thân transistor TO-92, vỏ thạch anh).
 */
export function extrude(poly: readonly (readonly [number, number])[], y0: number, y1: number, color: string, st?: FaceStyle): Mesh {
  const out: Mesh = [];
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i]!;
    const [bx, bz] = poly[(i + 1) % poly.length]!;
    const q: Vec3[] = [[ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az]];
    out.push(mk(orient(q, [(ax + bx) / 2 - cx, 0, (az + bz) / 2 - cz]), color, st));
  }
  out.push(mk(orient(poly.map(([x, z]): Vec3 => [x, y1, z]), [0, 1, 0]), color, st));
  out.push(mk(orient(poly.map(([x, z]): Vec3 => [x, y0, z]), [0, -1, 0]), color, st));
  return out;
}

/** Ống tròn chạy theo đường gấp khúc `path` (chân linh kiện, dây quấn cuộn cảm); khung vòng dời song song nên không bị xoắn. */
export function tube(path: readonly Vec3[], radius: number, segs: number, color: string, st?: FaceStyle): Mesh {
  if (path.length < 2) return [];
  const tangents = path.map((_, i) => normalize(sub(path[Math.min(i + 1, path.length - 1)]!, path[Math.max(i - 1, 0)]!)));
  // vector vuông góc ban đầu: chọn trục ít song song với tiếp tuyến nhất
  const t0 = tangents[0]!;
  const ref: Vec3 = Math.abs(t0[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  let u = normalize(cross(t0, ref));
  const rings: Vec3[][] = [];
  for (let i = 0; i < path.length; i++) {
    const t = tangents[i]!;
    // dời song song: chiếu u cũ lên mặt phẳng vuông góc tiếp tuyến mới
    u = normalize(sub(u, scale(t, dot(u, t))));
    const w = cross(t, u);
    const ring: Vec3[] = [];
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      ring.push(add(path[i]!, add(scale(u, radius * Math.cos(a)), scale(w, radius * Math.sin(a)))));
    }
    rings.push(ring);
  }
  const out: Mesh = [];
  for (let i = 0; i + 1 < rings.length; i++) {
    const mid = scale(add(path[i]!, path[i + 1]!), 0.5);
    for (let j = 0; j < segs; j++) {
      const k = (j + 1) % segs;
      const q: Vec3[] = [rings[i]![j]!, rings[i + 1]![j]!, rings[i + 1]![k]!, rings[i]![k]!];
      out.push(mk(orient(q, sub(centroid(q), mid)), color, st));
    }
  }
  out.push(mk(orient([...rings[0]!], scale(tangents[0]!, -1)), color, st));
  out.push(mk(orient([...rings[rings.length - 1]!], tangents[tangents.length - 1]!), color, st));
  return out;
}

/** Đa giác đều (hoặc cung quạt from→to) trong mặt phẳng (u, v) quanh tâm c, quay mặt theo u × v (lỗ bắt vít, chấm chân 1). */
export function disc(c: Vec3, u: Vec3, v: Vec3, r: number, segs: number, color: string, st?: FaceStyle, from = 0, to = Math.PI * 2): Face {
  const pts: Vec3[] = [];
  const full = to - from >= Math.PI * 2 - 1e-9;
  const n = full ? segs : segs + 1;
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / segs;
    pts.push(add(c, add(scale(u, r * Math.cos(a)), scale(v, r * Math.sin(a)))));
  }
  return mk(orient(pts, cross(u, v)), color, st);
}

/** Mặt mang chữ in: tâm c, hướng đọc u, hướng xuống dòng v (cả hai dài đúng 1 em). */
export function label(text: string, c: Vec3, u: Vec3, v: Vec3, color: string, bias = -0.2): Face {
  const q: Vec3[] = [sub(sub(c, u), v), add(sub(c, v), u), add(add(c, u), v), add(sub(c, u), v)];
  // u sang phải, v đi xuống trên màn hình ⇒ mặt quay về phía người đọc theo hướng v × u
  return { pts: orient(q, cross(v, u)), rgb: hexRgb(color), bias, label: { text, u, v } };
}

/** Tên chân luôn quay về phía người xem; vẫn xếp theo độ sâu nên tên chân phía sau bị thân linh kiện che. */
export function pinTag(text: string, at: Vec3, size: number, color: string): Face {
  return { pts: [at], rgb: hexRgb(color), bias: -0.12, billboard: { text, size } };
}

// ---------------- Camera + chiếu ----------------

/** Trạng thái camera quỹ đạo: yaw/pitch (radian), zoom (1 = vừa khung), pan (CSS px). */
export interface View {
  yaw: number;
  pitch: number;
  zoom: number;
  panX: number;
  panY: number;
}

/** Khoảng cách camera tới tâm (đơn vị: bán kính vật = 1). Đủ xa để không có đỉnh nào ra sau camera. */
export const CAM_DIST = 4.5;
/** Ở zoom 1, vật bán kính 1 chiếm FIT × cạnh ngắn của khung. */
export const FIT = 0.43;

/** Đèn chính từ trên-trái-trước, đèn phụ từ dưới-phải (toạ độ camera, đèn đi theo camera như phòng chụp). */
const KEY = normalize([-0.45, 0.75, 0.6]);
const FILL = normalize([0.6, -0.4, 0.5]);
const HALF = normalize(add(KEY, [0, 0, 1]));

export interface Projected {
  /** toạ độ màn hình [x0, y0, x1, y1, ...] (CSS px) */
  xy: number[];
  /** màu đã tô sáng, dạng rgb(...) */
  fill: string;
  /** khoá sắp xếp (càng lớn càng xa) */
  depth: number;
  label?: { text: string; ox: number; oy: number; ux: number; uy: number; vx: number; vy: number };
  billboard?: { text: string; x: number; y: number; size: number };
}

export function focalLength(view: View, w: number, h: number): number {
  return Math.min(w, h) * FIT * CAM_DIST * view.zoom;
}

/** Xoay điểm theo yaw (quanh trục đứng) rồi pitch (ngả về phía người xem). */
export function toCamera(p: Vec3, view: View): Vec3 {
  return mulVec(rotX(view.pitch), mulVec(rotY(view.yaw), p));
}

/**
 * Chiếu cả lưới ra màn hình: bỏ mặt quay lưng, tô sáng, sắp xếp xa → gần.
 * Thuần (không chạm Canvas) để test được.
 */
export function project(mesh: Mesh, view: View, w: number, h: number): Projected[] {
  const f = focalLength(view, w, h);
  const cx = w / 2 + view.panX;
  const cy = h / 2 + view.panY;
  const out: Projected[] = [];
  const toScreen = (p: Vec3): [number, number] => {
    const d = CAM_DIST - p[2];
    return [cx + (p[0] * f) / d, cy - (p[1] * f) / d];
  };
  for (const face of mesh) {
    const pts = face.pts.map((p) => toCamera(p, view));
    const c = centroid(pts);
    const depth = CAM_DIST - c[2] + (face.bias ?? 0);
    if (face.billboard) {
      const [x, y] = toScreen(c);
      out.push({ xy: [], fill: rgbStr(face.rgb), depth, billboard: { text: face.billboard.text, x, y, size: (face.billboard.size * f) / (CAM_DIST - c[2]) } });
      continue;
    }
    const n = normalize(newellNormal(pts));
    // mặt quay lưng camera (camera ở (0, 0, CAM_DIST)) thì bỏ
    if (dot(n, sub([0, 0, CAM_DIST], c)) <= 0) continue;
    const xy: number[] = [];
    for (const p of pts) xy.push(...toScreen(p));
    const item: Projected = { xy, fill: '', depth };
    if (face.label) {
      const lc = centroid(face.pts);
      const o = toScreen(toCamera(lc, view));
      const pu = toScreen(toCamera(add(lc, face.label.u), view));
      const pv = toScreen(toCamera(add(lc, face.label.v), view));
      item.label = { text: face.label.text, ox: o[0], oy: o[1], ux: pu[0] - o[0], uy: pu[1] - o[1], vx: pv[0] - o[0], vy: pv[1] - o[1] };
      item.fill = rgbStr(face.rgb);
    } else {
      item.fill = shade(face, n);
    }
    out.push(item);
  }
  return out.sort((a, b) => b.depth - a.depth);
}

const rgbStr = (c: RGB): string => `rgb(${c[0]},${c[1]},${c[2]})`;

/** Độ sáng Lambert (đèn chính + đèn phụ + nền) và điểm sáng phản chiếu cho kim loại. */
export function shade(face: Pick<Face, 'rgb' | 'metal' | 'glow'>, n: Vec3): string {
  let k = 0.34 + 0.72 * Math.max(0, dot(n, KEY)) + 0.18 * Math.max(0, dot(n, FILL));
  if (face.glow) k = Math.max(k, 0.7) + 0.15;
  const spec = face.metal ? Math.max(0, dot(n, HALF)) ** 22 * 200 : 0;
  const c = (v: number): number => Math.min(255, Math.round(v * k + spec));
  return `rgb(${c(face.rgb[0])},${c(face.rgb[1])},${c(face.rgb[2])})`;
}

// ---------------- Vẽ ----------------
const LABEL_FONT_PX = 24;

/** Vẽ danh sách đã chiếu lên ctx (toạ độ CSS px; ctx đã nhân sẵn DPR). */
export function drawProjected(ctx: CanvasRenderingContext2D, items: readonly Projected[], font: string): void {
  ctx.lineJoin = 'round';
  ctx.lineWidth = 0.8;
  for (const it of items) {
    if (it.billboard) {
      const b = it.billboard;
      const px = Math.max(9, Math.min(22, b.size));
      ctx.font = `700 ${px}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(5,8,18,0.85)';
      ctx.strokeText(b.text, b.x, b.y);
      ctx.fillStyle = it.fill;
      ctx.fillText(b.text, b.x, b.y);
      ctx.lineWidth = 0.8;
      continue;
    }
    if (it.label) {
      const l = it.label;
      // ánh xạ affine (xấp xỉ phối cảnh, đủ đúng với chữ nhỏ); vẽ ở cỡ 24 px rồi co để chữ nét trên mọi trình duyệt
      const k = 1 / LABEL_FONT_PX;
      ctx.save();
      ctx.transform(l.ux * k, l.uy * k, l.vx * k, l.vy * k, l.ox, l.oy);
      ctx.font = `700 ${LABEL_FONT_PX}px ${font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = it.fill;
      ctx.fillText(l.text, 0, 0);
      ctx.restore();
      continue;
    }
    const xy = it.xy;
    ctx.beginPath();
    ctx.moveTo(xy[0]!, xy[1]!);
    for (let i = 2; i < xy.length; i += 2) ctx.lineTo(xy[i]!, xy[i + 1]!);
    ctx.closePath();
    ctx.fillStyle = it.fill;
    ctx.fill();
    // viền cùng màu che khe hở răng cưa giữa các mặt kề nhau
    ctx.strokeStyle = it.fill;
    ctx.stroke();
  }
}

// ---------------- Điều khiển camera (thuần) ----------------
export const ZOOM_MIN = 0.6;
export const ZOOM_MAX = 4;
export const PITCH_LIMIT = 1.45;

export const defaultView = (): View => ({ yaw: -0.55, pitch: 0.38, zoom: 1, panX: 0, panY: 0 });

/** Kéo dx, dy (px) → xoay. Pitch bị kẹp để không lật ngược vật. */
export function orbit(v: View, dx: number, dy: number): View {
  const k = 0.0105;
  return { ...v, yaw: v.yaw + dx * k, pitch: Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, v.pitch + dy * k)) };
}

/**
 * Phóng to/thu nhỏ quanh điểm (px, py) trên khung w×h: điểm dưới ngón tay/con trỏ đứng yên.
 * Ảnh chiếu tuyến tính theo zoom: s = c + pan + zoom·q, nên giữ q cố định ⇒ pan' = p − c − zoom'·q.
 */
export function zoomAt(v: View, factor: number, px: number, py: number, w: number, h: number): View {
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.zoom * factor));
  const qx = (px - w / 2 - v.panX) / v.zoom;
  const qy = (py - h / 2 - v.panY) / v.zoom;
  return clampPan({ ...v, zoom, panX: px - w / 2 - zoom * qx, panY: py - h / 2 - zoom * qy }, w, h);
}

/** Không cho kéo vật ra khỏi khung (tâm vật luôn cách mép khung trong khoảng nửa kích thước vật). */
export function clampPan(v: View, w: number, h: number): View {
  const lim = Math.min(w, h) * FIT * Math.max(0, v.zoom - 0.3);
  const c = (x: number): number => Math.max(-lim, Math.min(lim, x));
  return { ...v, panX: c(v.panX), panY: c(v.panY) };
}
