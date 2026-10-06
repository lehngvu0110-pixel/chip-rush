import { describe, expect, it, vi } from 'vitest';
import { watchVisibility } from '../src/platform/visibility';
import { installGlobalErrorHandlers, makeErrorCode, toReport } from '../src/platform/errors';

describe('watchVisibility', () => {
  const setup = () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    const win = new EventTarget();
    const onPause = vi.fn();
    const onVisible = vi.fn();
    const off = watchVisibility({ doc, win, onPause, onVisible });
    return { doc, win, onPause, onVisible, off };
  };

  it('ẩn tab → pause("hidden"); hiện lại → onVisible', () => {
    const t = setup();
    t.doc.visibilityState = 'hidden';
    t.doc.dispatchEvent(new Event('visibilitychange'));
    expect(t.onPause).toHaveBeenCalledWith('hidden');
    t.doc.visibilityState = 'visible';
    t.doc.dispatchEvent(new Event('visibilitychange'));
    expect(t.onVisible).toHaveBeenCalledTimes(1);
  });

  it('mất focus và xoay màn hình cũng pause', () => {
    const t = setup();
    t.win.dispatchEvent(new Event('blur'));
    t.win.dispatchEvent(new Event('orientationchange'));
    expect(t.onPause.mock.calls).toEqual([['blur'], ['orientation']]);
  });

  it('hủy đăng ký thì không nhận sự kiện nữa', () => {
    const t = setup();
    t.off();
    t.win.dispatchEvent(new Event('blur'));
    expect(t.onPause).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it('mã lỗi ổn định, dạng E-XXXXXX, khác nhau khi thông điệp khác', () => {
    const a = makeErrorCode('x is undefined', 'Error\n    at f (main.ts:1:1)');
    expect(a).toMatch(/^E-[0-9A-F]{6}$/);
    expect(makeErrorCode('x is undefined', 'Error\n    at f (main.ts:1:1)')).toBe(a);
    expect(makeErrorCode('y is undefined', 'Error\n    at f (main.ts:1:1)')).not.toBe(a);
  });

  it('toReport nhận cả giá trị không phải Error', () => {
    const r = toReport('chuỗi lỗi', 'v1', new Date('2026-10-08T00:00:00Z'));
    expect(r).toMatchObject({ message: 'chuỗi lỗi', version: 'v1', time: '2026-10-08T00:00:00.000Z' });
  });

  it('chỉ báo lỗi đầu tiên; bỏ qua lỗi tải tài nguyên (không có error/message)', () => {
    const win = new EventTarget();
    const onFatal = vi.fn();
    installGlobalErrorHandlers(win, 'v1', onFatal);
    win.dispatchEvent(new Event('error')); // lỗi tải ảnh/font: không có .error
    expect(onFatal).not.toHaveBeenCalled();

    const e1 = Object.assign(new Event('error'), { error: new Error('lỗi 1'), message: 'lỗi 1' });
    const e2 = Object.assign(new Event('unhandledrejection'), { reason: new Error('lỗi 2') });
    win.dispatchEvent(e1);
    win.dispatchEvent(e2);
    expect(onFatal).toHaveBeenCalledTimes(1);
    expect(onFatal.mock.calls[0]?.[0].message).toBe('lỗi 1');
  });

  it('bắt promise bị reject không ai xử lý', () => {
    const win = new EventTarget();
    const onFatal = vi.fn();
    installGlobalErrorHandlers(win, 'v1', onFatal);
    win.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason: new Error('async hỏng') }));
    expect(onFatal.mock.calls[0]?.[0].message).toBe('async hỏng');
  });
});
