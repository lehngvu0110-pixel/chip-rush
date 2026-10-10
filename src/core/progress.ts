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
  /** Daily Chip: ngày qua đề gần nhất (giờ VN), chuỗi ngày liên tiếp, kết quả tốt nhất từng ngày */
  daily: { lastDate: string | null; streak: number; history: Record<string, { stars: number; score: number }> };
  settings: { muted: boolean; reducedMotion: boolean };
  /** huy hiệu đã đạt: id → ngày đạt (giờ VN, YYYY-MM-DD) — thêm 17/10 */
  badges: Record<string, string>;
}

export function defaultSave(): SaveData {
  return {
    version: 1,
    design: {},
    debug: {},
    runtime: { bestEndless: 0, best60: 0 },
    daily: { lastDate: null, streak: 0, history: {} },
    settings: { muted: false, reducedMotion: false },
    badges: {},
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);
const stars = (v: unknown): number => Math.min(3, Math.floor(num(v, 0)));

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
  const hist: SaveData['daily']['history'] = {};
  if (isObj(dl.history)) {
    for (const [k, v] of Object.entries(dl.history)) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(k) && isObj(v)) hist[k] = { stars: num(v.stars, 0), score: num(v.score, 0) };
    }
  }
  d.daily = { lastDate: typeof dl.lastDate === 'string' ? dl.lastDate : null, streak: num(dl.streak, 0), history: hist };
  if (isObj(raw.badges)) {
    for (const [k, v] of Object.entries(raw.badges)) if (/^[a-z0-9-]{1,32}$/.test(k) && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) d.badges[k] = v;
  }
  // Từng màn được kiểm tra riêng: một mục hỏng (sửa tay, lỗi ghi dở) chỉ mất mục đó, không làm hỏng cả game
  // (lỗi thật tìm được bằng e2e/robustness.spec.ts ngày 19/10: qua màn đè lên mục hỏng làm văng lỗi).
  if (isObj(raw.design)) {
    for (const [id, v] of Object.entries(raw.design)) {
      if (!isObj(v) || !isObj(v.best)) continue;
      const b = v.best;
      d.design[id] = { stars: stars(v.stars), best: { A: num(b.A, 0), D: num(b.D, 0), P: num(b.P, 0) }, hinted: bool(v.hinted, false) };
    }
  }
  if (isObj(raw.debug)) {
    for (const [id, v] of Object.entries(raw.debug)) {
      if (!isObj(v)) continue;
      d.debug[id] = { stars: stars(v.stars), probes: num(v.probes, 0) };
    }
  }
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

/** Ghi kết quả qua màn THIẾT KẾ; giữ số sao cao nhất và PPA có chi phí thấp nhất. Trả về true nếu tốt hơn trước. */
export function recordDesign(
  data: SaveData,
  id: string,
  ppa: { A: number; D: number; P: number; C: number },
  stars: number,
  hinted = false,
): boolean {
  const prev = data.design[id];
  const prevC = prev ? prev.best.A + 3 * prev.best.D + prev.best.P : Infinity;
  const better = !prev || ppa.C < prevC || stars > prev.stars;
  data.design[id] = {
    stars: Math.max(stars, prev?.stars ?? 0),
    best: ppa.C < prevC ? { A: ppa.A, D: ppa.D, P: ppa.P } : (prev?.best ?? { A: ppa.A, D: ppa.D, P: ppa.P }),
    hinted: (prev?.hinted ?? false) || hinted,
  };
  return better;
}

/** Màn thứ i mở khi i = 0 hoặc màn trước đã qua. */
export function designUnlocked(data: SaveData, ids: readonly string[], i: number): boolean {
  return i === 0 || (ids[i - 1] !== undefined && data.design[ids[i - 1] as string] !== undefined);
}

/** Ghi kết quả qua màn KIỂM THỬ: giữ số sao cao nhất và số lần đo ít nhất. Trả về true nếu tốt hơn trước. */
export function recordDebug(data: SaveData, id: string, stars: number, probes: number): boolean {
  const prev = data.debug[id];
  const better = !prev || stars > prev.stars || probes < prev.probes;
  data.debug[id] = { stars: Math.max(stars, prev?.stars ?? 0), probes: Math.min(probes, prev?.probes ?? Infinity) };
  return better;
}

/** KIỂM THỬ mở sau khi qua màn THIẾT KẾ `gate` (SPEC 4: d05); màn t sau mở khi qua màn trước. */
export function debugUnlocked(data: SaveData, ids: readonly string[], i: number, gate = 'd05'): boolean {
  if (data.design[gate] === undefined) return false;
  return i === 0 || (ids[i - 1] !== undefined && data.debug[ids[i - 1] as string] !== undefined);
}
