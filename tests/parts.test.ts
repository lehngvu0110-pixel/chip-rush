// Thư viện linh kiện: mã vạch màu điện trở, dữ liệu danh mục, bộ dựng hình + phép chiếu 3D và điều khiển camera.
import { describe, expect, it } from 'vitest';
import { PARTS, formatOhms, partById, resistorBands, resistorDigits } from '../src/core/parts/catalog';
import {
  box,
  centroid,
  defaultView,
  dot,
  fit,
  label,
  lathe,
  length,
  newellNormal,
  orbit,
  project,
  sub,
  transform,
  rotY,
  tube,
  zoomAt,
  PITCH_LIMIT,
  ZOOM_MAX,
  ZOOM_MIN,
  type Mesh,
  type Vec3,
  type View,
} from '../src/render/mesh3d';
import { partModel } from '../src/render/part-models';
import { PART_SYMBOLS } from '../src/ui/part-symbols';

describe('mã vạch màu điện trở', () => {
  it('tách 2 chữ số + số mũ', () => {
    expect(resistorDigits(4700)).toEqual([4, 7, 2]);
    expect(resistorDigits(220)).toEqual([2, 2, 1]);
    expect(resistorDigits(10)).toEqual([1, 0, 0]);
    expect(resistorDigits(1_000_000)).toEqual([1, 0, 5]);
    expect(resistorDigits(4.7)).toEqual([4, 7, -1]);
    expect(resistorDigits(0.47)).toEqual([4, 7, -2]);
  });
  it('từ chối giá trị không viết được bằng 4 vạch', () => {
    expect(resistorDigits(4701)).toBeNull();
    expect(resistorDigits(0)).toBeNull();
    expect(resistorDigits(-10)).toBeNull();
    expect(resistorDigits(Number.NaN)).toBeNull();
    expect(resistorDigits(0.047)).toBeNull(); // cần hệ số ×0,001: không có màu
    expect(resistorBands(4701)).toBeNull();
  });
  it('4,7 kΩ ±5% = Vàng Tím Đỏ Nhũ vàng; 330 Ω ±10% = Cam Cam Nâu Nhũ bạc', () => {
    expect(resistorBands(4700)?.map((b) => b.name)).toEqual(['Vàng', 'Tím', 'Đỏ', 'Nhũ vàng']);
    expect(resistorBands(330, 10)?.map((b) => b.name)).toEqual(['Cam', 'Cam', 'Nâu', 'Nhũ bạc']);
    expect(resistorBands(4.7)?.[2]?.name).toBe('Nhũ vàng');
  });
  it('định dạng giá trị kiểu Việt Nam', () => {
    expect(formatOhms(4700)).toBe('4,7 kΩ');
    expect(formatOhms(220)).toBe('220 Ω');
    expect(formatOhms(1_000_000)).toBe('1 MΩ');
  });
});

describe('danh mục linh kiện', () => {
  it('id không trùng, đủ nội dung, có mô hình 3D và ký hiệu sơ đồ', () => {
    expect(new Set(PARTS.map((p) => p.id)).size).toBe(PARTS.length);
    for (const p of PARTS) {
      expect(partById(p.id)).toBe(p);
      expect(p.summary.length).toBeGreaterThan(40);
      expect(p.chip.length).toBeGreaterThan(40);
      expect(p.specs.length).toBeGreaterThan(0);
      expect(PART_SYMBOLS[p.id]).toContain('<svg');
      const m = partModel(p.id);
      expect(m.length).toBeGreaterThan(20);
      expect(m.length, p.id).toBeLessThan(700); // giữ nhẹ cho máy yếu (26/10: cuộn cảm từng 1406 mặt)
      for (const f of m) for (const v of f.pts) for (const c of v) expect(Number.isFinite(c)).toBe(true);
    }
    expect(partById('khong-co')).toBeUndefined();
  });
  it('vạch màu ghi ở thông số khớp với điện trở mẫu', () => {
    const row = partById('resistor')!.specs.find(([k]) => k.startsWith('Vạch màu'))!;
    expect(row[1]).toContain('Vàng 4 · Tím 7 · Đỏ ×100 · Nhũ vàng ±5% → 4,7 kΩ');
  });
});

/** Pháp tuyến mỗi mặt phải quay ra xa tâm `c` (mặt lồi). */
const outward = (m: Mesh, c: Vec3 = [0, 0, 0]): boolean => m.every((f) => dot(newellNormal(f.pts), sub(centroid(f.pts), c)) > 0);

