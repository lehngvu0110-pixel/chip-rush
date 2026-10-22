// Khung xem 3D của Thư viện linh kiện: canvas riêng (không dùng vòng lặp game) để xoay 360° và phóng to.
// - 1 ngón / chuột kéo: xoay; 2 ngón chụm/mở: phóng to quanh điểm giữa 2 ngón, đồng thời kéo dịch
// - Lăn chuột: phóng to quanh con trỏ; chạm đúp: đặt lại góc nhìn
// - Bàn phím (khi canvas được focus): mũi tên xoay, + / − phóng to, 0 đặt lại
// Chỉ vẽ lại khi có thay đổi; tự dừng khi canvas bị gỡ hoặc bị ẩn (không tốn pin ở nền).
import { THEME } from '../render/theme';
import { clampPan, defaultView, drawProjected, orbit, project, zoomAt, PITCH_LIMIT, type Mesh, type View } from '../render/mesh3d';
import { action, button, el } from './dom';

const AUTO_SPEED = 0.55; // rad/s
const MAX_DPR = 2;

function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D | null {
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const bw = Math.max(1, Math.round(w * dpr));
  const bh = Math.max(1, Math.round(h * dpr));
  if (canvas.width !== bw || canvas.height !== bh) {
    canvas.width = bw;
    canvas.height = bh;
  }
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** Ảnh nhỏ tĩnh cho danh sách (vẽ một lần, nền trong suốt). */
export function partThumb(mesh: Mesh, size: number): HTMLCanvasElement {
  const c = el('canvas', 'part-thumb');
  c.style.width = c.style.height = `${size}px`;
  c.setAttribute('aria-hidden', 'true');
  const ctx = fitCanvas(c, size, size);
  // bỏ tên chân: ở cỡ ảnh nhỏ chữ sẽ đè lên nhau
  if (ctx) drawProjected(ctx, project(mesh, { ...defaultView(), zoom: 1.08 }, size, size).filter((it) => !it.billboard), THEME.font);
  return c;
}

export interface PartViewerOpts {
  mesh: Mesh;
  name: string;
  /** giảm chuyển động: không tự xoay lúc mở */
  reducedMotion: boolean;
}

export function partViewer(o: PartViewerOpts): HTMLDivElement {
  const root = el('div', 'part-view');
  const canvas = el('canvas', 'part-canvas');
  canvas.tabIndex = 0;
  // application: trình đọc màn hình chuyển phím mũi tên cho canvas thay vì tự đọc trang
  canvas.setAttribute('role', 'application');
  canvas.setAttribute('aria-label', `Mô hình 3D: ${o.name}. Phím mũi tên để xoay, phím cộng và trừ để phóng to thu nhỏ, phím 0 để đặt lại.`);

  let view: View = defaultView();
  let auto = !o.reducedMotion;
  let raf = 0;
  let last = 0;
  const pointers = new Map<number, { x: number; y: number }>();

  const draw = (): void => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    const ctx = fitCanvas(canvas, w, h);
    if (!ctx) return;
    const g = ctx.createRadialGradient(w / 2, h * 0.45, 0, w / 2, h * 0.45, Math.max(w, h) * 0.75);
    g.addColorStop(0, '#1d2a5a');
    g.addColorStop(1, '#070b18');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    drawProjected(ctx, project(o.mesh, view, w, h), THEME.font);
    // cho test tự động đọc trạng thái camera
    canvas.dataset.zoom = view.zoom.toFixed(2);
    canvas.dataset.yaw = view.yaw.toFixed(2);
  };

  const frame = (now: number): void => {
    raf = 0;
    // card đã bị thay hoặc panel bị ẩn → dừng hẳn (ResizeObserver sẽ đánh thức nếu hiện lại)
    if (!canvas.isConnected || canvas.offsetParent === null) {
      last = 0;
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    if (auto && pointers.size === 0) view = { ...view, yaw: view.yaw + dt * AUTO_SPEED };
    draw();
    if (auto) raf = requestAnimationFrame(frame);
    else last = 0;
  };
  const wake = (): void => {
    if (!raf) raf = requestAnimationFrame(frame);
  };
  const set = (v: View): void => {
    view = v;
    wake();
  };

  // ---- nút điều khiển ----
  const size = (): { w: number; h: number } => ({ w: canvas.clientWidth || 1, h: canvas.clientHeight || 1 });
  const zoomCenter = (k: number): void => {
    const { w, h } = size();
    set(zoomAt(view, k, w / 2, h / 2, w, h));
  };
  const autoBtn = button('btn-small part-auto', '');
  const syncAuto = (): void => {
    autoBtn.textContent = `Tự xoay: ${auto ? 'Bật' : 'Tắt'}`;
    autoBtn.setAttribute('aria-pressed', String(auto));
  };
  const setAuto = (on: boolean): void => {
    auto = on;
    syncAuto();
    wake();
  };
  autoBtn.addEventListener('click', () => setAuto(!auto));
  syncAuto();
  const minus = action('btn-small part-zoom', '−', () => zoomCenter(1 / 1.3));
  minus.setAttribute('aria-label', 'Thu nhỏ');
  const plus = action('btn-small part-zoom', '+', () => zoomCenter(1.3));
  plus.setAttribute('aria-label', 'Phóng to');
  const reset = action('btn-small', 'Đặt lại', () => set(defaultView()));
  reset.setAttribute('aria-label', 'Đặt lại góc nhìn');
  const controls = el('div', 'part-controls');
  controls.append(minus, plus, autoBtn, reset);

  // ---- chạm / chuột ----
  const local = (e: PointerEvent | WheelEvent): { x: number; y: number } => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* một số trình duyệt trong app ném lỗi; vẫn xoay được */
    }
    e.preventDefault();
    pointers.set(e.pointerId, local(e));
    // người xem bắt đầu tự xoay thì tắt xoay tự động (để vật đứng yên ở góc họ chọn)
    if (auto) setAuto(false);
  });
  canvas.addEventListener('pointermove', (e) => {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const cur = local(e);
    pointers.set(e.pointerId, cur);
    const other = [...pointers].find(([id]) => id !== e.pointerId)?.[1];
    if (!other) {
      set(orbit(view, cur.x - prev.x, cur.y - prev.y));
      return;
    }
    // 2 ngón: tỉ lệ khoảng cách = hệ số phóng; điểm giữa dịch = kéo dịch khung
    const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
    const d1 = Math.hypot(cur.x - other.x, cur.y - other.y);
    if (d0 < 1) return;
    const { w, h } = size();
    const m0 = { x: (prev.x + other.x) / 2, y: (prev.y + other.y) / 2 };
    const m1 = { x: (cur.x + other.x) / 2, y: (cur.y + other.y) / 2 };
    const z = zoomAt(view, d1 / d0, m0.x, m0.y, w, h);
    set(clampPan({ ...z, panX: z.panX + m1.x - m0.x, panY: z.panY + m1.y - m0.y }, w, h));
  });
  const up = (e: PointerEvent): void => {
    pointers.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('dblclick', () => set(defaultView()));
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e);
      const { w, h } = size();
      const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      set(zoomAt(view, k, p.x, p.y, w, h));
    },
    { passive: false },
  );
  canvas.addEventListener('keydown', (e) => {
    const step = Math.PI / 12;
    let v: View | null = null;
    if (e.key === 'ArrowLeft') v = { ...view, yaw: view.yaw - step };
    else if (e.key === 'ArrowRight') v = { ...view, yaw: view.yaw + step };
    else if (e.key === 'ArrowUp') v = { ...view, pitch: Math.max(-PITCH_LIMIT, view.pitch - step) };
    else if (e.key === 'ArrowDown') v = { ...view, pitch: Math.min(PITCH_LIMIT, view.pitch + step) };
    else if (e.key === '+' || e.key === '=') zoomCenter(1.3);
    else if (e.key === '-' || e.key === '_') zoomCenter(1 / 1.3);
    else if (e.key === '0' || e.key === 'Home') v = defaultView();
    else return;
    e.preventDefault();
    if (auto) setAuto(false);
    if (v) set(v);
  });

  // vẽ lại khi đổi cỡ (xoay máy, mở bàn phím ảo) và khi canvas vừa được gắn vào trang
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(wake).observe(canvas);
  else window.addEventListener('resize', wake);
  wake();

  const hint = el('p', 'part-hint', 'Kéo để xoay 360° · chụm 2 ngón hoặc lăn chuột để phóng to · chạm đúp để đặt lại');
  root.append(canvas, controls, hint);
  return root;
}
