// Chế độ LẮP RÁP: bo mạch có sẵn đường đồng + vị trí lắp (footprint); người chơi cắm linh kiện từ khay vào,
// xoay đúng chiều, rồi CẤP NGUỒN. File này: kiểu dữ liệu màn, quy đổi "linh kiện đã cắm" → mạch điện (circuit.ts),
// và bộ chấm tự động (chạy kịch bản bấm nút, đo LED) để biết mạch có chạy đúng yêu cầu của màn không.
import { Circuit, type Elem } from './circuit';

export type PartKind = 'R' | 'LED' | 'D' | 'CE' | 'CC' | 'SW' | 'Q' | 'M' | 'U555';
export type Pt = readonly [number, number];

export const PIN_COUNT: Record<PartKind, number> = { R: 2, LED: 2, D: 2, CE: 2, CC: 2, SW: 2, Q: 3, M: 3, U555: 8 };
/** khoảng cách 2 chân (ô lưới) của linh kiện 2 chân */
export const SPAN: Record<PartKind, number> = { R: 3, LED: 2, D: 3, CE: 2, CC: 2, SW: 2, Q: 1, M: 1, U555: 3 };

/** Tên chân theo thứ tự chuẩn (chân 1 trước). */
export const PIN_NAMES: Record<PartKind, string[]> = {
  R: ['', ''],
  LED: ['+', '−'],
  D: ['A', 'K'],
  CE: ['+', '−'],
  CC: ['', ''],
  SW: ['', ''],
  Q: ['E', 'B', 'C'],
  M: ['G', 'D', 'S'],
  U555: ['1', '2', '3', '4', '5', '6', '7', '8'],
};

export const KIND_NAME: Record<PartKind, string> = {
  R: 'Điện trở',
  LED: 'LED',
  D: 'Diode',
  CE: 'Tụ hoá',
  CC: 'Tụ gốm',
  SW: 'Nút nhấn',
  Q: 'Transistor BJT',
  M: 'MOSFET',
  U555: 'IC 555',
};

export interface TrayPart {
  kind: PartKind;
  /** Ω cho điện trở, F cho tụ; 0 với linh kiện khác */
  value: number;
  /** khi cắm vào, linh kiện nằm ngược chiều chuẩn (người chơi phải tự xoay cho đúng) */
  flip?: boolean;
}

/** Vị trí lắp trên bo. nets[i] = lưới điện nối với chân i (thứ tự chuẩn: chân 1 / + / anode / E / G trước). */
export interface Footprint {
  id: string;
  kind: PartKind;
  at: Pt;
  dir: 'h' | 'v';
  nets: number[];
}

/** Đường đồng: layer 0 = mặt trên (đỏ đồng), 1 = mặt dưới (chạy qua dưới linh kiện, nối bằng via). */
export interface Trace {
  net: number;
  layer: 0 | 1;
  pts: Pt[];
}

/** Bóng đèn cố định trên bo (tải của MOSFET). */
export interface Lamp {
  id: string;
  a: Pt;
  b: Pt;
  nets: [number, number];
  r: number;
  /** dòng định mức (A): sáng khi đạt ≥ 50% */
  inom: number;
}

export type Goal =
  /** đèn `light` sáng (lit) / tắt khi các nút ở trạng thái `when` (nút không ghi = không ấn) */
  | { kind: 'lit' | 'dark'; light: string; when?: Record<string, boolean> }
  /** đèn nháy với tần số trong [min, max] Hz */
  | { kind: 'blink'; light: string; min: number; max: number }
  /** ấn `sw` rồi nhả: đèn còn sáng thêm [min, max] giây */
  | { kind: 'hold'; light: string; sw: string; min: number; max: number };

export interface AsmLevel {
  id: string;
  name: string;
  /** khái niệm học được (dòng nhỏ ở danh sách màn) */
  concept: string;
  /** đề bài ngắn hiện trên bo */
  brief: string;
  /** gợi ý (không trừ sao) */
  hint: string;
  cols: number;
  rows: number;
  battery: { plus: Pt; minus: Pt; volts: number; net: number };
  footprints: Footprint[];
  traces: Trace[];
  lamps?: Lamp[];
  tray: TrayPart[];
  goals: Goal[];
  /** ẩn giá trị điện trở (phải đọc vạch màu) */
  hideValues?: boolean;
  /** một lời giải (test tự động kiểm tra lời giải chạy được) */
  solution: Placement;
}

