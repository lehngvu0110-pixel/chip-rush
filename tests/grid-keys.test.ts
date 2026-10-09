// Chơi bằng bàn phím: đổi phím → hành động trên lưới.
import { describe, expect, it } from 'vitest';
import { gridKeyAction, moveCursor } from '../src/input/grid-keys';

const k = (key: string, mods: Partial<{ shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...mods });

describe('phím trên lưới', () => {
  it('mũi tên = di chuyển; Shift + mũi tên = kéo dây', () => {
    expect(gridKeyAction(k('ArrowRight'), false)).toEqual({ kind: 'move', dc: 1, dr: 0, draw: false });
    expect(gridKeyAction(k('ArrowUp', { shiftKey: true }), false)).toEqual({ kind: 'move', dc: 0, dr: -1, draw: true });
  });
  it('Space/Enter = chạm, trừ khi đang focus một nút (để nút tự xử lý)', () => {
    expect(gridKeyAction(k(' '), false)).toEqual({ kind: 'tap' });
    expect(gridKeyAction(k('Enter'), false)).toEqual({ kind: 'tap' });
    expect(gridKeyAction(k(' '), true)).toBeNull();
    expect(gridKeyAction(k('Enter'), true)).toBeNull();
  });
  it('bỏ qua tổ hợp Ctrl/Cmd/Alt (Ctrl+Z hoàn tác xử lý riêng) và phím khác', () => {
    expect(gridKeyAction(k('ArrowLeft', { ctrlKey: true }), false)).toBeNull();
    expect(gridKeyAction(k('ArrowLeft', { metaKey: true }), false)).toBeNull();
    expect(gridKeyAction(k('a'), false)).toBeNull();
  });
  it('con trỏ không ra ngoài lưới', () => {
    expect(moveCursor([0, 0], -1, 0, 5, 3)).toEqual([0, 0]);
    expect(moveCursor([4, 2], 1, 1, 5, 3)).toEqual([4, 2]);
    expect(moveCursor([2, 1], 1, 0, 5, 3)).toEqual([3, 1]);
  });
});
