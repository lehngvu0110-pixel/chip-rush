// Bộ mô phỏng mạch điện cho chế độ LẮP RÁP: phân tích điện áp nút (nodal analysis) theo thời gian.
// - Mọi linh kiện quy về "nguồn tương đương Norton": độ dẫn g song song với nguồn dòng → không cần ẩn phụ,
//   hệ phương trình chỉ có điện áp các nút (≤ 20 nút) → khử Gauss là đủ nhanh.
// - Linh kiện phi tuyến (diode, LED, BJT, MOSFET, IC 555) dùng mô hình tuyến tính từng đoạn (PWL):
//   đoán trạng thái → giải → kiểm tra trạng thái còn đúng không → lặp tới khi ổn định.
// - Tụ điện: Euler lùi, i = C/dt · (v − v_trước) → cũng là một nguồn Norton.
// Không chạm DOM để test được bằng Vitest. Mô hình đủ đúng để dạy (sụt áp LED, dòng hạn bởi điện trở,
// β của BJT, ngưỡng 1/3–2/3 của 555), không nhằm thay SPICE.

export type Elem =
  /** điện trở; watt = công suất định mức (cháy khi vượt gấp đôi) */
  | { kind: 'R'; a: number; b: number; r: number; watt: number }
  /** pin: sức điện động v, điện trở trong r */
  | { kind: 'V'; p: number; n: number; v: number; r: number }
  /** diode/LED: a = anode, k = cathode; sụt áp thuận vf, điện trở khi dẫn ron, dòng tối đa imax */
  | { kind: 'D'; a: number; k: number; vf: number; ron: number; imax: number }
  | { kind: 'SW'; a: number; b: number; closed: boolean }
  /** tụ; polar = tụ hoá (a là cực +) */
  | { kind: 'C'; a: number; b: number; c: number; vmax: number; polar: boolean }
  /** BJT NPN */
  | { kind: 'Q'; c: number; b: number; e: number; beta: number }
  /** MOSFET kênh N (tăng cường) */
  | { kind: 'M'; d: number; g: number; s: number; vth: number; ron: number }
  /** IC 555, pin[i] = nút nối với chân i+1 */
  | { kind: 'U555'; pin: number[] };

export interface ElemState {
  /** diode dẫn / B-E dẫn / MOSFET mở / 555 đầu ra mức cao */
  on: boolean;
  /** BJT bão hoà */
  sat: boolean;
  /** BJT bị phân cực ngược (C thấp hơn E, thường do cắm ngược): coi C-E hở */
  rev: boolean;
  /** điện áp trên tụ (bước trước) */
  vc: number;
  burnt: string | null;
}

const GMIN = 1e-9;
const OPEN = 1e-9;
const SW_R = 0.05;
const VBE = 0.65;
const RBE = 25;
const VCE_SAT = 0.2;
const R_SAT = 2;
const R555_OUT = 10;
const R555_DIS = 20;
const R555_Q = 3000;

/** Giải A·x = b bằng khử Gauss có chọn trụ. A, b bị ghi đè. */
export function solveLinear(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(A[r]![col]!) > Math.abs(A[piv]![col]!)) piv = r;
    if (piv !== col) {
      [A[piv], A[col]] = [A[col]!, A[piv]!];
      [b[piv], b[col]] = [b[col]!, b[piv]!];
    }
    const p = A[col]![col]!;
    if (Math.abs(p) < 1e-300) continue;
    for (let r = col + 1; r < n; r++) {
      const f = A[r]![col]! / p;
      if (f === 0) continue;
      const row = A[r]!;
      const src = A[col]!;
      for (let k = col; k < n; k++) row[k]! -= f * src[k]!;
      b[r]! -= f * b[col]!;
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r]!;
    const row = A[r]!;
    for (let k = r + 1; k < n; k++) s -= row[k]! * x[k]!;
    const p = row[r]!;
    x[r] = Math.abs(p) < 1e-300 ? 0 : s / p;
  }
  return x;
}

