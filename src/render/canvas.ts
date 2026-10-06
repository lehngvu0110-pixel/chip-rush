// Canvas phủ toàn màn hình, nét theo devicePixelRatio nhưng KẸP tối đa 2:
// iPhone có DPR 3, vẽ ở 3x tốn ~2,25 lần điểm ảnh so với 2x mà mắt khó thấy khác,
// còn máy yếu (Redmi Note 8) thì tụt khung. Toạ độ vẽ luôn tính bằng CSS px.

export const MAX_DPR = 2;

export interface CanvasSize {
  /** kích thước bộ đệm thật (px thiết bị) */
  width: number;
  height: number;
  /** hệ số nhân từ CSS px sang px bộ đệm */
  scale: number;
}

export function computeCanvasSize(cssW: number, cssH: number, dpr: number, maxDpr: number = MAX_DPR): CanvasSize {
  const scale = Math.max(1, Math.min(maxDpr, dpr || 1));
  return { width: Math.max(1, Math.round(cssW * scale)), height: Math.max(1, Math.round(cssH * scale)), scale };
}

export type Quality = 'high' | 'low';

export interface RenderSurface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** kích thước vùng vẽ theo CSS px */
  width: number;
  height: number;
  /** 'low' = tắt glow/hạt để giữ khung hình trên máy yếu */
  quality: Quality;
  /** true khi người chơi bật giảm chuyển động */
  reducedMotion: boolean;
}

/** Tạo canvas, gắn vào `host`, tự cập nhật kích thước khi đổi cỡ/xoay màn hình. */
export function createSurface(host: HTMLElement): RenderSurface & { resize(): void } {
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  host.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D');

  const surface = {
    canvas,
    ctx,
    width: 0,
    height: 0,
    quality: 'high' as Quality,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    resize() {
      const rect = canvas.getBoundingClientRect();
      const s = computeCanvasSize(rect.width, rect.height, window.devicePixelRatio);
      if (canvas.width !== s.width || canvas.height !== s.height) {
        canvas.width = s.width;
        canvas.height = s.height;
      }
      surface.width = rect.width;
      surface.height = rect.height;
      // Vẽ theo CSS px; mọi lệnh vẽ tự nhân scale.
      ctx.setTransform(s.scale, 0, 0, s.scale, 0, 0);
    },
  };
  surface.resize();
  window.addEventListener('resize', () => surface.resize());
  window.visualViewport?.addEventListener('resize', () => surface.resize());
  return surface;
}
