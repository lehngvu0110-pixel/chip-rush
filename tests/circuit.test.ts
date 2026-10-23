// Bộ mô phỏng mạch LẮP RÁP: so với kết quả tính tay (định luật Ohm, β, công thức 555).
import { describe, expect, it } from 'vitest';
import { Circuit, solveLinear, type Elem } from '../src/core/assembly/circuit';

const R = (a: number, b: number, r: number, watt = 0.25): Elem => ({ kind: 'R', a, b, r, watt });
const BAT = (p: number, v: number): Elem => ({ kind: 'V', p, n: 0, v, r: 0.5 });
const LED = (a: number, k: number): Elem => ({ kind: 'D', a, k, vf: 2, ron: 10, imax: 0.03 });

const settle = (c: Circuit, seconds = 0.05, dt = 0.001): Circuit => {
  for (let t = 0; t < seconds; t += dt) c.step(dt);
  return c;
};

describe('giải hệ tuyến tính', () => {
  it('khử Gauss có chọn trụ', () => {
    const x = solveLinear([Float64Array.from([0, 2]), Float64Array.from([3, 1])], Float64Array.from([4, 5]));
    expect(x[0]).toBeCloseTo(1, 12);
    expect(x[1]).toBeCloseTo(2, 12);
  });
});

describe('mạch DC', () => {
  it('chia áp 2 điện trở', () => {
    const c = settle(new Circuit(3, [BAT(1, 9), R(1, 2, 1000), R(2, 0, 2000)]));
    expect(c.v[2]).toBeCloseTo((9 * 2000) / 3000.5, 3);
  });
  it('LED + 470 Ω ở 9 V: I = (9 − 2)/(470 + 10 + 0,5) ≈ 14,6 mA', () => {
    const c = settle(new Circuit(3, [BAT(1, 9), R(1, 2, 470), LED(2, 0)]));
    expect(c.current(2)).toBeCloseTo(7 / 480.5, 4);
    expect(c.st[2]!.burnt).toBeNull();
  });
  it('LED cắm ngược: không sáng, không cháy', () => {
    const c = settle(new Circuit(3, [BAT(1, 9), R(1, 2, 470), LED(0, 2)]));
    expect(c.current(2)).toBe(0);
    expect(c.st[2]!.burnt).toBeNull();
  });
  it('thiếu điện trở hạn dòng: LED cháy, từ đó hở mạch', () => {
    const c = settle(new Circuit(2, [BAT(1, 5), LED(1, 0)]));
    expect(c.st[1]!.burnt).toMatch(/quá 30 mA/);
    expect(c.current(1)).toBe(0);
  });
  it('chập thẳng 2 cực pin bị phát hiện', () => {
    const c = settle(new Circuit(2, [BAT(1, 9), { kind: 'SW', a: 1, b: 0, closed: true }]), 0.2);
    expect(c.shorted).toBe(true);
  });
});

describe('transistor', () => {
  // nút: 1 = 5 V, 2 = base, 3 = collector (LED + 330 Ω)
  const npn = (rb: number): Circuit =>
    settle(new Circuit(5, [BAT(1, 5), R(1, 2, rb), { kind: 'Q', c: 3, b: 2, e: 0, beta: 100 }, R(1, 4, 330), LED(4, 3)]));
  it('BJT bão hoà khi đủ dòng base: LED sáng ≈ (5 − 2 − 0,2)/340', () => {
    const c = npn(10_000);
    expect(c.st[2]!.sat).toBe(true);
    expect(c.current(4)).toBeCloseTo((5 - 2 - 0.2) / 340.5, 2);
  });
  it('BJT khuếch đại khi dòng base nhỏ: Ic = β·Ib', () => {
    const c = npn(1_000_000);
    expect(c.st[2]!.sat).toBe(false);
    expect(c.current(2)).toBeCloseTo(100 * c.baseCurrent(2), 9);
    expect(c.current(2)).toBeCloseTo((100 * (5 - 0.65)) / 1_000_025, 4);
  });
  it('MOSFET mở khi U G-S vượt ngưỡng', () => {
    const mk = (vg: number): Circuit => settle(new Circuit(4, [BAT(1, 12), BAT(2, vg), R(1, 3, 100, 5), { kind: 'M', d: 3, g: 2, s: 0, vth: 3, ron: 0.05 }]));
    expect(mk(1).current(3)).toBe(0);
    expect(mk(10).current(3)).toBeCloseTo(12 / 100.55, 3);
  });
});

describe('tụ và 555', () => {
  it('tụ nạp qua điện trở: sau 1 τ đạt ≈ 63%', () => {
    const c = new Circuit(3, [BAT(1, 10), R(1, 2, 1000), { kind: 'C', a: 2, b: 0, c: 100e-6, vmax: 25, polar: true }]);
    settle(c, 0.1, 0.0005);
    expect(c.v[2]! / 10).toBeCloseTo(1 - Math.exp(-1), 1);
  });
  it('tụ hoá cắm ngược bị phồng', () => {
    const c = settle(new Circuit(3, [BAT(1, 9), R(1, 2, 100), { kind: 'C', a: 0, b: 2, c: 47e-6, vmax: 25, polar: true }]), 0.2);
    expect(c.st[2]!.burnt).toMatch(/ngược cực/);
  });
  it('555 mắc astable: f ≈ 1,44 / ((R1 + 2·R2)·C)', () => {
    // nút: 1 VCC, 2 DIS (giữa R1-R2), 3 THR=TRIG=tụ, 4 OUT
    const pin = [0, 3, 4, 1, 0, 3, 2, 1];
    const c = new Circuit(5, [BAT(1, 9), R(1, 2, 1000), R(2, 3, 10_000), { kind: 'C', a: 3, b: 0, c: 47e-6, vmax: 25, polar: true }, { kind: 'U555', pin }, R(4, 0, 10_000)]);
    let rises: number[] = [];
    let prev = false;
    for (let i = 0; i < 6000; i++) {
      c.step(0.001);
      const hi = c.v[4]! > 4.5;
      if (hi && !prev) rises.push(c.t);
      prev = hi;
    }
    rises = rises.slice(1); // bỏ chu kỳ đầu (tụ nạp từ 0)
    const period = (rises[rises.length - 1]! - rises[0]!) / (rises.length - 1);
    const expected = 1 / (1.44 / (21_000 * 47e-6));
    expect(period / expected).toBeGreaterThan(0.93);
    expect(period / expected).toBeLessThan(1.07);
  });
  it('555 lắp ngược (xoay 180°) thì cháy', () => {
    // lỗ: 1 GND, 2+6 tụ, 3 OUT, 4+8 VCC, 5 CTRL (tụ 10 nF), 7 DIS. Xoay 180°: chân k nằm ở lỗ (k + 4) mod 8
    const pin = [0, 3, 4, 1, 5, 3, 2, 1].map((_, k, a) => a[(k + 4) % 8]!);
    const c = settle(
      new Circuit(6, [BAT(1, 9), R(1, 2, 1000), R(2, 3, 10_000), { kind: 'C', a: 3, b: 0, c: 47e-6, vmax: 25, polar: true }, { kind: 'U555', pin }, { kind: 'C', a: 5, b: 0, c: 10e-9, vmax: 50, polar: false }]),
    );
    expect(c.st[4]!.burnt).toMatch(/ngược/);
  });
});
