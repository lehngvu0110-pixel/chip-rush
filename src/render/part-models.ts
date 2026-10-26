// Mô hình 3D của từng linh kiện, dựng bằng code từ khối cơ bản trong mesh3d.ts (không dùng ảnh hay file 3D ngoài).
// Đơn vị khi dựng là mm theo kích thước thật của vỏ linh kiện (datasheet), trục y hướng lên; chân được cắt
// ngắn hơn thật cho gọn khung. Cuối cùng fit() đưa mọi mô hình về cùng cỡ để xem.
import { SAMPLE_OHMS, resistorBands, type PartId } from '../core/parts/catalog';
import { box, disc, extrude, fit, label, lathe, pinTag, rotX, rotZ, transform, tube, type Mesh, type Vec3 } from './mesh3d';

const LEAD = '#c9ced6'; // chân thép mạ thiếc
const TAG = '#ffb020'; // tên chân: màu nhấn cam của game
const INK = '#e8ecf8'; // chữ in trên vỏ đen
const HOLE = '#0b1020'; // lỗ trên tab tản nhiệt = màu nền khung xem
const metal = { metal: true };

/** Chân thẳng đứng từ (x, y0, z) xuống y1. */
const leg = (x: number, y0: number, y1: number, z = 0, r = 0.3): Mesh => tube([[x, y0, z], [x, y1, z]], r, 6, LEAD, metal);

/** Chân của linh kiện nằm ngang (điện trở, diode): ra thẳng theo trục x rồi uốn 90° xuống. */
function axialLead(x0: number, dir: 1 | -1): Mesh {
  const pts: Vec3[] = [[x0, 0, 0], [x0 + dir * 1.6, 0, 0]];
  // cung uốn bán kính 0,8 mm
  for (let i = 1; i <= 4; i++) {
    const a = (i / 4) * (Math.PI / 2);
    pts.push([x0 + dir * (1.6 + 0.8 * Math.sin(a)), -0.8 * (1 - Math.cos(a)), 0]);
  }
  pts.push([x0 + dir * 2.4, -9, 0]);
  return tube(pts, 0.3, 6, LEAD, metal);
}

/** Thân tròn xoay nằm ngang dài 2·half: bán kính r(y) dọc trục, màu theo vị trí y (vạch màu). */
function axialBody(half: number, r: (a: number) => number, colorAt: (y: number) => string, cuts: number[]): Mesh {
  const ys = new Set<number>(cuts.filter((y) => Math.abs(y) < half));
  // 18 lát dọc thân + các mép vạch màu: đủ mượt, ít mặt (máy yếu xoay vẫn mượt, 26/10)
  for (let i = 0; i <= 18; i++) ys.add(-half + (2 * half * i) / 18);
  const sorted = [...ys].sort((a, b) => a - b);
  const profile: [number, number][] = [[0, -half], ...sorted.map((y): [number, number] => [r(Math.abs(y)), y]), [0, half]];
  const mesh = lathe(profile, 16, (i) => {
    const y0 = profile[i]![1];
    const y1 = profile[i + 1]![1];
    return colorAt((y0 + y1) / 2);
  });
  // trục y → trục x (nằm ngang)
  return transform(mesh, rotZ(-Math.PI / 2));
}

/** Bo tròn đầu thân: bán kính r0 ở giữa, giảm dần tới 0 ở hai đầu trong đoạn `round`. */
const roundedEnd = (half: number, round: number, r: (a: number) => number) => (a: number): number => {
  if (a <= half - round) return r(a);
  const t = (a - (half - round)) / round;
  return r(half - round) * Math.sqrt(Math.max(0, 1 - t * t * 0.85));
};

function resistor(): Mesh {
  const half = 3.15;
  const bands = resistorBands(SAMPLE_OHMS) ?? [];
  // 3 vạch giá trị sát một đầu, vạch sai số ở đầu kia
  const at: [number, number][] = [[-2.45, -1.95], [-1.45, -1.0], [-0.55, -0.1], [1.75, 2.25]];
  const cuts = at.flat();
  // thân "xương chó": hai đầu phình (chụp kim loại bên trong), giữa thon
  const r = roundedEnd(half, 0.5, (a) => (a < 1.5 ? 1.1 : a < 2.0 ? 1.1 + 0.2 * Math.sin(((a - 1.5) / 0.5) * (Math.PI / 2)) : 1.3));
  const body = axialBody(half, r, (y) => {
    const k = at.findIndex(([a, b]) => y > a && y < b);
    return k >= 0 && bands[k] ? bands[k]!.hex : '#d8bf8a';
  }, cuts);
  return [...body, ...axialLead(half - 0.2, 1), ...axialLead(-half + 0.2, -1)];
}

