// Bộ sinh số ngẫu nhiên có seed (mulberry32): cùng seed → cùng chuỗi.
// Cần cho Thử thách 60 giây (mọi người cùng ngày chơi cùng chuỗi gói) và để test tái lập được.

export type Rng = () => number; // [0, 1)

export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Số nguyên trong [0, n). */
export function randInt(rng: Rng, n: number): number {
  return Math.floor(rng() * n);
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: mảng rỗng');
  return items[randInt(rng, items.length)] as T;
}

/**
 * Seed theo ngày giờ Việt Nam (UTC+7), dạng số YYYYMMDD.
 * Đổi seed lúc 00:00 giờ Việt Nam, bất kể múi giờ máy người chơi.
 */
export function vnDateSeed(now: Date = new Date()): number {
  const vn = new Date(now.getTime() + 7 * 3600_000);
  return vn.getUTCFullYear() * 10000 + (vn.getUTCMonth() + 1) * 100 + vn.getUTCDate();
}
