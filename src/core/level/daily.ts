// Daily Chip (SPEC mục 4): mỗi ngày (giờ Việt Nam) một màn THIẾT KẾ, 28 đề quay vòng.
// Đề + lời giải AI sinh offline bằng tools/gen-daily.ts → daily.json (đóng vào build, không cần máy chủ).
import dailyJson from './daily.json';
import type { SaveData } from '../progress';
import type { DesignLevel, SolvedLevel } from './types';
import { registerSolved } from './validate';

/** Ngày đề số 1 (ngày mở cổng nộp bài). Trước ngày này các đề vẫn quay vòng bình thường. */
export const DAILY_START = '2026-10-26';
/** Giữ lịch sử kết quả tối đa bấy nhiêu ngày gần nhất (đủ cho 1 vòng đề). */
const HISTORY_MAX = 40;

type DailyEntry = DesignLevel & { solved: SolvedLevel };
const ENTRIES = dailyJson as unknown as DailyEntry[];
export const DAILY_LEVELS: readonly DesignLevel[] = ENTRIES.map(({ solved, ...lv }) => {
  registerSolved(lv.id, solved);
  return lv;
});

/** Ngày theo giờ Việt Nam (UTC+7) dạng YYYY-MM-DD, bất kể múi giờ máy. */
export function vnDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Số ngày kể từ 1970-01-01 của một khoá ngày (tính theo UTC nên không lệch giờ mùa hè). */
export function dayNumber(key: string): number {
  return Math.round(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

export function addDays(key: string, d: number): string {
  return new Date((dayNumber(key) + d) * 86_400_000).toISOString().slice(0, 10);
}

/** Chỉ số đề của một ngày: quay vòng 28 đề, ngày DAILY_START là đề 0. */
export function dailyIndex(key: string, n = DAILY_LEVELS.length): number {
  return (((dayNumber(key) - dayNumber(DAILY_START)) % n) + n) % n;
}

export function dailyFor(key: string): DesignLevel {
  return DAILY_LEVELS[dailyIndex(key)] as DesignLevel;
}

/** "26/10" — hiện trên nút và thẻ chia sẻ. */
export function shortDate(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

/**
 * Chuỗi ngày đang có: còn tính nếu lần cuối là hôm nay hoặc hôm qua; bỏ lỡ 1 ngày thì về 0.
 */
export function currentStreak(save: SaveData, today: string): number {
  const last = save.daily.lastDate;
  if (!last) return 0;
  return last === today || last === addDays(today, -1) ? save.daily.streak : 0;
}

/**
 * Ghi kết quả qua đề ngày `today`. Lần đầu qua trong ngày mới cộng chuỗi; chơi lại chỉ giữ kết quả tốt nhất.
 * Trả về { streak, firstToday, improved }.
 */
export function recordDaily(save: SaveData, today: string, stars: number, score: number): { streak: number; firstToday: boolean; improved: boolean } {
  const d = save.daily;
  const firstToday = d.lastDate !== today;
  if (firstToday) {
    d.streak = d.lastDate === addDays(today, -1) ? d.streak + 1 : 1;
    d.lastDate = today;
  }
  const prev = d.history[today];
  const improved = !prev || score > prev.score || stars > prev.stars;
  d.history[today] = { stars: Math.max(stars, prev?.stars ?? 0), score: Math.max(score, prev?.score ?? 0) };
  const keys = Object.keys(d.history).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - HISTORY_MAX))) delete d.history[k];
  return { streak: d.streak, firstToday, improved };
}
