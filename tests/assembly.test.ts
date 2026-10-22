// LẮP RÁP: hình học bo mạch (đường đồng khớp lưới điện), lời giải mẫu chạy được, lỗi hay gặp bị bắt đúng.
import { describe, expect, it } from 'vitest';
import { BoardSim, PIN_COUNT, assemblyStars, evaluate, padIndex, padsOf, type AsmLevel, type Placement, type Pt } from '../src/core/assembly/board';
import { ASSEMBLY_LEVELS, assemblyLevel } from '../src/core/assembly/levels';

const key = (p: Pt): string => `${p[0]},${p[1]}`;

/** Mọi điểm lưới nằm trên đoạn thẳng ngang/dọc a-b. */
function cells(a: Pt, b: Pt): Pt[] {
  const out: Pt[] = [];
  const dx = Math.sign(b[0] - a[0]);
  const dy = Math.sign(b[1] - a[1]);
  let p: Pt = a;
  out.push(p);
  while (p[0] !== b[0] || p[1] !== b[1]) {
    p = [p[0] + dx, p[1] + dy];
    out.push(p);
  }
  return out;
}

/** Các lỗ (pad) của bo: toạ độ → lưới điện. */
function padMap(lv: AsmLevel): Map<string, number> {
  const m = new Map<string, number>();
  const add = (p: Pt, net: number): void => {
    expect(m.has(key(p)), `${lv.id}: 2 lỗ trùng chỗ ${key(p)}`).toBe(false);
    m.set(key(p), net);
  };
  add(lv.battery.plus, lv.battery.net);
  add(lv.battery.minus, 0);
  for (const l of lv.lamps ?? []) {
    add(l.a, l.nets[0]);
    add(l.b, l.nets[1]);
  }
  for (const fp of lv.footprints) padsOf(fp).forEach((p, i) => add(p, fp.nets[i]!));
  return m;
}

describe.each(ASSEMBLY_LEVELS.map((l) => [l.id, l] as const))('màn %s', (_id, lv) => {
  it('đường đồng chỉ đi ngang/dọc, trong bo, không chạm lỗ hay đường của lưới khác', () => {
    const pads = padMap(lv);
    for (const [k] of pads) {
      const [x, y] = k.split(',').map(Number) as [number, number];
      expect(x >= 0 && x < lv.cols && y >= 0 && y < lv.rows, `${lv.id}: lỗ ${k} ngoài bo`).toBe(true);
    }
    const owner: Map<string, number>[] = [new Map(), new Map()];
    for (const t of lv.traces) {
      for (let i = 0; i + 1 < t.pts.length; i++) {
        const [a, b] = [t.pts[i]!, t.pts[i + 1]!];
        expect(a[0] === b[0] || a[1] === b[1], `${lv.id}: đoạn chéo ${key(a)}-${key(b)}`).toBe(true);
        for (const c of cells(a, b)) {
          const k = key(c);
          const pn = pads.get(k);
          expect(pn === undefined || pn === t.net, `${lv.id}: đường net ${t.net} chạm lỗ net ${pn} tại ${k}`).toBe(true);
          const o = owner[t.layer]!.get(k);
          expect(o === undefined || o === t.net, `${lv.id}: net ${t.net} chạm net ${o} tại ${k} (mặt ${t.layer})`).toBe(true);
          owner[t.layer]!.set(k, t.net);
        }
      }
    }
  });

  it('mỗi lưới điện: mọi lỗ được nối liền bằng đường đồng', () => {
    const pads = padMap(lv);
    // đồ thị: điểm lưới; đường đồng nối các ô liên tiếp; 2 mặt nối nhau tại điểm chung (via)
    const adj = new Map<string, Set<string>>();
    const link = (a: string, b: string): void => {
      if (!adj.has(a)) adj.set(a, new Set());
      if (!adj.has(b)) adj.set(b, new Set());
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    };
    for (const t of lv.traces)
      for (let i = 0; i + 1 < t.pts.length; i++) {
        const cs = cells(t.pts[i]!, t.pts[i + 1]!);
        for (let j = 0; j + 1 < cs.length; j++) link(key(cs[j]!), key(cs[j + 1]!));
      }
    const byNet = new Map<number, string[]>();
    for (const [k, n] of pads) byNet.set(n, [...(byNet.get(n) ?? []), k]);
    for (const [net, list] of byNet) {
      if (list.length < 2) continue;
      const seen = new Set([list[0]!]);
      const stack = [list[0]!];
      while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) (seen.add(n), stack.push(n));
      for (const p of list) expect(seen.has(p), `${lv.id}: net ${net}: lỗ ${p} không nối với ${list[0]}`).toBe(true);
    }
  });

  it('lời giải mẫu: đúng loại linh kiện, mỗi linh kiện dùng 1 lần, chạy đúng mọi mục tiêu', () => {
    const used = new Set<number>();
    for (const fp of lv.footprints) {
      const pl = lv.solution[fp.id];
      if (!pl) continue;
      expect(used.has(pl.tray)).toBe(false);
      used.add(pl.tray);
      expect(PIN_COUNT[lv.tray[pl.tray]!.kind]).toBe(PIN_COUNT[fp.kind]);
    }
    const r = evaluate(lv, lv.solution);
    expect(r.burnt).toEqual([]);
    expect(r.shorted).toBe(false);
    for (const c of r.checks) expect(c.ok, `${lv.id}: ${c.text}: ${c.got}`).toBe(true);
    expect(r.pass).toBe(true);
  });

  it('bo trống thì không qua', () => {
    expect(evaluate(lv, {}).pass).toBe(false);
  });
});