function diode(): Mesh {
  const half = 2.6;
  const r = roundedEnd(half, 0.35, () => 1.35);
  const body = axialBody(half, r, (y) => (y > 1.3 && y < 2.0 ? '#b9bec7' : '#1d1d22'), [1.3, 2.0]);
  return [
    ...body,
    ...axialLead(half - 0.2, 1),
    ...axialLead(-half + 0.2, -1),
    label('1N4007', [-0.6, 0, 1.4], [0.62, 0, 0], [0, -0.62, 0], '#c9ced6'),
    pinTag('A', [-5.0, -10.3, 0], 1.5, TAG),
    pinTag('K', [5.0, -10.3, 0], 1.5, TAG),
  ];
}

function ceramicCap(): Mesh {
  // đĩa gốm dựng đứng, mặt đĩa hướng về người xem
  const prof: [number, number][] = [[0, -0.65], [1.9, -0.65], [2.35, -0.5], [2.55, -0.2], [2.6, 0], [2.55, 0.2], [2.35, 0.5], [1.9, 0.65], [0, 0.65]];
  const disk = transform(lathe(prof, 26, '#d98a2b'), rotX(Math.PI / 2), [0, 3.2, 0]);
  const lead = (x: number): Mesh =>
    tube(
      [
        [x * 0.4, 1.2, 0],
        [x * 0.9, 0.2, 0],
        [x * 1.27, -0.8, 0],
        [x * 1.27, -9, 0],
      ],
      0.25,
      6,
      LEAD,
      metal,
    );
  return [...disk, ...lead(1), ...lead(-1), label('104', [0, 3.3, 0.68], [0.75, 0, 0], [0, -0.75, 0], '#3a2208')];
}

function electrolytic(): Mesh {
  const R = 3.15;
  const H = 11;
  const prof: [number, number][] = [
    [0, 0],
    [2.7, 0],
    [3.0, 0.15],
    [R, 0.5],
    [R, 9.6],
    [2.95, 9.9],
    [R, 10.2],
    [R, 10.7],
    [2.9, H],
    [2.6, H],
    [0, H],
  ];
  const segs = 28;
  // sọc cực âm: 6/28 lát cắt quanh j = 0 (phía +x)
  const stripe = (j: number): boolean => j < 3 || j >= segs - 3;
  const can = lathe(prof, segs, (i, j) => {
    if (i === 0) return '#2a2a2e'; // nút cao su đáy
    if (i >= 9) return '#c3c8cf'; // nắp nhôm
    return stripe(j) ? '#c7d0e2' : '#1f3f8e';
  });
  // rãnh van an toàn hình chữ thập trên nắp
  const vent = [box([-1.6, H, -0.12], [1.6, H + 0.02, 0.12], '#7d838c'), box([-0.12, H, -1.6], [0.12, H + 0.02, 1.6], '#7d838c')].flat().map((f) => ({ ...f, bias: -0.3 }));
  const minus = [3.2, 5.2, 7.2].map((y) => label('−', [R + 0.05, y, 0], [0, 0, -1.3], [0, -1.3, 0], '#1f3f8e'));
  const text = label('470µF 25V', [0, 5.6, R + 0.05], [0, 0.95, 0], [0.95, 0, 0], INK);
  return [
    ...can,
    ...vent,
    ...minus,
    text,
    ...leg(-1.25, 0, -14, 0, 0.28),
    ...leg(1.25, 0, -11.5, 0, 0.28),
    pinTag('+', [-1.25, -15.4, 0], 2.2, TAG),
    pinTag('−', [1.25, -12.9, 0], 2.2, TAG),
  ];
}

