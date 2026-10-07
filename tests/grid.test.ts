// Lưới 2 lớp (THIẾT KẾ): toạ độ, đi dây, via, cổng, lưu/nạp.
import { describe, expect, it } from 'vitest';
import { Grid, type GridSpec } from '../src/core/circuit/grid';

const spec: GridSpec = {
  cols: 6,
  rows: 8,
  layers: 2,
  inputs: [{ id: 'A', cell: [0, 2] }, { id: 'B', cell: [0, 5] }],
  outputs: [{ id: 'Y', cell: [5, 3] }],
  blocked: [[2, 4]],
};

describe('Grid – toạ độ', () => {
  const g = new Grid(spec);
  it('đổi (cột, hàng) ↔ chỉ số ô', () => {
    expect(g.cellAt(0, 0)).toBe(0);
    expect(g.cellAt(5, 7)).toBe(47);
    expect(g.colRow(g.cellAt(3, 4))).toEqual([3, 4]);
    expect(g.cellAt(6, 0)).toBe(-1);
    expect(g.cellAt(0, -1)).toBe(-1);
  });
  it('ô kề theo 4 hướng, ra ngoài lưới = -1', () => {
    const c = g.cellAt(0, 0);
    expect(g.neighbor(c, 0)).toBe(g.cellAt(1, 0));
    expect(g.neighbor(c, 1)).toBe(g.cellAt(0, 1));
    expect(g.neighbor(c, 2)).toBe(-1);
    expect(g.neighbor(c, 3)).toBe(-1);
  });
  it('ghi nhận chân vào/ra và ô bị chặn', () => {
    expect(g.pins.get(g.cellAt(0, 2))).toEqual({ kind: 'in', id: 'A' });
    expect(g.pins.get(g.cellAt(5, 3))).toEqual({ kind: 'out', id: 'Y' });
    expect(g.blocked.has(g.cellAt(2, 4))).toBe(true);
  });
  it('báo lỗi khi chân nằm ngoài lưới hoặc trùng ô', () => {
    expect(() => new Grid({ ...spec, inputs: [{ id: 'A', cell: [9, 9] }] })).toThrow();
    expect(() => new Grid({ ...spec, outputs: [{ id: 'Y', cell: [0, 2] }] })).toThrow();
  });
});

describe('Grid – đi dây', () => {
  it('chỉ nối được 2 ô KỀ nhau (không chéo, không nhảy cóc)', () => {
    const g = new Grid(spec);
    expect(g.addWire(0, g.cellAt(1, 1), g.cellAt(2, 1))).toBe(true);
    expect(g.addWire(0, g.cellAt(1, 1), g.cellAt(2, 2))).toBe(false);
    expect(g.addWire(0, g.cellAt(1, 1), g.cellAt(3, 1))).toBe(false);
    // ô cuối hàng và ô đầu hàng sau có chỉ số liền nhau nhưng KHÔNG kề nhau
    expect(g.addWire(0, g.cellAt(5, 0), g.cellAt(0, 1))).toBe(false);
  });
  it('thêm trùng không tính, xoá được, hướng cạnh không quan trọng', () => {
    const g = new Grid(spec);
    const a = g.cellAt(1, 1);
    const b = g.cellAt(1, 2);
    expect(g.addWire(0, a, b)).toBe(true);
    expect(g.addWire(0, b, a)).toBe(false);
    expect(g.hasWire(0, b, a)).toBe(true);
    expect(g.removeWire(0, b, a)).toBe(true);
    expect(g.hasWire(0, a, b)).toBe(false);
  });
  it('không đi dây vào ô bị chặn, ở cả 2 lớp', () => {
    const g = new Grid(spec);
    expect(g.addWire(0, g.cellAt(1, 4), g.cellAt(2, 4))).toBe(false);
    expect(g.addWire(1, g.cellAt(1, 4), g.cellAt(2, 4))).toBe(false);
  });
  it('lưới 1 lớp từ chối dây lớp 2', () => {
    const g = new Grid({ ...spec, layers: 1 });
    expect(g.addWire(1, g.cellAt(1, 1), g.cellAt(2, 1))).toBe(false);
  });
  it('drawPath nối từng cặp liên tiếp và bỏ qua bước không hợp lệ', () => {
    const g = new Grid(spec);
    const path = [[1, 3], [1, 4], [2, 4], [3, 4], [3, 5]].map(([c, r]) => g.cellAt(c!, r!));
    // (1,4)→(2,4) và (2,4)→(3,4) bị chặn → chỉ thêm 2 cạnh
    expect(g.drawPath(0, path)).toBe(2);
    expect(g.wires()).toHaveLength(2);
  });
  it('wireSides liệt kê đúng các phía có dây', () => {
    const g = new Grid(spec);
    const c = g.cellAt(3, 3);
    g.addWire(0, c, g.cellAt(4, 3));
    g.addWire(0, c, g.cellAt(3, 2));
    expect(g.wireSides(0, c)).toEqual([0, 3]);
    expect(g.wireSides(1, c)).toEqual([]);
  });
});

