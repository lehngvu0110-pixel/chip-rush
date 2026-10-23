// Vẽ bo mạch LẮP RÁP (nhìn từ trên xuống): nền PCB, đường đồng 2 mặt, lớp in (silkscreen) chỉ chiều cắm,
// lỗ cắm, pin, bóng đèn và linh kiện đã cắm. Chiều của linh kiện suy ra từ vị trí từng chân sau khi xoay,
// nên cắm ngược là thấy ngay: dấu + của LED, mặt phẳng transistor, vết khuyết IC lệch khỏi hình in trên bo.
import { resistorBands } from '../../core/parts/catalog';
import { PIN_NAMES, padIndex, padsOf, type AsmLevel, type BoardSim, type Footprint, type PartKind, type Placement, type Pt } from '../../core/assembly/board';
import { rgba } from '../../render/color';
import { roundRectPath } from '../../render/draw';
import { drawGlow } from '../../render/fx';
import { THEME } from '../../render/theme';

export interface BoardLayout {
  x: number;
  y: number;
  cell: number;
}

/** Chiều cao thanh khay linh kiện ở đáy (DOM .asm-bar) và dải thông báo (DOM .asm-strip). Khớp styles.css. */
export const ASM_BAR_H = 150;
export const ASM_MSG_H = 64;
const HEADER_H = 58;
const MAX_CELL = 60;

export function layoutAssembly(w: number, h: number, cols: number, rows: number): BoardLayout {
  const availH = h - HEADER_H - ASM_BAR_H - ASM_MSG_H - 12;
  const cell = Math.max(18, Math.floor(Math.min((Math.min(w, 620) - 20) / cols, availH / rows, MAX_CELL)));
  return { x: Math.round((w - cell * cols) / 2), y: Math.round(HEADER_H + Math.max(0, (availH - cell * rows) / 2)), cell };
}

type V2 = [number, number];
const at = (L: BoardLayout, p: Pt): V2 => [L.x + (p[0] + 0.5) * L.cell, L.y + (p[1] + 0.5) * L.cell];

/** Khung chữ nhật (CSS px) bao một footprint, để chạm chọn và vẽ viền chọn. */
export function footprintBounds(L: BoardLayout, fp: Footprint): { x: number; y: number; w: number; h: number } {
  const ps = padsOf(fp).map((p) => at(L, p));
  const xs = ps.map((p) => p[0]);
  const ys = ps.map((p) => p[1]);
  const m = L.cell * 0.6;
  return { x: Math.min(...xs) - m, y: Math.min(...ys) - m, w: Math.max(...xs) - Math.min(...xs) + 2 * m, h: Math.max(...ys) - Math.min(...ys) + 2 * m };
}

export function footprintAt(L: BoardLayout, level: AsmLevel, x: number, y: number): Footprint | null {
  // ưu tiên footprint nhỏ nhất chứa điểm (linh kiện 2 chân nằm cạnh IC)
  let best: Footprint | null = null;
  let bestArea = Infinity;
  for (const fp of level.footprints) {
    const b = footprintBounds(L, fp);
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h && b.w * b.h < bestArea) {
      best = fp;
      bestArea = b.w * b.h;
    }
  }
  return best;
}

export interface BoardDrawState {
  time: number;
  placement: Placement;
  sim: BoardSim | null;
  selected: string | null;
  /** footprint cắm được linh kiện đang cầm (nhấp nháy viền cam) */
  targets: Set<string>;
  pressed: Set<string>;
  reducedMotion: boolean;
  /** đồ hoạ đầy đủ (bóng đổ); tắt trên máy yếu */
  fancy: boolean;
}

const MASK = '#0c3a2b';
const COPPER = '#2f8c5f';
const COPPER_BOTTOM = '#1d5e43';
const SILK = 'rgba(236,244,240,0.82)';
const PAD = '#d9ad52';

