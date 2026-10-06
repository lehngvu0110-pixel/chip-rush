import { describe, expect, it, vi } from 'vitest';
import { createSafeStorage } from '../src/platform/storage';

/** localStorage giả, có thể bật các kiểu hỏng khác nhau. */
function fakeBackend(opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}) {
  const m = new Map<string, string>();
  return {
    data: m,
    opts,
    getItem: (k: string) => {
      if (opts.throwOnGet) throw new Error('SecurityError');
      return m.get(k) ?? null;
    },
    setItem: (k: string, v: string) => {
      if (opts.throwOnSet) throw new Error('QuotaExceededError');
      m.set(k, v);
    },
    removeItem: (k: string) => void m.delete(k),
  };
}

describe('createSafeStorage', () => {
  it('lưu và đọc JSON bình thường, persistent = true', () => {
    const b = fakeBackend();
    const s = createSafeStorage(() => b);
    expect(s.persistent).toBe(true);
    expect(s.set('k', { a: 1 })).toBe(true);
    expect(s.get('k', null)).toEqual({ a: 1 });
    expect(b.data.get('k')).toBe('{"a":1}');
    expect(b.data.has('__chiprush_probe__')).toBe(false); // khóa thử đã được xóa
  });

  it('chính việc truy cập localStorage ném lỗi (Private Mode / iframe bị chặn) → chạy bằng RAM', () => {
    const s = createSafeStorage(() => {
      throw new Error('SecurityError');
    });
    expect(s.persistent).toBe(false);
    expect(s.set('k', 5)).toBe(false);
    expect(s.get('k', 0)).toBe(5); // vẫn đọc lại được trong phiên
  });

  it('không có localStorage (null) → chạy bằng RAM và báo ngay cho người nghe đăng ký sau', () => {
    const s = createSafeStorage(() => null);
    const cb = vi.fn();
    s.onPersistenceLost(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('ghi bị đầy bộ nhớ giữa chừng → trả false, báo mất lưu đúng 1 lần, dữ liệu vẫn còn trong RAM', () => {
    const b = fakeBackend();
    const s = createSafeStorage(() => b);
    const cb = vi.fn();
    s.onPersistenceLost(cb);
    b.opts.throwOnSet = true;
    expect(s.set('a', 1)).toBe(false);
    expect(s.set('b', 2)).toBe(false);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.persistent).toBe(false);
    expect(s.get('a', 0)).toBe(1);
  });

  it('đọc ném lỗi → trả giá trị mặc định thay vì crash', () => {
    const b = fakeBackend();
    const s = createSafeStorage(() => b);
    b.opts.throwOnGet = true;
    expect(s.get('missing', 'mặc định')).toBe('mặc định');
    expect(s.persistent).toBe(false);
  });

  it('JSON hỏng → trả giá trị mặc định', () => {
    const b = fakeBackend();
    b.data.set('k', '{hỏng');
    const s = createSafeStorage(() => b);
    expect(s.get('k', 42)).toBe(42);
  });

  it('remove xóa cả trong RAM lẫn localStorage', () => {
    const b = fakeBackend();
    const s = createSafeStorage(() => b);
    s.set('k', 1);
    s.remove('k');
    expect(s.get('k', null)).toBeNull();
    expect(b.data.has('k')).toBe(false);
  });
});
