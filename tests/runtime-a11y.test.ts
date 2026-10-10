// Câu đọc cho trình đọc màn hình ở VẬN HÀNH (canvas không tự đọc được).
import { describe, expect, it } from 'vitest';
import { packetSpeech } from '../src/modes/runtime/runtime-scene';

describe('packetSpeech', () => {
  it('đọc 2 bit vào và bit cần ra, kèm kết quả lượt trước', () => {
    expect(packetSpeech({ a: 1, b: 0, target: 1 })).toBe('A 1, B 0, cần ra 1');
    expect(packetSpeech({ a: 0, b: 0, target: 1 }, 'Đúng. ')).toBe('Đúng. A 0, B 0, cần ra 1');
  });
});
