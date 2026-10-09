// Câu hiển thị về "AI kỹ sư" (SPEC 5.4) + số liệu minh bạch cho trang "AI kỹ sư hoạt động thế nào?".
// Nguyên tắc (SPEC 5): chỉ nói "tối ưu" khi thuật toán đã duyệt hết không gian và chứng minh được.
import { DAILY_LEVELS } from './daily';
import { DEBUG_LEVELS } from './debug-levels';
import { solvedDebug } from './debug-setup';
import { DESIGN_LEVELS } from './design-levels';
import type { DesignLevel } from './types';
import { levelPar, solvedLevel } from './validate';

export interface DesignClaim {
  proven: boolean;
  C: number;
  /** câu đầy đủ (thẻ kết quả) */
  text: string;
  /** câu ngắn (dòng PPA trên màn chơi) */
  short: string;
}

/**
 * "Đã chứng minh" chỉ đúng cho MẠCH LOGIC của AI (Area nhỏ nhất khi đặt + đi dây đúng các cổng đó).
 * Người chơi ghép cổng theo cách khác vẫn có thể có chi phí thấp hơn → câu phải nói rõ phạm vi.
 */
export function designClaim(level: DesignLevel): DesignClaim {
  const C = levelPar(level).C;
  const proven = solvedLevel(level.id)?.proven === true;
  return proven
    ? { proven, C, text: `AI kỹ sư đã chứng minh: với cách ghép cổng này, không thể tốt hơn C = ${C}.`, short: `AI kỹ sư: C = ${C} (đã chứng minh tối ưu)` }
    : { proven, C, text: `Par của AI kỹ sư: C = ${C} (bạn có thể vượt!)`, short: `AI kỹ sư: C = ${C} (bạn có thể vượt!)` };
}

export function debugClaim(id: string): { optimal: boolean; par: number; text: string } | null {
  const s = solvedDebug(id);
  if (!s) return null;
  return s.optimal
    ? { optimal: true, par: s.par, text: s.par === 0 ? 'AI kỹ sư không cần đo lần nào: nhìn đèn là đủ biết lỗi.' : `AI luôn tìm ra lỗi trong tối đa ${s.par} lần đo, dù lỗi ở đâu.` }
    : { optimal: false, par: s.par, text: `AI kỹ sư cần ${s.par} lần đo (cách tham lam, chưa chứng minh là ít nhất).` };
}

export interface AiStats {
  designProven: number;
  designTotal: number;
  dailyProven: number;
  dailyTotal: number;
  debugOptimal: number;
  debugTotal: number;
}

export function aiStats(): AiStats {
  const proven = (ls: readonly DesignLevel[]): number => ls.filter((l) => solvedLevel(l.id)?.proven === true).length;
  return {
    designProven: proven(DESIGN_LEVELS),
    designTotal: DESIGN_LEVELS.length,
    dailyProven: proven(DAILY_LEVELS),
    dailyTotal: DAILY_LEVELS.length,
    debugOptimal: DEBUG_LEVELS.filter((l) => solvedDebug(l.id)?.optimal === true).length,
    debugTotal: DEBUG_LEVELS.length,
  };
}
