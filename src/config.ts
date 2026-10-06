// Hằng số toàn cục. Tham số gameplay sẽ được thêm vào đây theo docs/SPEC.md (không rải số "ma thuật" trong code).
export const APP_VERSION: string = __APP_VERSION__;
export const BUILD_HASH: string = __BUILD_HASH__;

/** Chuỗi phiên bản hiện ở màn Cài đặt, ví dụ "v0.1.0 (a1b2c3d)". */
export function versionLabel(): string {
  return `v${APP_VERSION} (${BUILD_HASH})`;
}

/**
 * Tham số chế độ VẬN HÀNH — khớp docs/SPEC.md mục 1 và 5.3.
 * Đổi số ở đây thì PHẢI ghi vào "Lịch sử thay đổi tham số" trong SPEC.
 */
export const RUNTIME = {
  /** thời gian rơi ban đầu của một gói (giây) */
  startFall: 3.0,
  /** cứ mỗi `accelEvery` câu đúng thì thời gian rơi nhân `accelFactor` */
  accelEvery: 5,
  accelFactor: 0.96,
  minFall: 0.9,
  maxFall: 3.0,
  lives: 3,
  sixtyDuration: 60,
  wrongPenalty: 5,
  basePoints: 10,
  comboStep: 5,
  maxMultiplier: 4,
  /** điểm cần để mở khóa cổng */
  unlockAt: { XOR: 100, NAND: 250 } as const,
  /** tỉ lệ tối thiểu gói chỉ có đúng 1 cổng trả lời đúng */
  uniqueRatio: 0.6,
  adaptive: {
    window: 20,
    minSamples: 10,
    /** xét điều tốc sau mỗi N câu trả lời */
    checkEvery: 5,
    high: 0.85,
    low: 0.75,
    speedUp: 0.95,
    slowDown: 1.05,
    /** tỉ lệ gói chọn ngẫu nhiên đều (không theo điểm yếu) */
    explore: 0.3,
  },
} as const;