function inductor(): Mesh {
  const R = 4.2;
  const rho = 1.7;
  // lõi hình xuyến: biên tròn đi ngược chiều kim đồng hồ quanh (R, 0) rồi xoay để vòng dựng đứng
  const circle: [number, number][] = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    circle.push([R + rho * Math.cos(a), rho * Math.sin(a)]);
  }
  const core = transform(lathe(circle, 22, '#3b3f48'), rotX(Math.PI / 2));
  // dây đồng quấn quanh lõi (xoắn ốc trên mặt xuyến), chừa khe ở đáy cho 2 chân
  const turns = 12;
  const gap = 0.42;
  const rw = rho + 0.3;
  const p0 = -Math.PI / 2 + gap;
  const p1 = (3 * Math.PI) / 2 - gap;
  const path: Vec3[] = [];
  const n = turns * 7;
  const P = (phi: number, th: number, rr = rw): Vec3 => [(R + rr * Math.cos(th)) * Math.cos(phi), (R + rr * Math.cos(th)) * Math.sin(phi), rr * Math.sin(th)];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    path.push(P(p0 + (p1 - p0) * t, turns * Math.PI * 2 * t));
  }
  const wire = tube(path, 0.32, 4, '#c8742e', metal);
  // 2 đầu dây (ở mép ngoài lõi) đi thẳng xuống làm chân
  const end = (phi: number): Mesh => {
    const s = P(phi, 0);
    return tube([s, [s[0], s[1] - 1.2, s[2]], [s[0], -R - 9, s[2]]], 0.3, 5, '#c8742e', metal);
  };
  return [...core, ...wire, ...end(p0), ...end(p1)];
}

function led(): Mesh {
  const prof: [number, number][] = [[0, 0], [2.9, 0], [2.9, 1.0], [2.5, 1.0], [2.5, 6.0]];
  // vòm bán cầu
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    prof.push([2.5 * Math.cos(a), 6.0 + 2.5 * Math.sin(a)]);
  }
  prof[prof.length - 1] = [0, 8.5];
  const body = lathe(prof, 24, '#e5303c', { glow: true });
  return [
    ...body,
    ...leg(-1.27, 0, -13, 0, 0.25),
    ...leg(1.27, 0, -11, 0, 0.25),
    pinTag('+', [-1.27, -14.4, 0], 2.2, TAG),
    pinTag('−', [1.27, -12.4, 0], 2.2, TAG),
  ];
}

function bjt(): Mesh {
  // thân chữ D: cung tròn bán kính 2,4 phía sau, mặt phẳng ở z = 1
  const rr = 2.4;
  const alpha = Math.asin(1 / rr);
  const poly: [number, number][] = [];
  for (let i = 0; i <= 14; i++) {
    const t = Math.PI - alpha + ((Math.PI + 2 * alpha) * i) / 14;
    poly.push([rr * Math.cos(t), rr * Math.sin(t)]);
  }
  const body = extrude(poly, 0, 4.8, '#1c1c21');
  const legs = [-1.27, 0, 1.27].flatMap((x) => box([x - 0.23, -12, -0.2], [x + 0.23, 0.2, 0.2], LEAD, metal));
  return [
    ...body,
    ...legs,
    label('PN', [0, 3.3, 1.01], [0.75, 0, 0], [0, -0.75, 0], INK),
    label('2222A', [0, 2.1, 1.01], [0.6, 0, 0], [0, -0.6, 0], INK),
    ...['E', 'B', 'C'].map((t, i) => pinTag(t, [-1.27 + i * 1.27, -13.2, 0], 1.3, TAG)),
  ];
}

function mosfet(): Mesh {
  const body = box([-5, 0, -0.9], [5, 9, 2.2], '#1c1c21');
  const tab = box([-5, 0, -2.2], [5, 15.5, -0.9], '#c3c8cf', metal);
  const holeF = disc([0, 12.6, -0.88], [1, 0, 0], [0, 1, 0], 1.8, 18, HOLE, { bias: -0.3 });
  const holeB = disc([0, 12.6, -2.22], [0, 1, 0], [1, 0, 0], 1.8, 18, HOLE, { bias: -0.3 });
  const legs = [-2.54, 0, 2.54].flatMap((x) => [...box([x - 0.75, -2.5, 0.2], [x + 0.75, 0.05, 0.7], LEAD, metal), ...box([x - 0.4, -13, 0.2], [x + 0.4, -2.5, 0.7], LEAD, metal)]);
  return [
    ...body,
    ...tab,
    holeF,
    holeB,
    ...legs,
    label('IRF540N', [0, 5.6, 2.21], [1.25, 0, 0], [0, -1.25, 0], INK),
    ...['G', 'D', 'S'].map((t, i) => pinTag(t, [-2.54 + i * 2.54, -14.4, 0.45], 1.7, TAG)),
  ];
}

