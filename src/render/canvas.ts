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

/**
 * 'high' = đủ hiệu ứng; 'low' = tắt glow/hạt + ẩn nền bo mạch; 'min' = như low + vẽ ở độ phân giải thấp hơn
 * (đo 18/10: thời gian frame tỉ lệ gần thuận với số điểm ảnh khi máy vẽ bằng CPU).
 */
export type Quality = 'high' | 'low' | 'min';

/** DPR tối đa khi chất lượng 'min'. */
export const MIN_QUALITY_DPR = 1.25;

export interface RenderSurface {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  /** kích thước vùng vẽ theo CSS px */
  width: number;
  height: number;
  /** 'low'/'min' = tắt glow/hạt để giữ khung hình trên máy yếu (xem Quality) */
  quality: Quality;
  /** DPR tối đa của canvas chính (hạ xuống khi quality = 'min'; đổi xong gọi resize()) */
  dprCap: number;
  /** true khi người chơi bật giảm chuyển động */
  reducedMotion: boolean;
  /**
   * Canvas NỀN nằm dưới canvas chính, chỉ vẽ lại khi cần (ví dụ đổi cỡ màn hình).
   * Nhờ vậy mỗi frame không phải chép lại cả nền (tiết kiệm băng thông điểm ảnh trên máy yếu);
   * trình duyệt tự ghép 2 lớp bằng GPU.
   */
  readonly backdrop: HTMLCanvasElement;
  /** ai đang vẽ nền (để scene mới biết phải vẽ lại) */
  backdropOwner: unknown;
}

/** Tạo canvas, gắn vào `host`, tự cập nhật kích thước khi đổi cỡ/xoay màn hình. */
export function createSurface(host: HTMLElement): RenderSurface & { resize(): void } {
  const backdrop = document.createElement('canvas');
  backdrop.className = 'game-canvas backdrop-canvas';
  backdrop.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  // Nội dung vẽ trên canvas không đọc được bằng trình đọc màn hình; mọi thao tác chính đều có nút DOM tương ứng
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Bàn chơi CHIP RUSH');
  host.prepend(backdrop, canvas);
  // alpha: true vì canvas chính trong suốt để thấy lớp nền bên dưới
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ Canvas 2D');

  const surface = {
    canvas,
    ctx,
    backdrop,
    backdropOwner: null as unknown,
    width: 0,
    height: 0,
    quality: 'high' as Quality,
    dprCap: MAX_DPR,
    reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    resize() {
      const rect = canvas.getBoundingClientRect();
      const s = computeCanvasSize(rect.width, rect.height, window.devicePixelRatio, surface.dprCap);
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