export class Circuit {
  /** điện áp nút (v[0] = đất = 0) */
  v: Float64Array;
  readonly st: ElemState[];
  t = 0;
  /** pin bị chập mạch (dòng > 2 A kéo dài quá 50 ms; dòng nạp tụ lúc đầu không tính) */
  shorted = false;
  private overload = 0;
  private readonly matA: Float64Array[];
  private readonly vecB: Float64Array;

  constructor(
    readonly nodes: number,
    readonly elems: Elem[],
  ) {
    this.v = new Float64Array(nodes);
    this.matA = Array.from({ length: nodes - 1 }, () => new Float64Array(nodes - 1));
    this.vecB = new Float64Array(nodes - 1);
    this.st = elems.map(() => ({ on: false, sat: false, rev: false, vc: 0, burnt: null }));
  }

  private V(n: number): number {
    return this.v[n]!;
  }

  /** Dòng chạy qua linh kiện i theo chiều quy ước (a→b, anode→cathode, vào collector/drain, ra cực + của pin). */
  current(i: number): number {
    const e = this.elems[i]!;
    const s = this.st[i]!;
    const V = (n: number): number => this.V(n);
    switch (e.kind) {
      case 'R':
        return s.burnt ? 0 : (V(e.a) - V(e.b)) / e.r;
      case 'V':
        return (e.v - (V(e.p) - V(e.n))) / e.r;
      case 'D':
        return s.on && !s.burnt ? (V(e.a) - V(e.k) - e.vf) / e.ron : 0;
      case 'SW':
        return e.closed ? (V(e.a) - V(e.b)) / SW_R : 0;
      case 'C':
        return 0; // dòng qua tụ không dùng để hiển thị
      case 'Q': {
        if (s.burnt || !s.on || s.rev) return 0;
        if (s.sat) return (V(e.c) - V(e.e) - VCE_SAT) / R_SAT;
        return e.beta * this.baseCurrent(i);
      }
      case 'M':
        return s.on && !s.burnt ? (V(e.d) - V(e.s)) / e.ron : 0;
      case 'U555':
        return 0;
    }
  }

  /** Dòng base của BJT i. */
  baseCurrent(i: number): number {
    const e = this.elems[i]!;
    const s = this.st[i]!;
    if (e.kind !== 'Q' || !s.on || s.burnt) return 0;
    return (this.V(e.b) - this.V(e.e) - VBE) / RBE;
  }