export interface Placed {
  /** chỉ số trong khay */
  tray: number;
  /** đã xoay 180° so với chiều chuẩn */
  flip: boolean;
}
export type Placement = Record<string, Placed | undefined>;

/** Toạ độ các lỗ cắm của footprint theo thứ tự chuẩn. */
export function padsOf(fp: Pick<Footprint, 'kind' | 'at' | 'dir'>): Pt[] {
  const [x, y] = fp.at;
  if (fp.kind === 'U555') {
    // DIP-8 nhìn từ trên, vết khuyết bên trái: chân 1-4 hàng dưới trái → phải, 5-8 hàng trên phải → trái
    return Array.from({ length: 8 }, (_, k): Pt => (k < 4 ? [x + k, y + 3] : [x + 7 - k, y]));
  }
  const step = (i: number): Pt => (fp.dir === 'h' ? [x + i, y] : [x, y + i]);
  if (PIN_COUNT[fp.kind] === 3) return [step(0), step(1), step(2)];
  return [step(0), step(SPAN[fp.kind])];
}

/** Chân i của linh kiện nằm ở lỗ nào (đã tính xoay). */
export function padIndex(kind: PartKind, pin: number, flip: boolean): number {
  const n = PIN_COUNT[kind];
  if (!flip) return pin;
  return kind === 'U555' ? (pin + 4) % 8 : n - 1 - pin;
}

/** "4,7 kΩ", "47 µF", "100 nF" */
export function formatValue(kind: PartKind, v: number): string {
  const fmt = (x: number): string => String(Number(x.toPrecision(3))).replace('.', ',');
  if (kind === 'R') return v >= 1e6 ? `${fmt(v / 1e6)} MΩ` : v >= 1e3 ? `${fmt(v / 1e3)} kΩ` : `${fmt(v)} Ω`;
  if (kind === 'CE' || kind === 'CC') return v >= 1e-6 ? `${fmt(v * 1e6)} µF` : v >= 1e-9 ? `${fmt(v * 1e9)} nF` : `${fmt(v * 1e12)} pF`;
  return '';
}

export function partLabel(p: TrayPart, hideValue = false): string {
  const v = formatValue(p.kind, p.value);
  return v && !(hideValue && p.kind === 'R') ? `${KIND_NAME[p.kind]} ${v}` : KIND_NAME[p.kind];
}

// ---------------- Mô phỏng một bo đã lắp ----------------
const LED_ON = 0.002;
const DT = 0.001;

/** Bo đã lắp + mạch điện tương ứng; dùng cho cả bộ chấm và màn chơi (chạy thời gian thực). */
export class BoardSim {
  readonly circuit: Circuit;
  /** footprint → chỉ số linh kiện chính trong circuit.elems */
  private readonly main = new Map<string, number>();
  private readonly lampIdx = new Map<string, number>();
  private readonly battIdx: number;

