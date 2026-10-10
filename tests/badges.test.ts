// Huy hiệu: điều kiện đúng với dữ liệu lưu, trao đúng 1 lần, đọc/ghi lưu trữ an toàn.
import { describe, expect, it } from 'vitest';
import { BADGES, awardBadges, badgeCount, beatAiLevels } from '../src/core/badges';
import { DEBUG_LEVELS } from '../src/core/level/debug-levels';
import { solvedDebug } from '../src/core/level/debug-setup';
import { DESIGN_LEVELS } from '../src/core/level/design-levels';
import { levelPar } from '../src/core/level/validate';
import { defaultSave, loadSave } from '../src/core/progress';
import type { SafeStorage } from '../src/platform/storage';

const ids = (xs: { id: string }[]): string[] => xs.map((x) => x.id);

describe('huy hiệu', () => {
  it('id không trùng, đủ 12 huy hiệu, dữ liệu trống thì chưa có cái nào', () => {
    expect(new Set(ids([...BADGES])).size).toBe(BADGES.length);
    expect(BADGES.length).toBe(12);
    expect(awardBadges(defaultSave(), '2026-10-17')).toEqual([]);
  });

  it('trao đúng 1 lần và ghi ngày đạt', () => {
    const s = defaultSave();
    s.design.d01 = { stars: 3, best: { A: 4, D: 0, P: 1 }, hinted: false };
    expect(ids(awardBadges(s, '2026-10-17'))).toEqual(['first-chip']);
    expect(s.badges['first-chip']).toBe('2026-10-17');
    expect(awardBadges(s, '2026-10-18')).toEqual([]);
    expect(s.badges['first-chip']).toBe('2026-10-17');
    expect(badgeCount(s)).toBe(1);
  });

  it('"Hơn cả AI": chỉ khi chi phí THẤP HƠN par (bằng par thì chưa)', () => {
    const s = defaultSave();
    const lv = DESIGN_LEVELS.find((l) => l.id === 'd09')!;
    const par = levelPar(lv);
    s.design.d09 = { stars: 3, best: { A: par.A, D: par.D, P: par.P }, hinted: false };
    expect(beatAiLevels(s)).toEqual([]);
    s.design.d09 = { stars: 3, best: { A: par.A - 1, D: par.D, P: par.P }, hinted: false };
    expect(beatAiLevels(s)).toEqual(['d09']);
    expect(ids(awardBadges(s, '2026-10-17'))).toContain('beat-ai');
  });

  it('3 sao mọi màn: thiếu 1 màn là chưa', () => {
    const s = defaultSave();
    for (const l of DEBUG_LEVELS) s.debug[l.id] = { stars: 3, probes: 0 };
    s.debug.t05 = { stars: 2, probes: 5 };
    expect(ids(awardBadges(s, '2026-10-17'))).not.toContain('debug-all');
    s.debug.t05 = { stars: 3, probes: 3 };
    expect(ids(awardBadges(s, '2026-10-17'))).toContain('debug-all');
  });

  it('t09: số lần đo phải ≤ par của AI', () => {
    const par = solvedDebug('t09')!.par;
    const s = defaultSave();
    s.debug.t09 = { stars: 2, probes: par + 1 };
    expect(ids(awardBadges(s, '2026-10-17'))).not.toContain('vote-counter');
    s.debug.t09 = { stars: 3, probes: par };
    expect(ids(awardBadges(s, '2026-10-17'))).toContain('vote-counter');
  });

  it('ngưỡng VẬN HÀNH và chuỗi ngày', () => {
    const s = defaultSave();
    s.runtime = { bestEndless: 499, best60: 299 };
    s.daily.streak = 2;
    expect(awardBadges(s, '2026-10-17')).toEqual([]);
    s.runtime = { bestEndless: 2000, best60: 300 };
    s.daily.streak = 7;
    expect(ids(awardBadges(s, '2026-10-17')).sort()).toEqual(['runtime-2000', 'runtime-500', 'sixty-300', 'streak-3', 'streak-7']);
  });

  it('đọc dữ liệu lưu: giữ huy hiệu hợp lệ, bỏ khoá/ngày rác; dữ liệu cũ chưa có badges vẫn đọc được', () => {
    const mk = (raw: unknown): SafeStorage => ({ get: () => raw, set: () => true, remove: () => {}, onPersistenceLost: () => {} }) as unknown as SafeStorage;
    expect(loadSave(mk({ version: 1 })).data.badges).toEqual({});
    const r = loadSave(mk({ version: 1, badges: { 'first-chip': '2026-10-17', 'XSS<script>': '2026-10-17', 'beat-ai': 'hôm qua' } }));
    expect(r.data.badges).toEqual({ 'first-chip': '2026-10-17' });
  });
});