/** Lời giải mẫu đổi một chỗ. */
const tweak = (id: string, change: Placement): { lv: AsmLevel; pl: Placement } => {
  const lv = assemblyLevel(id)!;
  return { lv, pl: { ...lv.solution, ...change } };
};

describe('lỗi hay gặp bị bắt đúng', () => {
  it('a01: LED cắm ngược → không sáng, không cháy', () => {
    const { lv, pl } = tweak('a01', { D1: { tray: 1, flip: true } });
    const r = evaluate(lv, pl);
    expect(r.pass).toBe(false);
    expect(r.burnt).toEqual([]);
    expect(r.checks[0]!.got).toBe('0,0 mA');
  });
  it('a01: điện trở cắm ngược vẫn chạy (không phân cực)', () => {
    const { lv, pl } = tweak('a01', { R1: { tray: 0, flip: true } });
    expect(evaluate(lv, pl).pass).toBe(true);
  });
  it('a01: đổi chỗ LED và điện trở → LED vẫn sáng trên bo, nhưng màn yêu cầu LED ở đúng chỗ D1', () => {
    const lv = assemblyLevel('a01')!;
    const pl: Placement = { R1: { tray: 1, flip: false }, D1: { tray: 0, flip: false } };
    const sim = new BoardSim(lv, pl);
    sim.run(0.1);
    expect(sim.isLit('R1')).toBe(true);
    const r = evaluate(lv, pl);
    expect(r.pass).toBe(false);
    expect(r.checks[0]!.got).toBe('chỗ D1 chưa có LED');
  });
  it('a02: 10 Ω làm cháy LED; 100 kΩ thì LED quá mờ', () => {
    const lv = assemblyLevel('a02')!;
    const burn = evaluate(lv, { ...lv.solution, R1: { tray: 0, flip: false } });
    expect(burn.burnt.map((b) => b.id)).toContain('D1');
    const dim = evaluate(lv, { ...lv.solution, R1: { tray: 2, flip: false } });
    expect(dim.burnt).toEqual([]);
    expect(dim.checks[0]!.got).toMatch(/quá mờ/);
  });
  it('a04: nút đặt vào chỗ điện trở → sai bảng chân trị', () => {
    const lv = assemblyLevel('a04')!;
    // S2 thay bằng dây (điện trở trong chỗ nút) → chỉ còn S1 điều khiển
    const r = evaluate(lv, { S1: { tray: 0, flip: false }, S2: { tray: 2, flip: false }, R1: { tray: 1, flip: false }, D1: { tray: 3, flip: false } });
    expect(r.pass).toBe(false);
  });
  it('a06: diode ngược → LED không sáng', () => {
    const { lv, pl } = tweak('a06', { D1: { tray: 0, flip: true } });
    expect(evaluate(lv, pl).pass).toBe(false);
  });
  it('a07: transistor cắm ngược (đảo E và C) → không chạy; điện trở base 47 Ω → cháy transistor', () => {
    const { lv, pl } = tweak('a07', { Q1: { tray: 5, flip: true } });
    expect(evaluate(lv, pl).pass).toBe(false);
    const b = evaluate(lv, { ...lv.solution, R1: { tray: 3, flip: false } });
    expect(b.burnt.map((x) => x.id)).toContain('Q1');
  });
  it('a09: tụ hoá ngược cực bị phồng; tụ gốm 100 nF không giữ được LED', () => {
    const { lv, pl } = tweak('a09', { C1: { tray: 1, flip: true } });
    expect(evaluate(lv, pl).burnt.map((x) => x.id)).toContain('C1');
    const small = evaluate(lv, { ...lv.solution, C1: { tray: 2, flip: false } });
    expect(small.pass).toBe(false);
    expect(small.checks[1]!.ok).toBe(false);
  });
  it('a10: thiếu điện trở kéo xuống → đèn sáng lơ lửng sau khi nhả nút; BJT thay MOSFET → không chạy', () => {
    const lv = assemblyLevel('a10')!;
    const r = evaluate(lv, { ...lv.solution, R2: undefined });
    expect(r.checks[0]!.ok).toBe(true);
    expect(r.checks[1]!.ok).toBe(false);
    const bjt = evaluate(lv, { ...lv.solution, Q1: { tray: 3, flip: false } });
    expect(bjt.pass).toBe(false);
    expect(bjt.checks[0]!.ok).toBe(false);
  });
  it('a11: IC ngược → cháy; tụ 100 nF → nháy quá nhanh', () => {
    const { lv, pl } = tweak('a11', { U1: { tray: 0, flip: true } });
    expect(evaluate(lv, pl).burnt.map((x) => x.id)).toContain('U1');
    const fast = evaluate(lv, { ...lv.solution, C1: { tray: 5, flip: false } });
    expect(fast.pass).toBe(false);
    expect(fast.checks[0]!.got).toMatch(/quá nhanh|liên tục/);
  });
});

describe('quy tắc chung', () => {
  it('xoay IC 180°: chân k nằm ở lỗ (k + 4) mod 8; linh kiện 3 chân đảo thứ tự', () => {
    expect(padIndex('U555', 0, true)).toBe(4);
    expect(padIndex('U555', 7, true)).toBe(3);
    expect(padIndex('Q', 0, true)).toBe(2);
    expect(padIndex('LED', 1, false)).toBe(1);
  });
  it('sao theo số lần cấp nguồn', () => {
    expect([1, 2, 3, 4, 9].map(assemblyStars)).toEqual([3, 2, 2, 1, 1]);
  });
  it('mô phỏng thời gian thực: ấn nút trên bo đã lắp làm LED sáng', () => {
    const lv = assemblyLevel('a03')!;
    const sim = new BoardSim(lv, lv.solution);
    sim.run(0.1);
    expect(sim.isLit('D1')).toBe(false);
    sim.setSwitch('S1', true);
    sim.run(0.1);
    expect(sim.isLit('D1')).toBe(true);
    expect(sim.reading('D1')!.v).toBeCloseTo(2.09, 1);
  });
});