export function drawAssemblyBoard(ctx: CanvasRenderingContext2D, L: BoardLayout, level: AsmLevel, st: BoardDrawState): void {
  const c = L.cell;
  const W = level.cols * c;
  const H = level.rows * c;
  // nền PCB: phủ xanh, viền sáng, 4 lỗ bắt vít
  ctx.save();
  roundRectPath(ctx, L.x - 6, L.y - 6, W + 12, H + 12, c * 0.45);
  const g = ctx.createLinearGradient(L.x, L.y, L.x + W, L.y + H);
  g.addColorStop(0, '#0f4633');
  g.addColorStop(1, MASK);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#2a7d5a';
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [hx, hy] of [[L.x + 4, L.y + 4], [L.x + W - 4, L.y + 4], [L.x + 4, L.y + H - 4], [L.x + W - 4, L.y + H - 4]] as const) {
    ctx.beginPath();
    ctx.arc(hx, hy, c * 0.18, 0, Math.PI * 2);
    ctx.fillStyle = '#c9ced6';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(hx, hy, c * 0.1, 0, Math.PI * 2);
    ctx.fillStyle = '#05080f';
    ctx.fill();
  }
  ctx.restore();

  const volts = level.battery.volts;
  const live = st.sim;
  const netGlow = (net: number): number => (live ? Math.max(0, Math.min(1, live.netVoltage(net) / volts)) : 0);

  // đường đồng: mặt dưới trước (mờ, nét đứt), mặt trên sau
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const layer of [1, 0] as const) {
    for (const t of level.traces) {
      if (t.layer !== layer) continue;
      ctx.beginPath();
      t.pts.forEach((p, i) => {
        const [x, y] = at(L, p);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.setLineDash(layer === 1 ? [c * 0.22, c * 0.16] : []);
      ctx.strokeStyle = layer === 1 ? COPPER_BOTTOM : COPPER;
      ctx.lineWidth = c * (layer === 1 ? 0.14 : 0.2);
      ctx.stroke();
      const k = netGlow(t.net);
      if (k > 0.02) {
        // có điện: tô sáng theo điện áp lưới (gần nguồn sáng nhất, đất tối)
        ctx.strokeStyle = rgba(THEME.bit1, 0.25 + 0.6 * k);
        ctx.lineWidth = c * 0.1;
        ctx.stroke();
      }
    }
  }
  ctx.setLineDash([]);
  // via: đầu đường mặt dưới
  for (const t of level.traces) {
    if (t.layer !== 1) continue;
    for (const p of [t.pts[0]!, t.pts[t.pts.length - 1]!]) {
      const [x, y] = at(L, p);
      ctx.beginPath();
      ctx.arc(x, y, c * 0.13, 0, Math.PI * 2);
      ctx.fillStyle = PAD;
      ctx.fill();
    }
  }
  // xung điện chạy dọc đường nguồn khi có điện
  if (live && !st.reducedMotion) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    level.traces.forEach((t, ti) => {
      const k = netGlow(t.net);
      if (k < 0.3 || t.layer !== 0) return;
      for (let i = 0; i + 1 < t.pts.length; i++) {
        const a = at(L, t.pts[i]!);
        const b = at(L, t.pts[i + 1]!);
        const f = (st.time * 1.2 + ti * 0.31 + i * 0.17) % 1;
        drawGlow(ctx, THEME.bit1, c * 0.22, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, k);
      }
    });
    ctx.restore();
  }

  // lớp in: hình dạng + tên vị trí lắp
  for (const fp of level.footprints) drawSilk(ctx, L, fp);
  // lỗ cắm
  const padAll: Pt[] = [level.battery.plus, level.battery.minus, ...(level.lamps ?? []).flatMap((l) => [l.a, l.b]), ...level.footprints.flatMap((f) => padsOf(f))];
  for (const p of padAll) {
    const [x, y] = at(L, p);
    ctx.beginPath();
    ctx.arc(x, y, c * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = PAD;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, c * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1206';
    ctx.fill();
  }

  drawBattery(ctx, L, level, !!live);
  for (const l of level.lamps ?? []) drawLamp(ctx, L, l.a, l.b, live ? live.brightness(l.id) : 0, l.id);

  // linh kiện đã cắm
  for (const fp of level.footprints) {
    const pl = st.placement[fp.id];
    if (!pl) continue;
    const part = level.tray[pl.tray];
    if (!part) continue;
    const pads = padsOf(fp).map((p) => at(L, p));
    const n = pads.length;
    const pins: V2[] = Array.from({ length: n }, (_, i) => pads[padIndex(part.kind, i, pl.flip)]!);
    drawPart(ctx, part.kind, part.value, pins, c, {
      bright: live ? live.brightness(fp.id) : 0,
      burnt: live ? live.isBurnt(fp.id) : false,
      pressed: st.pressed.has(fp.id),
      time: st.time,
      fancy: st.fancy,
    });
  }

  // viền chọn / gợi ý chỗ cắm
  for (const fp of level.footprints) {
    const sel = st.selected === fp.id;
    const tgt = st.targets.has(fp.id);
    if (!sel && !tgt) continue;
    const b = footprintBounds(L, fp);
    ctx.save();
    roundRectPath(ctx, b.x, b.y, b.w, b.h, c * 0.3);
    ctx.lineWidth = 2.5;
    if (sel) {
      ctx.strokeStyle = THEME.bit1;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -st.time * 20;
    } else {
      ctx.strokeStyle = rgba(THEME.accent, st.reducedMotion ? 0.9 : 0.45 + 0.45 * Math.sin(st.time * 5) ** 2);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawSilk(ctx: CanvasRenderingContext2D, L: BoardLayout, fp: Footprint): void {
  const c = L.cell;
  const pads = padsOf(fp).map((p) => at(L, p));
  ctx.save();
  ctx.strokeStyle = SILK;
  ctx.fillStyle = SILK;
  ctx.lineWidth = 1.4;
  ctx.font = `700 ${Math.max(9, c * 0.3)}px ${THEME.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const [p0, p1] = [pads[0]!, pads[pads.length - 1]!];
  const mid: V2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
  const u = unit(p0, p1);
  const nrm: V2 = [-u[1], u[0]];
  const labelAt = (d: number): void => {
    ctx.fillText(fp.id, mid[0] + nrm[0] * d * c, mid[1] + nrm[1] * d * c);
  };
  if (fp.kind === 'U555') {
    const xs = pads.map((p) => p[0]);
    const ys = pads.map((p) => p[1]);
    const x0 = Math.min(...xs) - c * 0.45;
    const x1 = Math.max(...xs) + c * 0.45;
    const y0 = Math.min(...ys) + c * 0.42;
    const y1 = Math.max(...ys) - c * 0.42;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // vết khuyết ở cạnh trái (phía chân 1 và 8)
    ctx.beginPath();
    ctx.arc(x0, (y0 + y1) / 2, c * 0.3, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    ctx.font = `700 ${Math.max(8, c * 0.24)}px ${THEME.font}`;
    ctx.fillText('1', pads[0]![0] - c * 0.42, pads[0]![1] + c * 0.38);
    ctx.fillText(fp.id, (x0 + x1) / 2, y0 - c * 0.08 - c * 0.62);
  } else if (fp.kind === 'Q' || fp.kind === 'M') {
    // TO-92: chữ D, mặt phẳng phía trước (nrm); TO-220: hình chữ nhật, vạch tab phía sau
    const r = c * 1.05;
    ctx.beginPath();
    if (fp.kind === 'Q') {
      const fa = Math.atan2(nrm[1], nrm[0]);
      const half = Math.acos(0.32);
      ctx.arc(mid[0], mid[1], r, fa + half, fa - half + Math.PI * 2);
      ctx.closePath();
    } else {
      rectAlong(ctx, mid, u, nrm, c * 1.35, -c * 0.55, c * 0.35);
    }
    ctx.stroke();
    if (fp.kind === 'M') {
      ctx.beginPath();
      ctx.moveTo(mid[0] - u[0] * c * 1.35 - nrm[0] * c * 0.7, mid[1] - u[1] * c * 1.35 - nrm[1] * c * 0.7);
      ctx.lineTo(mid[0] + u[0] * c * 1.35 - nrm[0] * c * 0.7, mid[1] + u[1] * c * 1.35 - nrm[1] * c * 0.7);
      ctx.lineWidth = 3;
      ctx.stroke();
    }
    ctx.font = `700 ${Math.max(8, c * 0.24)}px ${THEME.font}`;
    PIN_NAMES[fp.kind].forEach((nm, i) => ctx.fillText(nm, pads[i]![0] + nrm[0] * c * 0.5, pads[i]![1] + nrm[1] * c * 0.5));
    ctx.font = `700 ${Math.max(9, c * 0.3)}px ${THEME.font}`;
    labelAt(-1.35);
  } else {
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
    if (fp.kind === 'LED' || fp.kind === 'CE' || fp.kind === 'CC') {
      const r = fp.kind === 'CE' ? c * 0.55 : fp.kind === 'LED' ? c * 0.46 : c * 0.42;
      ctx.beginPath();
      if (fp.kind === 'LED') {
        // vòng tròn có mép vát phía cathode
        const fa = Math.atan2(u[1], u[0]);
        ctx.arc(mid[0], mid[1], r, fa + 0.55, fa - 0.55 + Math.PI * 2);
        ctx.closePath();
      } else ctx.arc(mid[0], mid[1], r, 0, Math.PI * 2);
      ctx.stroke();
      if (fp.kind !== 'CC') ctx.fillText('+', p0[0] + nrm[0] * c * 0.42, p0[1] + nrm[1] * c * 0.42);
      if (fp.kind === 'CE') {
        // nửa phía cực − tô sọc
        ctx.save();
        ctx.beginPath();
        ctx.arc(mid[0], mid[1], r, Math.atan2(u[1], u[0]) - 0.9, Math.atan2(u[1], u[0]) + 0.9);
        ctx.closePath();
        ctx.globalAlpha = 0.35;
        ctx.fill();
        ctx.restore();
      }
      labelAt(fp.kind === 'CE' ? 1.15 : 1.05);
    } else if (fp.kind === 'SW') {
      rectAlong(ctx, mid, u, nrm, len / 2 + c * 0.1, -(len / 2 + c * 0.1), len / 2 + c * 0.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(mid[0], mid[1], c * 0.42, 0, Math.PI * 2);
      ctx.stroke();
      labelAt(1.55);
    } else {
      // R, D: chữ nhật giữa 2 lỗ; D có vạch cathode
      rectAlong(ctx, mid, u, nrm, len * 0.32, -c * 0.27, c * 0.27);
      ctx.stroke();
      if (fp.kind === 'D') {
        const k: V2 = [mid[0] + u[0] * len * 0.22, mid[1] + u[1] * len * 0.22];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(k[0] + nrm[0] * c * 0.27, k[1] + nrm[1] * c * 0.27);
        ctx.lineTo(k[0] - nrm[0] * c * 0.27, k[1] - nrm[1] * c * 0.27);
        ctx.stroke();
      }
      labelAt(0.62);
    }
  }
  ctx.restore();
}

function unit(a: V2, b: V2): V2 {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return [(b[0] - a[0]) / d, (b[1] - a[1]) / d];
}

/** Đường chữ nhật theo hệ trục (u, n) quanh tâm m: dọc u ±halfU, dọc n từ n0 tới n1. */
function rectAlong(ctx: CanvasRenderingContext2D, m: V2, u: V2, n: V2, halfU: number, n0: number, n1: number): void {
  const P = (a: number, b: number): V2 => [m[0] + u[0] * a + n[0] * b, m[1] + u[1] * a + n[1] * b];
  const pts = [P(-halfU, n0), P(halfU, n0), P(halfU, n1), P(-halfU, n1)];
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
}

function drawBattery(ctx: CanvasRenderingContext2D, L: BoardLayout, level: AsmLevel, on: boolean): void {
  const c = L.cell;
  const [px, py] = at(L, level.battery.plus);
  const [, my] = at(L, level.battery.minus);
  const x = px - c * 0.5;
  const w = c * 1.0;
  const y0 = py + c * 0.55;
  const y1 = my - c * 0.55;
  ctx.save();
  // dây nối 2 cực
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(px, y0);
  ctx.moveTo(px, my);
  ctx.lineTo(px, y1);
  ctx.stroke();
  roundRectPath(ctx, x, y0, w, y1 - y0, c * 0.18);
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, '#20232b');
  g.addColorStop(0.5, '#3a3e4a');
  g.addColorStop(1, '#1a1c22');
  ctx.fillStyle = g;
  ctx.fill();
  // nhãn cam trên nửa trên (cực +)
  roundRectPath(ctx, x, y0, w, (y1 - y0) * 0.38, c * 0.18);
  ctx.fillStyle = on ? '#ffb020' : '#c27f10';
  ctx.fill();
  ctx.fillStyle = '#2a1a00';
  ctx.font = `700 ${Math.max(10, c * 0.42)}px ${THEME.font}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', px, y0 + c * 0.42);
  ctx.save();
  ctx.translate(px, (y0 + y1) / 2 + c * 0.6);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e8ecf8';
  ctx.font = `700 ${Math.max(10, c * 0.4)}px ${THEME.font}`;
  ctx.fillText(`${level.battery.volts} V`, 0, 0);
  ctx.restore();
  ctx.fillStyle = '#e8ecf8';
  ctx.fillText('−', px, y1 - c * 0.35);
  ctx.restore();
}

function drawLamp(ctx: CanvasRenderingContext2D, L: BoardLayout, a: Pt, b: Pt, bright: number, id: string): void {
  const c = L.cell;
  const pa = at(L, a);
  const pb = at(L, b);
  const m: V2 = [(pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2];
  const r = c * 0.85;
  ctx.save();
  ctx.strokeStyle = '#c9ced6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pa[0], pa[1]);
  ctx.lineTo(m[0], m[1] - r * 0.6);
  ctx.moveTo(pb[0], pb[1]);
  ctx.lineTo(m[0], m[1] + r * 0.6);
  ctx.stroke();
  if (bright > 0.05) {
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, '#ffd27a', r * 2.6, m[0], m[1], Math.min(1, bright));
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.beginPath();
  ctx.arc(m[0], m[1], r, 0, Math.PI * 2);
  ctx.fillStyle = bright > 0.05 ? rgba('#fff3c4', 0.35 + 0.6 * Math.min(1, bright)) : 'rgba(200,220,255,0.12)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(220,230,255,0.75)';
  ctx.stroke();
  // dây tóc
  ctx.strokeStyle = bright > 0.05 ? '#fff' : '#9aa6c8';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(m[0] - r * 0.4, m[1] + r * 0.2);
  for (let i = 0; i <= 6; i++) ctx.lineTo(m[0] - r * 0.4 + (r * 0.8 * i) / 6, m[1] + (i % 2 ? -r * 0.15 : r * 0.05));
  ctx.stroke();
  ctx.fillStyle = SILK;
  ctx.font = `700 ${Math.max(9, c * 0.3)}px ${THEME.font}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${id} 12V`, m[0] + r + 4, m[1]);
  ctx.restore();
}

interface PartLook {
  bright: number;
  burnt: boolean;
  pressed: boolean;
  time: number;
  fancy: boolean;
}

/** Vẽ linh kiện theo vị trí các chân (chân 1 trước). Dùng chung cho bo và ảnh trong khay. */
export function drawPart(ctx: CanvasRenderingContext2D, kind: PartKind, value: number, pins: V2[], c: number, look: PartLook): void {
  ctx.save();
  ctx.lineCap = 'round';
  const p0 = pins[0]!;
  const pN = pins[pins.length - 1]!;
  const mid: V2 = [(p0[0] + pN[0]) / 2, (p0[1] + pN[1]) / 2];
  const u = unit(p0, pN);
  const n: V2 = [-u[1], u[0]];
  const len = Math.hypot(pN[0] - p0[0], pN[1] - p0[1]);
  const lead = (a: V2, b: V2): void => {
    ctx.strokeStyle = '#c9ced6';
    ctx.lineWidth = Math.max(1.5, c * 0.08);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
  };
  const P = (a: number, b: number): V2 => [mid[0] + u[0] * a + n[0] * b, mid[1] + u[1] * a + n[1] * b];
  const shadow = (): void => {
    if (!look.fancy) return;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = c * 0.25;
    ctx.shadowOffsetY = c * 0.08;
  };
  const noShadow = (): void => {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
  };
  switch (kind) {
    case 'R':
    case 'D': {
      const half = kind === 'R' ? len * 0.34 : len * 0.28;
      lead(p0, P(-half, 0));
      lead(pN, P(half, 0));
      const w = kind === 'R' ? c * 0.24 : c * 0.22;
      shadow();
      rectAlong(ctx, mid, u, n, half, -w, w);
      ctx.fillStyle = kind === 'R' ? '#d8bf8a' : '#1d1d22';
      ctx.fill();
      noShadow();
      const band = (pos: number, width: number, color: string): void => {
        rectAlong(ctx, P(pos * half, 0), u, n, width * half, -w, w);
        ctx.fillStyle = color;
        ctx.fill();
      };
      if (kind === 'R') {
        const bands = resistorBands(value) ?? [];
        [-0.72, -0.42, -0.12, 0.62].forEach((pos, i) => bands[i] && band(pos, 0.1, bands[i]!.hex));
      } else band(0.7, 0.13, '#c4c8ce');
      // ánh kim dọc thân
      rectAlong(ctx, mid, u, n, half * 0.96, -w * 0.75, -w * 0.35);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fill();
      break;
    }
    case 'LED': {
      const r = c * 0.42;
      if (look.bright > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, '#ff4d5a', c * 1.7, mid[0], mid[1], Math.min(1.2, 0.35 + look.bright));
        ctx.restore();
      }
      shadow();
      ctx.beginPath();
      const fa = Math.atan2(u[1], u[0]);
      ctx.arc(mid[0], mid[1], r, fa + 0.55, fa - 0.55 + Math.PI * 2);
      ctx.closePath();
      const lit = Math.min(1, look.bright);
      const g = ctx.createRadialGradient(mid[0] - r * 0.3, mid[1] - r * 0.3, r * 0.1, mid[0], mid[1], r);
      g.addColorStop(0, lit > 0.02 ? '#fff0f0' : '#ff8f96');
      g.addColorStop(0.5, lit > 0.02 ? '#ff4d5a' : '#d22a36');
      g.addColorStop(1, '#8e1520');
      ctx.fillStyle = g;
      ctx.fill();
      noShadow();
      // dấu + ở chân dài (anode)
      ctx.fillStyle = '#ffd27a';
      ctx.font = `700 ${Math.max(9, c * 0.32)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('+', p0[0] - n[0] * c * 0.42, p0[1] - n[1] * c * 0.42);
      break;
    }
    case 'CE': {
      const r = c * 0.5;
      shadow();
      ctx.beginPath();
      ctx.arc(mid[0], mid[1], r, 0, Math.PI * 2);
      ctx.fillStyle = '#1f3f8e';
      ctx.fill();
      noShadow();
      // sọc cực − (phía chân 2)
      const fa = Math.atan2(u[1], u[0]);
      ctx.beginPath();
      ctx.arc(mid[0], mid[1], r, fa - 0.75, fa + 0.75);
      ctx.arc(mid[0], mid[1], r * 0.72, fa + 0.75, fa - 0.75, true);
      ctx.closePath();
      ctx.fillStyle = '#c7d0e2';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mid[0], mid[1], r * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#c3c8cf';
      ctx.fill();
      ctx.strokeStyle = '#7d838c';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(mid[0] - r * 0.4, mid[1]);
      ctx.lineTo(mid[0] + r * 0.4, mid[1]);
      ctx.moveTo(mid[0], mid[1] - r * 0.4);
      ctx.lineTo(mid[0], mid[1] + r * 0.4);
      ctx.stroke();
      ctx.fillStyle = '#1f3f8e';
      ctx.font = `700 ${Math.max(8, c * 0.28)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('−', mid[0] + u[0] * r * 0.86, mid[1] + u[1] * r * 0.86);
      break;
    }
    case 'CC': {
      shadow();
      ctx.beginPath();
      ctx.ellipse(mid[0], mid[1], c * 0.42, c * 0.3, Math.atan2(u[1], u[0]), 0, Math.PI * 2);
      ctx.fillStyle = '#d98a2b';
      ctx.fill();
      noShadow();
      ctx.fillStyle = '#3a2208';
      ctx.font = `700 ${Math.max(7, c * 0.22)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('104', mid[0], mid[1]);
      break;
    }
    case 'SW': {
      const s = len / 2 + c * 0.05;
      shadow();
      rectAlong(ctx, mid, u, n, s, -s, s);
      ctx.fillStyle = '#26272c';
      ctx.fill();
      noShadow();
      rectAlong(ctx, mid, u, n, s * 0.82, -s * 0.82, s * 0.82);
      ctx.fillStyle = '#9aa1ab';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mid[0], mid[1], s * (look.pressed ? 0.48 : 0.56), 0, Math.PI * 2);
      ctx.fillStyle = look.pressed ? '#14151a' : '#3a3c44';
      ctx.fill();
      if (look.pressed) {
        ctx.strokeStyle = THEME.bit1;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      break;
    }
    case 'Q': {
      // TO-92: mặt phẳng phía trước (n), lưng tròn phía sau
      const r = c * 0.95;
      shadow();
      ctx.beginPath();
      const fa = Math.atan2(n[1], n[0]);
      const half = Math.acos(0.32);
      ctx.arc(mid[0], mid[1], r, fa + half, fa - half + Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = '#1c1c21';
      ctx.fill();
      noShadow();
      ctx.save();
      ctx.translate(mid[0] + n[0] * r * 0.05, mid[1] + n[1] * r * 0.05);
      ctx.rotate(Math.atan2(u[1], u[0]));
      ctx.fillStyle = '#c9ced6';
      ctx.font = `700 ${Math.max(7, c * 0.22)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('2222A', 0, 0);
      ctx.restore();
      break;
    }
    case 'M': {
      // TO-220: thân đen phía trước, tab kim loại có lỗ phía sau
      shadow();
      rectAlong(ctx, mid, u, n, c * 1.3, -c * 1.25, -c * 0.5);
      ctx.fillStyle = '#c3c8cf';
      ctx.fill();
      noShadow();
      const h = P(0, -c * 0.95);
      ctx.beginPath();
      ctx.arc(h[0], h[1], c * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = MASK;
      ctx.fill();
      rectAlong(ctx, mid, u, n, c * 1.25, -c * 0.55, c * 0.35);
      ctx.fillStyle = '#1c1c21';
      ctx.fill();
      ctx.save();
      ctx.translate(mid[0] - n[0] * c * 0.1, mid[1] - n[1] * c * 0.1);
      ctx.rotate(Math.atan2(u[1], u[0]));
      ctx.fillStyle = '#e8ecf8';
      ctx.font = `700 ${Math.max(7, c * 0.24)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IRF540N', 0, 0);
      ctx.restore();
      break;
    }
    case 'U555': {
      // thân bao 8 chân; vết khuyết phía chân 1 và 8
      const xs = pins.map((p) => p[0]);
      const ys = pins.map((p) => p[1]);
      const x0 = Math.min(...xs) - c * 0.42;
      const x1 = Math.max(...xs) + c * 0.42;
      const y0 = Math.min(...ys) + c * 0.38;
      const y1 = Math.max(...ys) - c * 0.38;
      ctx.strokeStyle = '#c9ced6';
      ctx.lineWidth = Math.max(2, c * 0.14);
      for (const p of pins) {
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(p[0], p[1] < (y0 + y1) / 2 ? y0 : y1);
        ctx.stroke();
      }
      shadow();
      roundRectPath(ctx, x0, y0, x1 - x0, y1 - y0, c * 0.1);
      ctx.fillStyle = '#1c1c21';
      ctx.fill();
      noShadow();
      const m18: V2 = [(pins[0]![0] + pins[7]![0]) / 2, (pins[0]![1] + pins[7]![1]) / 2];
      const left = m18[0] < (x0 + x1) / 2;
      const nx = left ? x0 : x1;
      const cy = (y0 + y1) / 2;
      ctx.beginPath();
      ctx.arc(nx, cy, c * 0.28, left ? -Math.PI / 2 : Math.PI / 2, left ? Math.PI / 2 : (3 * Math.PI) / 2);
      ctx.fillStyle = '#0a0a0d';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pins[0]![0], pins[0]![1] < cy ? y0 + c * 0.32 : y1 - c * 0.32, c * 0.12, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.translate((x0 + x1) / 2, cy);
      if (!left) ctx.rotate(Math.PI);
      ctx.fillStyle = '#e8ecf8';
      ctx.font = `700 ${Math.max(8, c * 0.34)}px ${THEME.font}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('NE555', 0, 0);
      ctx.restore();
      break;
    }
  }
  if (look.burnt) {
    // muội đen + dấu ✕ + khói
    ctx.save();
    ctx.globalAlpha = 0.75;
    drawGlow(ctx, '#000000', c * 1.1, mid[0], mid[1], 1);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = THEME.error;
    ctx.lineWidth = 3;
    const s = c * 0.32;
    ctx.beginPath();
    ctx.moveTo(mid[0] - s, mid[1] - s);
    ctx.lineTo(mid[0] + s, mid[1] + s);
    ctx.moveTo(mid[0] + s, mid[1] - s);
    ctx.lineTo(mid[0] - s, mid[1] + s);
    ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const t = (look.time * 0.6 + i / 4) % 1;
      ctx.globalAlpha = 0.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(mid[0] + Math.sin(look.time * 2 + i * 1.7) * c * 0.25, mid[1] - t * c * 1.6, c * (0.15 + t * 0.35), 0, Math.PI * 2);
      ctx.fillStyle = '#9aa1ab';
      ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}