describe('Grid – via và cổng', () => {
  it('via chỉ đặt ở ô thường của lưới 2 lớp; bấm lần 2 thì gỡ', () => {
    const g = new Grid(spec);
    expect(g.toggleVia(g.cellAt(3, 3))).toBe(true);
    expect(g.hasVia(g.cellAt(3, 3))).toBe(true);
    expect(g.toggleVia(g.cellAt(3, 3))).toBe(true);
    expect(g.hasVia(g.cellAt(3, 3))).toBe(false);
    expect(g.toggleVia(g.cellAt(0, 2))).toBe(false); // chân
    expect(g.toggleVia(g.cellAt(2, 4))).toBe(false); // bị chặn
    expect(new Grid({ ...spec, layers: 1 }).toggleVia(3)).toBe(false);
  });
  it('cổng không đặt lên chân, ô chặn, via hay cổng khác', () => {
    const g = new Grid(spec);
    expect(g.placeGate(g.cellAt(0, 2), 'AND')).toBeNull();
    expect(g.placeGate(g.cellAt(2, 4), 'AND')).toBeNull();
    g.toggleVia(g.cellAt(1, 1));
    expect(g.placeGate(g.cellAt(1, 1), 'AND')).toBeNull();
    expect(g.placeGate(g.cellAt(3, 3), 'AND')?.id).toBe('g3_3');
    expect(g.placeGate(g.cellAt(3, 3), 'OR')).toBeNull();
    expect(g.toggleVia(g.cellAt(3, 3))).toBe(false);
  });
  it('tẩy ô lớp 1 xoá dây chạm ô, via và cổng; lớp 2 giữ nguyên', () => {
    const g = new Grid(spec);
    const c = g.cellAt(3, 3);
    g.placeGate(c, 'AND');
    g.addWire(0, c, g.cellAt(2, 3));
    g.addWire(1, c, g.cellAt(4, 3));
    g.eraseCell(0, c);
    expect(g.gateAt(c)).toBeUndefined();
    expect(g.wireSides(0, c)).toEqual([]);
    expect(g.wireSides(1, c)).toEqual([0]);
  });
  it('state/load/clone giữ nguyên mọi thứ; dữ liệu hỏng bị bỏ qua', () => {
    const g = new Grid(spec);
    g.placeGate(g.cellAt(3, 3), 'XOR', 1);
    g.toggleVia(g.cellAt(1, 1));
    g.drawPath(1, [g.cellAt(1, 1), g.cellAt(2, 1), g.cellAt(3, 1)]);
    const copy = g.clone();
    expect(copy.state()).toEqual(g.state());
    const bad = new Grid(spec);
    bad.load({ wires: [[0, 0, 7], [5, 1, 2]], vias: [g.cellAt(0, 2)], gates: [{ type: 'AND', cell: g.cellAt(2, 4), out: 0 }] });
    expect(bad.state()).toEqual({ wires: [], vias: [], gates: [] });
  });
});
