// Dữ liệu lưu bị hỏng từng phần: chỉ mất phần hỏng, phần còn lại giữ nguyên; ghi tiến độ đè lên vẫn chạy.
import { describe, expect, it } from 'vitest';
import { beatAiLevels } from '../src/core/badges';
import { assemblyUnlocked, defaultSave, loadSave, recordAssembly, recordDebug, recordDesign } from '../src/core/progress';
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
    // d04 có best sai (D âm, P chữ) → bỏ cả mục (21/10): điền 0 sẽ thành chi phí giả rất thấp
    expect(Object.keys(d.design).sort()).toEqual(['d05']);
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

describe('rà soát 21/10', () => {
  it('sao trong lịch sử Chip hôm nay bị kẹp về 0..3 (trước: 7 sao → vẽ 7 ngôi sao)', () => {
    const d = loadSave(mk({ version: 1, daily: { lastDate: '2026-10-20', streak: 1, history: { '2026-10-20': { stars: 7, score: 10 }, '2026-10-19': { stars: 2.6, score: 1 } } } })).data;
    expect(d.daily.history['2026-10-20']?.stars).toBe(3);
    expect(d.daily.history['2026-10-19']?.stars).toBe(2);
  });

  it('best thiếu chỉ số không được thành chi phí 0 và tự trao "Hơn cả AI"', () => {
    const d = loadSave(mk({ version: 1, design: { d01: { stars: 3, best: {} }, d02: { stars: 3, best: { A: 0, D: 0 } } } })).data;
    expect(d.design).toEqual({});
    expect(beatAiLevels(d)).toEqual([]);
  });

  it('recordDesign so sánh bằng đúng công thức chi phí của game (costOf)', () => {
    const d = loadSave(mk(null)).data;
    recordDesign(d, 'd01', { A: 4, D: 2, P: 4, C: 14 }, 2);
    // chi phí mới 13 < 14 → phải ghi đè best
    recordDesign(d, 'd01', { A: 5, D: 1, P: 5, C: 13 }, 2);
    expect(d.design.d01?.best).toEqual({ A: 5, D: 1, P: 5 });
  });
});

describe('LẮP RÁP (thêm 22/10)', () => {
  it('dữ liệu cũ không có mục assembly → rỗng; mục hỏng bị bỏ, giá trị lạ bị kẹp', () => {
    expect(loadSave(mk({ version: 1, design: {} })).data.assembly).toEqual({});
    const d = loadSave(mk({ version: 1, assembly: { a01: { stars: 9, powerOns: 0 }, a02: 'x', zz: { stars: 3, powerOns: 1 }, a03: { stars: 2, powerOns: 4.7 } } })).data;
    expect(d.assembly).toEqual({ a01: { stars: 3, powerOns: 1 }, a03: { stars: 2, powerOns: 4 } });
  });
  it('giữ sao cao nhất và số lần cấp nguồn ít nhất; màn sau mở khi qua màn trước', () => {
    const d = defaultSave();
    const ids = ['a01', 'a02'];
    expect(assemblyUnlocked(d, ids, 0)).toBe(true);
    expect(assemblyUnlocked(d, ids, 1)).toBe(false);
    expect(recordAssembly(d, 'a01', 2, 2)).toBe(true);
    expect(recordAssembly(d, 'a01', 1, 5)).toBe(false);
    expect(d.assembly.a01).toEqual({ stars: 2, powerOns: 2 });
    expect(recordAssembly(d, 'a01', 3, 1)).toBe(true);
    expect(d.assembly.a01).toEqual({ stars: 3, powerOns: 1 });
    expect(assemblyUnlocked(d, ids, 1)).toBe(true);
  });
});
