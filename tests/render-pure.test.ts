// Test phần thuần của lớp đồ hoạ: màu và bố cục bo mạch trang trí.
import { describe, expect, it } from 'vitest';
import { easeOutBack, easeOutCubic, hexToRgb, mixHex, rgba } from '../src/render/color';
import { generatePcb, pointAt, polylineLengths } from '../src/render/pcb-layout';

describe('color', () => {
  it('đổi hex sang rgb, cả dạng rút gọn', () => {
    expect(hexToRgb('#38e8ff')).toEqual([56, 232, 255]);
    expect(hexToRgb('#fff')).toEqual([255, 255, 255]);
  });
  it('rgba kẹp alpha vào [0,1]', () => {
    expect(rgba('#000000', 2)).toBe('rgba(0,0,0,1)');
    expect(rgba('#000000', -1)).toBe('rgba(0,0,0,0)');
  });
  it('mixHex ở hai đầu trả đúng màu gốc', () => {
    expect(mixHex('#000000', '#ffffff', 0)).toBe('rgb(0,0,0)');
    expect(mixHex('#000000', '#ffffff', 1)).toBe('rgb(255,255,255)');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('rgb(128,128,128)');
  });
  it('easing: 0→0, 1→1', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutBack(1)).toBeCloseTo(1);
  });
});

describe('generatePcb', () => {
  const avoid = [{ x: 60, y: 100, w: 240, h: 400 }];
  const L = generatePcb(360, 740, 42, avoid);

  it('cùng seed → cùng bố cục (tái lập được)', () => {
    expect(generatePcb(360, 740, 42, avoid)).toEqual(L);
    expect(generatePcb(360, 740, 43, avoid)).not.toEqual(L);
  });

  it('có đủ đường mạch để trông như bo mạch', () => {
    // toàn màn hình: dày; có vùng tránh lớn (chỉ còn 2 dải mép 60 px): vẫn có vài đường
    expect(generatePcb(360, 740, 42).traces.length).toBeGreaterThan(15);
    expect(L.traces.length).toBeGreaterThanOrEqual(5);
  });

  it('mọi điểm nằm trong màn hình và ngoài vùng tránh', () => {
    for (const t of L.traces) {
      for (const p of t) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(360);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeLessThanOrEqual(740);
        const a = avoid[0]!;
        const inside = p.x >= a.x && p.x <= a.x + a.w && p.y >= a.y && p.y <= a.y + a.h;
        expect(inside).toBe(false);
      }
    }
  });

  it('hai đường mạch không bao giờ chung ô lưới', () => {
    const seen = new Set<number>();
    for (const cells of L.traceCells) {
      for (const c of cells) {
        expect(seen.has(c)).toBe(false);
        seen.add(c);
      }
    }
  });

  it('mỗi đoạn mạch đi ngang, dọc hoặc chéo đúng 45°', () => {
    for (const t of L.traces) {
      for (let i = 1; i < t.length; i++) {
        const dx = Math.abs(t[i]!.x - t[i - 1]!.x);
        const dy = Math.abs(t[i]!.y - t[i - 1]!.y);
        expect(dx === 0 || dy === 0 || Math.abs(dx - dy) < 1e-6).toBe(true);
      }
    }
  });

  it('pointAt nội suy đúng trên đường gấp khúc', () => {
    const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
    const acc = polylineLengths(pts);
    expect(acc).toEqual([0, 10, 20]);
    expect(pointAt(pts, acc, 5)).toEqual({ x: 5, y: 0 });
    expect(pointAt(pts, acc, 15)).toEqual({ x: 10, y: 5 });
    expect(pointAt(pts, acc, 99)).toEqual({ x: 10, y: 10 });
  });
});