  /** Lập và giải hệ phương trình một lần với trạng thái hiện tại. */
  private solveOnce(dt: number): void {
    const n = this.nodes - 1;
    // dùng lại bộ nhớ ma trận giữa các lần giải (mỗi giây mô phỏng giải hàng nghìn lần)
    const A = this.matA;
    const b = this.vecB;
    for (const row of A) row.fill(0);
    b.fill(0);
    const G = (x: number, y: number, g: number): void => {
      if (x > 0) A[x - 1]![x - 1]! += g;
      if (y > 0) A[y - 1]![y - 1]! += g;
      if (x > 0 && y > 0) {
        A[x - 1]![y - 1]! -= g;
        A[y - 1]![x - 1]! -= g;
      }
    };
    /** nhánh "nguồn sức điện động E nối tiếp độ dẫn g", cực + ở x: i(x→y) = g·(Vx − Vy − E) */
    const src = (x: number, y: number, g: number, E: number): void => {
      G(x, y, g);
      if (x > 0) b[x - 1]! += g * E;
      if (y > 0) b[y - 1]! -= g * E;
    };
    /** nguồn dòng điều khiển bằng áp: i = gm·(V(c1) − V(c2) − off), chảy từ o1 sang o2 qua linh kiện */
    const vccs = (o1: number, o2: number, c1: number, c2: number, gm: number, off: number): void => {
      const add = (r: number, c: number, val: number): void => {
        if (r > 0 && c > 0) A[r - 1]![c - 1]! += val;
      };
      add(o1, c1, gm);
      add(o1, c2, -gm);
      add(o2, c1, -gm);
      add(o2, c2, gm);
      if (o1 > 0) b[o1 - 1]! += gm * off;
      if (o2 > 0) b[o2 - 1]! -= gm * off;
    };
    for (let k = 1; k <= n; k++) A[k - 1]![k - 1]! += GMIN;

    this.elems.forEach((e, i) => {
      const s = this.st[i]!;
      switch (e.kind) {
        case 'R':
          G(e.a, e.b, s.burnt ? OPEN : 1 / e.r);
          break;
        case 'V':
          src(e.p, e.n, 1 / e.r, e.v);
          break;
        case 'D':
          if (s.on && !s.burnt) src(e.a, e.k, 1 / e.ron, e.vf);
          else G(e.a, e.k, OPEN);
          break;
        case 'SW':
          G(e.a, e.b, e.closed ? 1 / SW_R : OPEN);
          break;
        case 'C':
          if (s.burnt || dt <= 0) G(e.a, e.b, OPEN);
          else src(e.a, e.b, e.c / dt, s.vc);
          break;
        case 'Q':
          if (s.burnt || !s.on) break;
          src(e.b, e.e, 1 / RBE, VBE);
          if (s.rev) break;
          if (s.sat) src(e.c, e.e, 1 / R_SAT, VCE_SAT);
          else vccs(e.c, e.e, e.b, e.e, e.beta / RBE, VBE);
          break;
        case 'M':
          G(e.d, e.s, s.on && !s.burnt ? 1 / e.ron : OPEN);
          break;
        case 'U555': {
          const [p1, , p3, , , , p7, p8] = e.pin as [number, number, number, number, number, number, number, number];
          if (s.burnt) break;
          G(p8, p1, 1 / R555_Q);
          const vcc = this.V(p8) - this.V(p1);
          src(p3, p1, 1 / R555_OUT, s.on ? Math.max(0, vcc - 1.7) : 0.05);
          G(p7, p1, s.on ? OPEN : 1 / R555_DIS);
          break;
        }
      }
    });
    const x = solveLinear(A, b);
    this.v[0] = 0;
    for (let k = 1; k <= n; k++) this.v[k] = x[k - 1]!;
  }

  /** Cập nhật trạng thái PWL theo điện áp vừa giải; trả về true nếu có gì đổi. */
  private updateStates(): boolean {
    let changed = false;
    const set = (s: ElemState, key: 'on' | 'sat' | 'rev', val: boolean): void => {
      if (s[key] !== val) {
        s[key] = val;
        changed = true;
      }
    };
    this.elems.forEach((e, i) => {
      const s = this.st[i]!;
      if (s.burnt) return;
      const V = (n: number): number => this.V(n);
      switch (e.kind) {
        case 'D': {
          const vd = V(e.a) - V(e.k);
          set(s, 'on', s.on ? vd - e.vf > -1e-6 : vd > e.vf);
          break;
        }
        case 'Q': {
          const vbe = V(e.b) - V(e.e);
          const on = s.on ? vbe - VBE > -1e-6 : vbe > VBE;
          set(s, 'on', on);
          if (!on) break;
          const vce = V(e.c) - V(e.e);
          if (s.rev) {
            if (vce > VCE_SAT) set(s, 'rev', false);
          } else if (!s.sat) {
            if (vce < VCE_SAT) set(s, 'sat', true);
          } else {
            const icSat = (vce - VCE_SAT) / R_SAT;
            if (icSat < -1e-6) {
              // dòng muốn chảy ngược E → C: transistor thật gần như không dẫn chiều này (β ngược rất nhỏ)
              set(s, 'sat', false);
              set(s, 'rev', true);
            } else if (icSat > e.beta * this.baseCurrent(i) + 1e-9) set(s, 'sat', false);
          }
          break;
        }
        case 'M':
          set(s, 'on', V(e.g) - V(e.s) > e.vth);
          break;
        default:
          break;
      }
    });
    return changed;
  }

