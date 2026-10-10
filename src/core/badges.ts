// Huy hiệu (thành tựu) xuyên 3 chế độ. Điều kiện là hàm thuần trên dữ liệu lưu → test được, và
// huy hiệu tự "bắt kịp" cho người đã chơi từ trước (lần kiểm tra đầu tiên sẽ trao luôn những gì đã đạt).
import { DEBUG_LEVELS } from './level/debug-levels';
import { solvedDebug } from './level/debug-setup';
import { DESIGN_LEVELS } from './level/design-levels';
import { levelPar } from './level/validate';
import type { SaveData } from './progress';
import { costOf } from './scoring/design';

export interface BadgeDef {
  id: string;
  name: string;
  /** cách đạt (hiện cả khi chưa đạt, để người chơi biết mục tiêu) */
  desc: string;
  test: (s: SaveData) => boolean;
}

/** Màn THIẾT KẾ mà người chơi có chi phí THẤP HƠN par của AI kỹ sư. */
export function beatAiLevels(s: SaveData): string[] {
  return DESIGN_LEVELS.filter((lv) => {
    const best = s.design[lv.id]?.best;
    return best !== undefined && costOf(best.A, best.D, best.P) < levelPar(lv).C;
  }).map((lv) => lv.id);
}

const allStars = (rec: Record<string, { stars: number } | undefined>, ids: readonly string[]): boolean => ids.every((id) => (rec[id]?.stars ?? 0) >= 3);

export const BADGES: readonly BadgeDef[] = [
  { id: 'first-chip', name: 'Con chip đầu tiên', desc: 'Qua màn THIẾT KẾ đầu tiên.', test: (s) => s.design.d01 !== undefined },
  { id: 'full-adder', name: 'Trái tim của CPU', desc: 'Tự ráp bộ cộng đủ (d12).', test: (s) => s.design.d12 !== undefined },
  { id: 'beat-ai', name: 'Hơn cả AI', desc: 'Thiết kế một màn với chi phí thấp hơn AI kỹ sư.', test: (s) => beatAiLevels(s).length > 0 },
  { id: 'design-36', name: 'Kỹ sư 3 sao', desc: 'Đủ 3 sao ở mọi màn THIẾT KẾ.', test: (s) => allStars(s.design, DESIGN_LEVELS.map((l) => l.id)) },
  { id: 'first-bug', name: 'Bắt được con bọ', desc: 'Tìm ra lỗi ở màn KIỂM THỬ đầu tiên.', test: (s) => s.debug.t01 !== undefined },
  {
    id: 'vote-counter',
    name: 'Trưởng ban kiểm phiếu',
    desc: 'Qua "Bỏ phiếu" (t09) với số lần đo không quá AI kỹ sư.',
    test: (s) => {
      const r = s.debug.t09;
      const par = solvedDebug('t09')?.par;
      return r !== undefined && par !== undefined && r.probes <= par;
    },
  },
  { id: 'debug-all', name: 'Thám tử 3 sao', desc: 'Đủ 3 sao ở mọi màn KIỂM THỬ.', test: (s) => allStars(s.debug, DEBUG_LEVELS.map((l) => l.id)) },
  { id: 'runtime-500', name: 'Tay nhanh', desc: 'Đạt 500 điểm ở VẬN HÀNH – Vô tận.', test: (s) => s.runtime.bestEndless >= 500 },
  { id: 'runtime-2000', name: 'Ép xung', desc: 'Đạt 2000 điểm ở VẬN HÀNH – Vô tận.', test: (s) => s.runtime.bestEndless >= 2000 },
  { id: 'sixty-300', name: 'Nước rút', desc: 'Đạt 300 điểm ở Thử thách 60 giây.', test: (s) => s.runtime.best60 >= 300 },
  { id: 'streak-3', name: 'Ba ngày liền', desc: 'Giữ chuỗi Chip hôm nay 3 ngày.', test: (s) => s.daily.streak >= 3 },
  { id: 'streak-7', name: 'Một tuần không nghỉ', desc: 'Giữ chuỗi Chip hôm nay 7 ngày.', test: (s) => s.daily.streak >= 7 },
];

const BY_ID = new Map(BADGES.map((b) => [b.id, b]));
export const badgeById = (id: string): BadgeDef | undefined => BY_ID.get(id);

/**
 * Trao các huy hiệu vừa đạt (ghi ngày đạt vào `s.badges`) và trả về danh sách mới để báo.
 * Gọi lại nhiều lần an toàn: huy hiệu đã có thì không trao lại.
 */
export function awardBadges(s: SaveData, today: string): BadgeDef[] {
  const fresh: BadgeDef[] = [];
  for (const b of BADGES) {
    if (s.badges[b.id] !== undefined) continue;
    if (b.test(s)) {
      s.badges[b.id] = today;
      fresh.push(b);
    }
  }
  return fresh;
}

export function badgeCount(s: SaveData): number {
  return BADGES.filter((b) => s.badges[b.id] !== undefined).length;
}