function ic555(): Mesh {
  const out: Mesh = [...box([-4.7, 0.5, -3.2], [4.7, 3.8, 3.2], '#1c1c21')];
  // vết khuyết đầu chân 1 + chấm tròn ở góc chân 1
  out.push(disc([-4.7, 3.81, 0], [0, 0, 1], [1, 0, 0], 0.8, 10, '#0a0a0d', { bias: -0.3 }, 0, Math.PI));
  out.push(disc([-3.6, 3.81, 2.1], [0, 0, 1], [1, 0, 0], 0.45, 10, '#0a0a0d', { bias: -0.3 }));
  out.push(label('NE555', [0.4, 3.81, -0.3], [1.15, 0, 0], [0, 0, 1.15], INK));
  // chân 1-4 ở cạnh z+ (trái → phải), 5-8 ở cạnh z− (phải → trái): ngược chiều kim đồng hồ nhìn từ trên
  const xs = [-3.81, -1.27, 1.27, 3.81];
  for (let k = 0; k < 8; k++) {
    const side = k < 4 ? 1 : -1;
    const x = k < 4 ? xs[k]! : xs[7 - k]!;
    const zIn = side * 3.2;
    const zOut = side * 3.9;
    const z0 = Math.min(zIn, zOut);
    const z1 = Math.max(zIn, zOut);
    const zl = side * 3.65;
    out.push(...box([x - 0.6, 1.3, z0], [x + 0.6, 1.55, z1], LEAD, metal));
    out.push(...box([x - 0.75, -0.5, Math.min(zl, zOut)], [x + 0.75, 1.55, Math.max(zl, zOut)], LEAD, metal));
    out.push(...box([x - 0.23, -3.3, Math.min(zl, zOut)], [x + 0.23, -0.5, Math.max(zl, zOut)], LEAD, metal));
    out.push(pinTag(String(k + 1), [x, -4.4, side * 3.8], 1.3, TAG));
  }
  return out;
}

function crystal(): Mesh {
  // vỏ HC-49/US nhìn từ trên là hình sân vận động 11 × 4,65 mm
  const stadium = (L: number, W: number): [number, number][] => {
    const r = W / 2;
    const c = L / 2 - r;
    const p: [number, number][] = [];
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 10;
      p.push([c + r * Math.cos(a), r * Math.sin(a)]);
    }
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI / 2 + (Math.PI * i) / 10;
      p.push([-c + r * Math.cos(a), r * Math.sin(a)]);
    }
    return p;
  };
  return [
    ...extrude(stadium(11.4, 5.0), 0, 0.5, '#8d939c', metal),
    ...extrude(stadium(11.0, 4.65), 0.5, 3.6, '#d3d8df', metal),
    label('16.000', [0, 3.61, -0.55], [1.0, 0, 0], [0, 0, 1.0], '#3c4250'),
    label('MHz', [0, 3.61, 0.95], [0.7, 0, 0], [0, 0, 0.7], '#3c4250'),
    ...leg(-2.44, 0, -9, 0, 0.22),
    ...leg(2.44, 0, -9, 0, 0.22),
  ];
}

function button(): Mesh {
  const out: Mesh = [
    ...box([-3, 0, -3], [3, 3.3, 3], '#26272c'),
    ...box([-3, 3.3, -3], [3, 3.55, 3], '#c3c8cf', metal),
    ...lathe([[0, 3.55], [1.75, 3.55], [1.75, 4.9], [1.55, 5.1], [0, 5.1]], 20, '#3a3c44'),
  ];
  // 4 chân: cặp cùng chữ nằm xa nhau (6,5 mm) và luôn nối với nhau
  for (const [z, name] of [[-2.25, 'A'], [2.25, 'B']] as const) {
    for (const s of [-1, 1]) {
      out.push(...box([s * 3 - (s > 0 ? 0 : 0.3), -3.5, z - 0.35], [s * 3 + (s > 0 ? 0.3 : 0), 1.2, z + 0.35], LEAD, metal));
      out.push(pinTag(name, [s * 3.4, -4.6, z], 1.4, TAG));
    }
  }
  return out;
}

const BUILDERS: Record<PartId, () => Mesh> = {
  resistor,
  'ceramic-cap': ceramicCap,
  electrolytic,
  inductor,
  diode,
  led,
  bjt,
  mosfet,
  ic555,
  crystal,
  button,
};

const cache = new Map<PartId, Mesh>();

/** Mô hình đã chuẩn hoá (vừa mặt cầu bán kính 1, tâm ở gốc). Dựng một lần rồi giữ lại. */
export function partModel(id: PartId): Mesh {
  let m = cache.get(id);
  if (!m) {
    m = fit(BUILDERS[id]());
    cache.set(id, m);
  }
  return m;
}