  /**
   * Flip-flop của 555 đổi trạng thái theo điện áp của BƯỚC TRƯỚC (như độ trễ của bộ so sánh thật).
   * Nếu quyết định ngay trong vòng lặp PWL: vừa đảo → tụ xả một chút → tụt dưới ngưỡng → đảo lại, không bao giờ ổn định.
   */
  private update555(): void {
    this.elems.forEach((e, i) => {
      const s = this.st[i]!;
      if (e.kind !== 'U555' || s.burnt) return;
      const V = (k: number): number => this.V(e.pin[k]!) - this.V(e.pin[0]!);
      const vcc = V(7);
      if (vcc < 1 || V(3) < 0.7) s.on = false;
      else if (V(1) < vcc / 3) s.on = true; // TRIG thắng THR như 555 thật
      else if (V(5) > (2 * vcc) / 3) s.on = false;
    });
  }

  /** Tiến dt giây. */
  step(dt: number): void {
    this.update555();
    for (let it = 0; it < 40; it++) {
      this.solveOnce(dt);
      if (!this.updateStates()) break;
    }
    this.t += dt;
    this.elems.forEach((e, i) => {
      const s = this.st[i]!;
      if (e.kind === 'C') s.vc = this.V(e.a) - this.V(e.b);
    });
    this.checkLimits(dt);
  }

  /** Linh kiện quá giới hạn thì cháy (từ đó coi như hở mạch) và ghi lý do. */
  private checkLimits(dt: number): void {
    const ma = (x: number): string => `${Math.round(Math.abs(x) * 1000)} mA`;
    this.elems.forEach((e, i) => {
      const s = this.st[i]!;
      if (s.burnt) return;
      const V = (n: number): number => this.V(n);
      switch (e.kind) {
        case 'R': {
          const p = (V(e.a) - V(e.b)) ** 2 / e.r;
          if (p > e.watt * 2) s.burnt = `toả nhiệt ${p.toFixed(1).replace('.', ',')} W, quá ${String(e.watt).replace('.', ',')} W định mức`;
          break;
        }
        case 'V':
          this.overload = this.current(i) > 2 ? this.overload + dt : 0;
          if (this.overload > 0.05) this.shorted = true;
          break;
        case 'D': {
          const c = this.current(i);
          if (c > e.imax) s.burnt = `dòng ${ma(c)}, quá ${ma(e.imax)} cho phép`;
          break;
        }
        case 'C': {
          const vc = V(e.a) - V(e.b);
          if (e.polar && vc < -1) s.burnt = 'cắm ngược cực, tụ phồng';
          else if (Math.abs(vc) > e.vmax) s.burnt = `điện áp ${vc.toFixed(1)} V, quá ${e.vmax} V định mức`;
          break;
        }
        case 'Q': {
          const ib = this.baseCurrent(i);
          const ic = this.current(i);
          if (ib > 0.05) s.burnt = `dòng base ${ma(ib)} quá lớn (thiếu điện trở base?)`;
          else if (ic > 0.8) s.burnt = `dòng collector ${ma(ic)}, quá 800 mA`;
          break;
        }
        case 'M':
          if (Math.abs(V(e.g) - V(e.s)) > 20) s.burnt = 'điện áp G-S quá 20 V';
          break;
        case 'U555': {
          const gnd = V(e.pin[0]!);
          const vcc = V(e.pin[7]!) - gnd;
          // chân thấp hơn GND > 0,5 V: diode bảo vệ bên trong dẫn mạnh (thường do cắm IC ngược 180°)
          const lowest = Math.min(...e.pin.slice(1).map(V));
          if (vcc < -0.5 || lowest < gnd - 0.5) s.burnt = 'lắp ngược chiều: chân GND bị nối lên nguồn';
          else if (vcc > 16) s.burnt = `nguồn ${vcc.toFixed(0)} V, quá 16 V`;
          break;
        }
        default:
          break;
      }
    });
  }
}