  constructor(
    readonly level: AsmLevel,
    readonly placement: Placement,
  ) {
    const elems: Elem[] = [];
    let nodes = level.battery.net + 1;
    const net = (n: number): number => {
      nodes = Math.max(nodes, n + 1);
      return n;
    };
    this.battIdx = elems.push({ kind: 'V', p: net(level.battery.net), n: 0, v: level.battery.volts, r: 0.5 }) - 1;
    for (const l of level.lamps ?? []) this.lampIdx.set(l.id, elems.push({ kind: 'R', a: net(l.nets[0]), b: net(l.nets[1]), r: l.r, watt: 100 }) - 1);
    for (const fp of level.footprints) {
      const pl = placement[fp.id];
      if (!pl) continue;
      const part = level.tray[pl.tray];
      if (!part || PIN_COUNT[part.kind] !== PIN_COUNT[fp.kind]) continue;
      // nút nối với chân i của linh kiện
      const n = (pin: number): number => net(fp.nets[padIndex(part.kind, pin, pl.flip)]!);
      let e: Elem;
      switch (part.kind) {
        case 'R':
          e = { kind: 'R', a: n(0), b: n(1), r: part.value, watt: 0.25 };
          break;
        case 'LED':
          e = { kind: 'D', a: n(0), k: n(1), vf: 2, ron: 10, imax: 0.03 };
          break;
        case 'D':
          e = { kind: 'D', a: n(0), k: n(1), vf: 0.7, ron: 0.5, imax: 1 };
          break;
        case 'CE':
        case 'CC':
          e = { kind: 'C', a: n(0), b: n(1), c: part.value, vmax: part.kind === 'CE' ? 25 : 50, polar: part.kind === 'CE' };
          break;
        case 'SW':
          e = { kind: 'SW', a: n(0), b: n(1), closed: false };
          break;
        case 'Q':
          e = { kind: 'Q', e: n(0), b: n(1), c: n(2), beta: 150 };
          break;
        case 'M':
          e = { kind: 'M', g: n(0), d: n(1), s: n(2), vth: 3, ron: 0.05 };
          break;
        case 'U555':
          e = { kind: 'U555', pin: [0, 1, 2, 3, 4, 5, 6, 7].map(n) };
          break;
      }
      this.main.set(fp.id, elems.push(e) - 1);
      // điện dung cổng MOSFET (~1 nF): cổng để "lơ lửng" sẽ giữ điện tích → dạy điện trở kéo xuống
      if (part.kind === 'M') elems.push({ kind: 'C', a: n(0), b: n(2), c: 1e-9, vmax: 1e9, polar: false });
    }
    this.circuit = new Circuit(nodes, elems);
  }

  /** Linh kiện đang cắm ở footprint (hoặc undefined). */
  partAt(fpId: string): TrayPart | undefined {
    const pl = this.placement[fpId];
    return pl ? this.level.tray[pl.tray] : undefined;
  }

  setSwitch(fpId: string, closed: boolean): void {
    const i = this.main.get(fpId);
    const e = i === undefined ? undefined : this.circuit.elems[i];
    if (e?.kind === 'SW') e.closed = closed;
  }

  run(seconds: number, dt = DT): void {
    const n = Math.max(1, Math.round(seconds / dt));
    for (let k = 0; k < n; k++) this.circuit.step(dt);
  }

  /** Dòng qua "đèn" id (LED cắm ở footprint id, hoặc bóng đèn cố định); null nếu chỗ đó không phải đèn. */
  light(id: string): number | null {
    const li = this.lampIdx.get(id);
    if (li !== undefined) return Math.abs(this.circuit.current(li));
    if (this.partAt(id)?.kind !== 'LED' || !this.main.has(id)) return null;
    return Math.max(0, this.circuit.current(this.main.get(id)!));
  }

  /** Mức sáng 0..1 (để vẽ). */
  brightness(id: string): number {
    const i = this.light(id);
    if (i === null) return 0;
    const lamp = this.level.lamps?.find((l) => l.id === id);
    const nominal = lamp ? lamp.inom : 0.015;
    return Math.max(0, Math.min(1.3, i / nominal));
  }

  isLit(id: string): boolean {
    const i = this.light(id);
    if (i === null) return false;
    const lamp = this.level.lamps?.find((l) => l.id === id);
    return lamp ? i >= lamp.inom * 0.5 : i >= LED_ON;
  }

  /** Dòng (A) và điện áp (V) trên linh kiện ở footprint để hiện như đồng hồ đo. */
  reading(fpId: string): { i: number; v: number } | null {
    const k = this.main.get(fpId);
    if (k === undefined) return null;
    const e = this.circuit.elems[k]!;
    const V = (n: number): number => this.circuit.v[n]!;
    let v = 0;
    if (e.kind === 'R' || e.kind === 'SW' || e.kind === 'C') v = V(e.a) - V(e.b);
    else if (e.kind === 'D') v = V(e.a) - V(e.k);
    else if (e.kind === 'Q') v = V(e.c) - V(e.e);
    else if (e.kind === 'M') v = V(e.d) - V(e.s);
    else if (e.kind === 'U555') v = V(e.pin[2]!) - V(e.pin[0]!);
    return { i: this.circuit.current(k), v };
  }

