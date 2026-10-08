// Daily Chip: 28 đề sinh sẵn đều hợp lệ + có lời giải AI; lịch đề theo giờ Việt Nam; chuỗi ngày.
import { describe, expect, it } from 'vitest';
import { DAILY_LEVELS, DAILY_START, addDays, currentStreak, dailyFor, dailyIndex, recordDaily, shortDate, vnDateKey } from '../src/core/level/daily';
import { aiSolutionGrid, evaluateDesign, validateLevel } from '../src/core/level/validate';
import { DESIGN_LEVELS } from '../src/core/level/design-levels';
import { applyHint, designGuide } from '../src/core/tutorial';
import { gridFor } from '../src/core/level/validate';
import { defaultSave, loadSave } from '../src/core/progress';
import type { SafeStorage } from '../src/platform/storage';

describe('đề Daily Chip', () => {
  it('đủ 28 đề, id không trùng nhau và không trùng màn thường', () => {
    expect(DAILY_LEVELS).toHaveLength(28);
    const ids = DAILY_LEVELS.map((l) => l.id);
    expect(new Set(ids).size).toBe(28);
    for (const l of DESIGN_LEVELS) expect(ids).not.toContain(l.id);
  });

  it.each(DAILY_LEVELS.map((l) => [l.id, l] as const))('%s: dữ liệu hợp lệ, lời giải AI qua màn 3 sao', (_id, lv) => {
    expect(validateLevel(lv)).toEqual([]);
    const e = evaluateDesign(lv, aiSolutionGrid(lv)!);
    expect(e.status).toBe('pass');
    if (e.status === 'pass') {
      expect(e.stars).toBe(3);
      expect(e.score).toBe(1000);
    }
  });

  it.each(DAILY_LEVELS.map((l) => [l.id, l] as const))('%s: bấm Gợi ý liên tục từ lưới trống → qua màn', (_id, lv) => {
    const g = gridFor(lv);
    for (const h of designGuide(g, aiSolutionGrid(lv)!.state())) applyHint(g, h);
    expect(evaluateDesign(lv, g, true).status).toBe('pass');
  });

  it('không có 2 đề cùng bảng chân trị; không đề nào có đèn hằng số', () => {
    const keys = DAILY_LEVELS.map((l) => `${l.grid.inputs.length}:${JSON.stringify(l.table)}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const l of DAILY_LEVELS) for (const t of Object.values(l.table)) expect(t).toMatch(/0.*1|1.*0/);
  });
});

describe('lịch đề', () => {
  it('ngày đổi lúc 00:00 giờ Việt Nam (17:00 UTC hôm trước)', () => {
    expect(vnDateKey(new Date('2026-10-25T16:59:59Z'))).toBe('2026-10-25');
    expect(vnDateKey(new Date('2026-10-25T17:00:00Z'))).toBe('2026-10-26');
  });

  it('quay vòng 28 đề, kể cả trước ngày bắt đầu', () => {
    expect(dailyIndex(DAILY_START)).toBe(0);
    expect(dailyIndex(addDays(DAILY_START, 27))).toBe(27);
    expect(dailyIndex(addDays(DAILY_START, 28))).toBe(0);
    expect(dailyIndex(addDays(DAILY_START, -1))).toBe(27);
    expect(dailyFor(DAILY_START).id).toBe('daily-01');
  });

  it('cộng/trừ ngày qua tháng, năm', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(shortDate('2026-11-05')).toBe('05/11');
  });
});

describe('chuỗi ngày', () => {
  it('ngày liên tiếp +1; chơi lại cùng ngày không cộng; bỏ 1 ngày thì về 1', () => {
    const s = defaultSave();
    expect(recordDaily(s, '2026-10-26', 2, 800)).toMatchObject({ streak: 1, firstToday: true });
    expect(recordDaily(s, '2026-10-26', 3, 1000)).toMatchObject({ streak: 1, firstToday: false, improved: true });
    expect(s.daily.history['2026-10-26']).toEqual({ stars: 3, score: 1000 });
    expect(recordDaily(s, '2026-10-26', 1, 500)).toMatchObject({ improved: false });
    expect(s.daily.history['2026-10-26']).toEqual({ stars: 3, score: 1000 }); // giữ kết quả tốt nhất
    expect(recordDaily(s, '2026-10-27', 3, 1000).streak).toBe(2);
    expect(currentStreak(s, '2026-10-28')).toBe(2); // hôm nay chưa chơi nhưng chuỗi vẫn còn
    expect(currentStreak(s, '2026-10-29')).toBe(0); // bỏ lỡ 28/10
    expect(recordDaily(s, '2026-10-29', 3, 1000).streak).toBe(1);
  });

  it('lịch sử chỉ giữ 40 ngày gần nhất', () => {
    const s = defaultSave();
    for (let i = 0; i < 50; i++) recordDaily(s, addDays('2026-10-01', i), 3, 1000);
    expect(Object.keys(s.daily.history)).toHaveLength(40);
    expect(s.daily.streak).toBe(50);
    expect(s.daily.history['2026-10-01']).toBeUndefined();
  });

  it('dữ liệu lưu cũ (chưa có history) vẫn đọc được; history hỏng bị bỏ qua', () => {
    const mk = (raw: unknown): SafeStorage => ({ get: () => raw, set: () => true, remove: () => {}, onPersistenceLost: () => {} }) as unknown as SafeStorage;
    const old = loadSave(mk({ version: 1, daily: { lastDate: '2026-10-11', streak: 3 } }));
    expect(old.wasReset).toBe(false);
    expect(old.data.daily).toEqual({ lastDate: '2026-10-11', streak: 3, history: {} });
    const bad = loadSave(mk({ version: 1, daily: { history: { 'xyz': 1, '2026-10-11': { stars: 2, score: -5 } } } }));
    expect(bad.data.daily.history).toEqual({ '2026-10-11': { stars: 2, score: 0 } });
  });
});
