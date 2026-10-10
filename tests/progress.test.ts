// Dữ liệu lưu bị hỏng từng phần: chỉ mất phần hỏng, phần còn lại giữ nguyên; ghi tiến độ đè lên vẫn chạy.
import { describe, expect, it } from 'vitest';
import { loadSave, recordDebug, recordDesign } from '../src/core/progress';
import type { SafeStorage } from '../src/platform/storage';

const mk = (raw: unknown): SafeStorage => ({ get: () => raw, set: () => true, remove: () => {}, onPersistenceLost: () => {} }) as unknown as SafeStorage;

describe('đọc dữ liệu lưu hỏng từng màn', () => {
  const raw = {
    version: 1,
    design: { d01: 'x', d02: { stars: '3' }, d03: null, d04: { stars: 7, best: { A: 5, D: -1, P: 'z' }, hinted: 'yes' }, d05: { stars: 2, best: { A: 7, D: 1, P: 5 }, hinted: true } },
    debug: { t01: null, t02: { probes: -1 }, t03: { stars: 3, probes: 2 } },
  };

  it('bỏ mục hỏng, kẹp giá trị lạ về mặc định hợp lệ, giữ mục tốt', () => {
    const d = loadSave(mk(raw)).data;
    expect(Object.keys(d.design).sort()).toEqual(['d04', 'd05']);
    expect(d.design.d04).toEqual({ stars: 3, best: { A: 5, D: 0, P: 0 }, hinted: false });
    expect(d.design.d05).toEqual({ stars: 2, best: { A: 7, D: 1, P: 5 }, hinted: true });
    expect(d.debug).toEqual({ t02: { stars: 0, probes: 0 }, t03: { stars: 3, probes: 2 } });
  });

  it('ghi kết quả đè lên dữ liệu đã làm sạch không văng lỗi (trước 19/10: TypeError)', () => {
    const d = loadSave(mk(raw)).data;
    expect(() => recordDesign(d, 'd01', { A: 4, D: 0, P: 1, C: 5 }, 3)).not.toThrow();
    expect(() => recordDebug(d, 't01', 3, 2)).not.toThrow();
    expect(d.design.d01?.stars).toBe(3);
  });
});
