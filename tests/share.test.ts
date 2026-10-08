// Chia sẻ: đường lùi từ Web Share có ảnh → chỉ chữ → sao chép → không có gì.
import { describe, expect, it, vi } from 'vitest';
import { gameUrl, shareResult, type ShareNav } from '../src/platform/share';

const input = { title: 'CHIP RUSH', text: 'Mình đạt 1000 điểm', url: 'https://x.io/chip-rush/', file: new File(['x'], 'a.png', { type: 'image/png' }) };
const abort = (): Error => Object.assign(new Error('huỷ'), { name: 'AbortError' });

describe('shareResult', () => {
  it('chia sẻ được ảnh → dùng ảnh', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const nav: ShareNav = { share, canShare: () => true };
    expect(await shareResult(input, nav)).toBe('shared');
    expect(share.mock.calls[0]?.[0].files).toHaveLength(1);
  });

  it('không chia sẻ được ảnh → chia sẻ chữ + link', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(input, { share, canShare: () => false })).toBe('shared-text');
    expect(share.mock.calls[0]?.[0]).toMatchObject({ url: input.url });
  });

  it('ảnh bị từ chối (lỗi khác huỷ) → lùi về chữ', async () => {
    const share = vi.fn().mockRejectedValueOnce(new Error('NotAllowed')).mockResolvedValueOnce(undefined);
    expect(await shareResult(input, { share, canShare: () => true })).toBe('shared-text');
  });

  it('người chơi bấm huỷ → dừng, không sao chép', async () => {
    const writeText = vi.fn();
    expect(await shareResult(input, { share: vi.fn().mockRejectedValue(abort()), canShare: () => true, clipboard: { writeText } })).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('không có Web Share → sao chép lời mời kèm link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    expect(await shareResult(input, { clipboard: { writeText } })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Mình đạt 1000 điểm https://x.io/chip-rush/');
  });

  it('không có gì → unavailable', async () => {
    expect(await shareResult(input, {})).toBe('unavailable');
    expect(await shareResult(input, { clipboard: { writeText: () => Promise.reject(new Error('x')) } })).toBe('unavailable');
  });

  it('gameUrl bỏ tham số truy vấn', () => {
    expect(gameUrl({ origin: 'https://a.github.io', pathname: '/chip-rush/' })).toBe('https://a.github.io/chip-rush/');
  });
});