  /** Điện áp lưới (để tô sáng đường mạch). */
  netVoltage(net: number): number {
    return this.circuit.v[net] ?? 0;
  }

  burnt(): { id: string; reason: string }[] {
    const out: { id: string; reason: string }[] = [];
    for (const [id, k] of this.main) {
      const r = this.circuit.st[k]!.burnt;
      if (r) out.push({ id, reason: r });
    }
    return out;
  }

  isBurnt(fpId: string): boolean {
    const k = this.main.get(fpId);
    return k !== undefined && this.circuit.st[k]!.burnt !== null;
  }

  get shorted(): boolean {
    return this.circuit.shorted;
  }

  get batteryCurrent(): number {
    return this.circuit.current(this.battIdx);
  }
}

// ---------------- Bộ chấm ----------------
export interface Check {
  text: string;
  ok: boolean;
  /** kết quả đo được, ví dụ "14,6 mA" */
  got: string;
}

export interface Report {
  pass: boolean;
  checks: Check[];
  burnt: { id: string; reason: string }[];
  shorted: boolean;
  /** footprint còn trống */
  empty: string[];
}

const mA = (a: number): string => `${(a * 1000).toFixed(a < 0.01 ? 1 : 0).replace('.', ',')} mA`;

function whenText(when: Record<string, boolean> | undefined): string {
  if (!when) return '';
  const on = Object.entries(when).filter(([, v]) => v).map(([k]) => k);
  const off = Object.entries(when).filter(([, v]) => !v).map(([k]) => k);
  const parts: string[] = [];
  if (on.length) parts.push(`ấn ${on.join(' + ')}`);
  if (off.length) parts.push(`không ấn ${off.join(', ')}`);
  return `${parts.join(', ')} → `;
}

const lightName = (lv: AsmLevel, id: string): string => (lv.lamps?.some((l) => l.id === id) ? `đèn ${id}` : `LED ${id}`);

function lightGot(sim: BoardSim, id: string): string {
  const i = sim.light(id);
  if (i === null) return `chỗ ${id} chưa có LED`;
  return mA(i);
}

/** Số bước mô phỏng giữa hai lần nhường lượt (khoảng 1-2 ms trên máy tính). */
const SLICE = 200;

/** Chạy mô phỏng `seconds` giây, nhường lượt (yield) sau mỗi SLICE bước để màn chơi không bị khựng. */
function* runFor(sim: BoardSim, seconds: number): Generator<void, void> {
  const n = Math.max(1, Math.round(seconds / DT));
  for (let k = 0; k < n; k++) {
    sim.circuit.step(DT);
    if (k % SLICE === SLICE - 1) yield;
  }
}

/**
 * Bộ chấm dạng generator: mỗi lần `next()` chạy một lát mô phỏng ngắn. Màn chơi chạy nó trong nhiều khung hình
 * (không chặn giao diện trên điện thoại yếu, báo lỗi 26/10); `evaluate()` chạy liền một mạch cho test.
 * Mỗi nhóm mục tiêu chạy trên một bo mới (linh kiện chưa cháy).
 */
