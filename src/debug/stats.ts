// Thống kê hiệu năng thuần (không DOM) — dùng cho overlay ?debug=1 và cho việc tự giảm chất lượng.
import type { Quality } from '../render/canvas';

/** Phân vị theo "nearest-rank": phần tử thứ ceil(p·n) của mảng đã sắp xếp. p trong (0, 1]. */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const rank = Math.ceil(p * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] as number;
}

export interface StatsSummary {
  frames: number;
  medianMs: number;
  p95Ms: number;
  /** khung hình/giây trung bình */
  fps: number;
  latencySamples: number;
  latencyP95Ms: number | null;
}

/** Bộ đệm vòng giữ N frame gần nhất (mặc định 7200 ≈ 60 s ở 120 Hz). */
export class FrameStats {
  private frames: number[] = [];
  private latencies: number[] = [];

  constructor(private readonly capacity = 7200) {}

  addFrame(ms: number): void {
    this.frames.push(ms);
    if (this.frames.length > this.capacity) this.frames.shift();
  }

  addLatency(ms: number): void {
    if (ms < 0 || !Number.isFinite(ms)) return;
    this.latencies.push(ms);
    if (this.latencies.length > 1000) this.latencies.shift();
  }

  /** `last`: chỉ xét N frame gần nhất (ví dụ cửa sổ 120 frame cho bộ giảm chất lượng). */
  summary(last?: number): StatsSummary {
    const fr = last ? this.frames.slice(-last) : this.frames;
    const sorted = [...fr].sort((a, b) => a - b);
    const total = fr.reduce((a, b) => a + b, 0);
    const lat = [...this.latencies].sort((a, b) => a - b);
    return {
      frames: fr.length,
      medianMs: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      fps: total > 0 ? (fr.length * 1000) / total : 0,
      latencySamples: lat.length,
      latencyP95Ms: lat.length ? percentile(lat, 0.95) : null,
    };
  }

  reset(): void {
    this.frames = [];
    this.latencies = [];
  }
}

/** Ngưỡng p95 (ms) mà vượt quá thì tắt glow. 33,4 ms ≈ dưới 30 khung hình/giây. */
export const LOW_QUALITY_P95_MS = 33.4;
/** Số frame tối thiểu trước khi được phép kết luận (tránh phản ứng với giật lúc vừa tải). */
export const QUALITY_WINDOW = 120;

/**
 * Chỉ HẠ chất lượng, không tự nâng lại: tránh bật/tắt glow liên tục (nhấp nháy, khó chịu hơn giật).
 */
export function decideQuality(current: Quality, recent: StatsSummary): Quality {
  if (current === 'low') return 'low';
  if (recent.frames < QUALITY_WINDOW) return current;
  return recent.p95Ms > LOW_QUALITY_P95_MS ? 'low' : 'high';
}
