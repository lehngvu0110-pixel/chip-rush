// Dữ liệu lưu của người chơi (docs/SPEC.md mục 4), khóa `chiprush.v1` trong localStorage.
// Mọi đọc/ghi đi qua SafeStorage nên không bao giờ làm crash game.
import type { SafeStorage } from '../platform/storage';

export const SAVE_KEY = 'chiprush.v1';
export const SAVE_VERSION = 1;

export interface SaveData {
  version: 1;
  design: Record<string, { stars: number; best: { A: number; D: number; P: number }; hinted: boolean }>;
  debug: Record<string, { stars: number; probes: number }>;
  runtime: { bestEndless: number; best60: number };
  daily: { lastDate: string | null; streak: number };
  settings: { muted: boolean; reducedMotion: boolean };
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    design: {},
    debug: {},
    runtime: { bestEndless: 0, best60: 0 },
    daily: { lastDate: null, streak: 0 },
    settings: { muted: false, reducedMotion: false },
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

export interface LoadResult {
  data: SaveData;
  /** true nếu dữ liệu cũ không đọc được và đã phải đặt lại → UI báo cho người chơi */
  wasReset: boolean;
}

/**
 * Đọc dữ liệu lưu, lấp giá trị mặc định cho trường thiếu/sai kiểu.
 * Sai `version` (tương lai có v2) → hiện tại chưa có chuyển đổi nào nên đặt lại và báo.
 */
export function loadSave(storage: SafeStorage): LoadResult {
  const raw = storage.get<unknown>(SAVE_KEY, null);
  const d = defaultSave();
  if (raw === null) return { data: d, wasReset: false };
  if (!isObj(raw) || (raw.version !== undefined && raw.version !== SAVE_VERSION)) return { data: d, wasReset: true };

  const rt = isObj(raw.runtime) ? raw.runtime : {};
  const st = isObj(raw.settings) ? raw.settings : {};
  const dl = isObj(raw.daily) ? raw.daily : {};
  d.runtime = { bestEndless: num(rt.bestEndless, 0), best60: num(rt.best60, 0) };
  d.settings = { muted: bool(st.muted, false), reducedMotion: bool(st.reducedMotion, false) };
  d.daily = { lastDate: typeof dl.lastDate === 'string' ? dl.lastDate : null, streak: num(dl.streak, 0) };
  if (isObj(raw.design)) d.design = raw.design as SaveData['design'];
  if (isObj(raw.debug)) d.debug = raw.debug as SaveData['debug'];
  return { data: d, wasReset: false };
}

export function writeSave(storage: SafeStorage, data: SaveData): boolean {
  return storage.set(SAVE_KEY, data);
}

/** Ghi điểm VẬN HÀNH; trả về true nếu là kỷ lục mới. */
export function recordRuntimeScore(data: SaveData, mode: 'endless' | 'sixty', score: number): boolean {
  const key = mode === 'endless' ? 'bestEndless' : 'best60';
  if (score > data.runtime[key]) {
    data.runtime[key] = score;
    return true;
  }
  return false;
}