export function* evaluateSteps(level: AsmLevel, placement: Placement): Generator<void, Report> {
  const checks: Check[] = [];
  const burnt = new Map<string, string>();
  let shorted = false;
  const collect = (sim: BoardSim): void => {
    for (const b of sim.burnt()) if (!burnt.has(b.id)) burnt.set(b.id, b.reason);
    shorted ||= sim.shorted;
  };
  const switches = level.footprints.filter((f) => f.kind === 'SW').map((f) => f.id);

  // 1. các mục tiêu sáng/tắt: chạy nối tiếp trên CÙNG một bo theo thứ tự (để bắt được hiệu ứng nhớ, ví dụ cổng MOSFET lơ lửng)
  const truth = level.goals.filter((g): g is Extract<Goal, { kind: 'lit' | 'dark' }> => g.kind === 'lit' || g.kind === 'dark');
  if (truth.length) {
    const sim = new BoardSim(level, placement);
    for (const g of truth) {
      for (const s of switches) sim.setSwitch(s, g.when?.[s] ?? false);
      yield* runFor(sim, 0.6);
      const lit = sim.isLit(g.light);
      const ok = sim.light(g.light) !== null && (g.kind === 'lit' ? lit : !lit);
      let got = lightGot(sim, g.light);
      if (g.kind === 'lit' && !lit && sim.light(g.light) !== null && sim.light(g.light)! > 0) got += ' (quá mờ, cần ≥ 2 mA)';
      checks.push({ text: `${whenText(g.when)}${lightName(level, g.light)} ${g.kind === 'lit' ? 'sáng' : 'tắt'}`, ok, got });
    }
    collect(sim);
  }

  for (const g of level.goals) {
    if (g.kind === 'blink') {
      const sim = new BoardSim(level, placement);
      yield* runFor(sim, 1);
      // ghi thời điểm từng lần LED bật sáng; tần số = số chu kỳ / khoảng thời gian giữa lần bật đầu và cuối
      // (trước 26/10 lấy số lần bật / 4 s nên bị làm tròn theo bước 0,25: 1,46 Hz hiện thành "1,3")
      const rises: number[] = [];
      let onSteps = 0;
      let prev = sim.isLit(g.light);
      const T = 4;
      const n = T / DT;
      for (let k = 0; k < n; k++) {
        sim.circuit.step(DT);
        const on = sim.isLit(g.light);
        if (on) onSteps++;
        if (on && !prev) rises.push(sim.circuit.t);
        prev = on;
        if (k % SLICE === SLICE - 1) yield;
      }
      const f = rises.length >= 2 ? (rises.length - 1) / (rises[rises.length - 1]! - rises[0]!) : rises.length / T;
      const ok = sim.light(g.light) !== null && f >= g.min && f <= g.max;
      let got: string;
      if (sim.light(g.light) === null) got = `chỗ ${g.light} chưa có LED`;
      else if (rises.length === 0) got = onSteps > n / 2 ? 'sáng liên tục, không nháy' : 'không sáng';
      else if (f > 40) got = `nháy quá nhanh (> 40 lần/giây), mắt thấy như sáng liên tục`;
      else got = `${f.toFixed(2).replace('.', ',')} lần/giây`;
      checks.push({ text: `${lightName(level, g.light)} nháy ${String(g.min).replace('.', ',')}-${g.max} lần/giây`, ok, got });
      collect(sim);
    } else if (g.kind === 'hold') {
      const sim = new BoardSim(level, placement);
      sim.setSwitch(g.sw, true);
      yield* runFor(sim, 1.5);
      sim.setSwitch(g.sw, false);
      let t = 0;
      while (t < g.max + 2 && sim.isLit(g.light)) {
        sim.run(0.02);
        t += 0.02;
        if (Math.round(t / 0.02) % 10 === 0) yield;
      }
      const ok = sim.light(g.light) !== null && t >= g.min && t <= g.max;
      const got = sim.light(g.light) === null ? `chỗ ${g.light} chưa có LED` : `sáng thêm ${t.toFixed(1).replace('.', ',')} giây`;
      checks.push({ text: `Nhả ${g.sw} → ${lightName(level, g.light)} còn sáng thêm ${String(g.min).replace('.', ',')}-${g.max} giây`, ok, got });
      collect(sim);
    }
  }
  const empty = level.footprints.filter((f) => !placement[f.id]).map((f) => f.id);
  const burntList = [...burnt].map(([id, reason]) => ({ id, reason }));
  return { pass: checks.every((c) => c.ok) && burntList.length === 0 && !shorted, checks, burnt: burntList, shorted, empty };
}

/** Chạy hết bộ chấm liền một mạch (test, công cụ). */
export function evaluate(level: AsmLevel, placement: Placement): Report {
  const gen = evaluateSteps(level, placement);
  for (;;) {
    const r = gen.next();
    if (r.done) return r.value;
  }
}

/** Sao theo số lần cấp nguồn tới khi chạy đúng: lần đầu 3 sao, ≤ 3 lần 2 sao, còn lại 1 sao. */
export function assemblyStars(powerOns: number): number {
  return powerOns <= 1 ? 3 : powerOns <= 3 ? 2 : 1;
}
