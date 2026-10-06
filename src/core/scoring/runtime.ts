import { RUNTIME } from '../../config';

/** Hệ số điểm theo chuỗi đúng liên tiếp TRƯỚC câu này: 1 + floor(combo / 5), tối đa 4. */
export function multiplier(combo: number): number {
  return Math.min(RUNTIME.maxMultiplier, 1 + Math.floor(combo / RUNTIME.comboStep));
}

/** Điểm cho một câu đúng khi đang có `combo` câu đúng liên tiếp. */
export function pointsFor(combo: number): number {
  return RUNTIME.basePoints * multiplier(combo);
}

/** Thời gian rơi theo đường tăng tốc cố định (dùng cho Thử thách 60 giây). */
export function fixedFallTime(correctCount: number): number {
  const steps = Math.floor(correctCount / RUNTIME.accelEvery);
  return Math.max(RUNTIME.minFall, RUNTIME.startFall * RUNTIME.accelFactor ** steps);
}