describe('dựng hình 3D', () => {
  it('khối tròn xoay, hộp, ống: mọi mặt quay ra ngoài', () => {
    const cyl = lathe([[0, -1], [1, -1], [1, 1], [0, 1]], 12, '#888');
    expect(cyl).toHaveLength(36);
    expect(outward(cyl)).toBe(true);
    expect(outward(box([-1, -2, -3], [1, 2, 3], '#888'))).toBe(true);
    // ống thẳng: kiểm tra mặt bên quay ra xa trục
    const t = tube([[0, 0, 0], [0, 5, 0]], 0.5, 6, '#888');
    for (const f of t.slice(0, 6)) {
      const c = centroid(f.pts);
      expect(dot(newellNormal(f.pts), [c[0], 0, c[2]])).toBeGreaterThan(0);
    }
  });
  it('hình xuyến (biên tròn ngược chiều kim đồng hồ) quay ra ngoài ống', () => {
    const circle: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      circle.push([3 + Math.cos(a), Math.sin(a)]);
    }
    const torus = lathe(circle, 16, '#888');
    for (const f of torus) {
      const c = centroid(f.pts);
      const r = Math.hypot(c[0], c[2]);
      const ring: Vec3 = [(c[0] / r) * 3, 0, (c[2] / r) * 3]; // tâm ống gần nhất
      expect(dot(newellNormal(f.pts), sub(c, ring))).toBeGreaterThan(0);
    }
  });
  it('fit() đưa mô hình vào mặt cầu bán kính 1, co cả vector chữ in', () => {
    const m = fit([...box([10, 10, 10], [30, 14, 12], '#888'), label('X', [20, 14, 11], [2, 0, 0], [0, 0, 2], '#fff')]);
    let r = 0;
    for (const f of m) for (const p of f.pts) r = Math.max(r, length(p));
    expect(r).toBeCloseTo(1, 6);
    const l = m.find((f) => f.label)!.label!;
    expect(length(l.u)).toBeLessThan(0.2);
  });
  it('transform xoay cả vector chữ in', () => {
    const [f] = transform([label('A', [0, 0, 1], [1, 0, 0], [0, -1, 0], '#fff')], rotY(Math.PI / 2));
    expect(f!.label!.u[2]).toBeCloseTo(-1, 6);
  });
});

describe('phép chiếu', () => {
  const cube = box([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], '#888');
  it('nhìn thẳng: chỉ thấy mặt trước; nhìn chéo: thấy đúng 3 mặt', () => {
    expect(project(cube, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }, 300, 300)).toHaveLength(1);
    expect(project(cube, defaultView(), 300, 300)).toHaveLength(3);
  });
  it('xếp từ xa tới gần (vẽ sau che vẽ trước)', () => {
    const two = [...box([-0.2, -0.2, -0.9], [0.2, 0.2, -0.5], '#111'), ...box([-0.2, -0.2, 0.5], [0.2, 0.2, 0.9], '#eee')];
    const items = project(two, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }, 300, 300);
    for (let i = 1; i < items.length; i++) expect(items[i]!.depth).toBeLessThanOrEqual(items[i - 1]!.depth);
    expect(items[items.length - 1]!.fill).not.toBe(items[0]!.fill);
  });
  it('mặt chữ in bị ẩn khi quay lưng lại', () => {
    const l = [label('IC', [0, 0, 0.5], [0.2, 0, 0], [0, -0.2, 0], '#fff')];
    expect(project(l, { yaw: 0, pitch: 0, zoom: 1, panX: 0, panY: 0 }, 300, 300)).toHaveLength(1);
    expect(project(l, { yaw: Math.PI, pitch: 0, zoom: 1, panX: 0, panY: 0 }, 300, 300)).toHaveLength(0);
  });
});

describe('điều khiển camera', () => {
  it('pitch bị kẹp, yaw xoay tự do 360°', () => {
    const v = orbit(defaultView(), 10_000, 10_000);
    expect(v.pitch).toBe(PITCH_LIMIT);
    expect(orbit(defaultView(), 0, -10_000).pitch).toBe(-PITCH_LIMIT);
    expect(Math.abs(v.yaw)).toBeGreaterThan(Math.PI * 2);
  });
  it('zoom bị kẹp trong [ZOOM_MIN, ZOOM_MAX]', () => {
    expect(zoomAt(defaultView(), 100, 150, 150, 300, 300).zoom).toBe(ZOOM_MAX);
    expect(zoomAt(defaultView(), 0.01, 150, 150, 300, 300).zoom).toBe(ZOOM_MIN);
  });
  it('phóng to quanh con trỏ: điểm dưới con trỏ đứng yên', () => {
    const w = 400;
    const h = 300;
    const v0: View = defaultView();
    const p = { x: 230, y: 170 };
    const v1 = zoomAt(v0, 1.5, p.x, p.y, w, h);
    // điểm màn hình p ứng với q = (p − tâm − pan) / zoom phải giữ nguyên sau khi phóng
    const q = (v: View): [number, number] => [(p.x - w / 2 - v.panX) / v.zoom, (p.y - h / 2 - v.panY) / v.zoom];
    expect(q(v1)[0]).toBeCloseTo(q(v0)[0], 9);
    expect(q(v1)[1]).toBeCloseTo(q(v0)[1], 9);
    // chiếu thật một đỉnh nằm đúng dưới tâm: tâm khung dời theo pan
    const dot0 = project([{ pts: [[0, 0, 0]], rgb: [1, 1, 1], billboard: { text: '.', size: 1 } }], v1, w, h)[0]!.billboard!;
    expect(dot0.x).toBeCloseTo(w / 2 + v1.panX, 6);
  });
});
