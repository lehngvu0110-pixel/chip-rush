// Gộp chuột + cảm ứng + bút qua Pointer Events. Toạ độ trả về theo CSS px của canvas.
// `touch-action: none` (CSS) + pointer capture: vẽ dây sát mép không bị trình duyệt cuộn/zoom.

export type PointerPhase = 'down' | 'move' | 'up' | 'cancel';

export interface GamePointer {
  phase: PointerPhase;
  x: number;
  y: number;
  id: number;
  /** `event.timeStamp` (ms, cùng gốc với performance.now) — dùng đo độ trễ chạm */
  timeStamp: number;
}

export interface RectLike {
  left: number;
  top: number;
}

/** Đổi toạ độ màn hình sang toạ độ canvas (CSS px). */
export function toCanvasPoint(clientX: number, clientY: number, rect: RectLike): { x: number; y: number } {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Gắn xử lý pointer vào canvas. Trả về hàm gỡ. */
export function attachPointer(canvas: HTMLCanvasElement, onPointer: (p: GamePointer) => void): () => void {
  const emit = (phase: PointerPhase, e: PointerEvent): void => {
    const { x, y } = toCanvasPoint(e.clientX, e.clientY, canvas.getBoundingClientRect());
    onPointer({ phase, x, y, id: e.pointerId, timeStamp: e.timeStamp });
  };
  const down = (e: PointerEvent): void => {
    if (e.button > 0) return; // chỉ chuột trái / chạm
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* một số trình duyệt trong app ném lỗi ở đây; bỏ qua vẫn chơi được */
    }
    e.preventDefault();
    emit('down', e);
  };
  const move = (e: PointerEvent): void => emit('move', e);
  const up = (e: PointerEvent): void => emit('up', e);
  const cancel = (e: PointerEvent): void => emit('cancel', e);

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  // iOS: chặn menu kính lúp / chọn chữ khi nhấn giữ trên canvas
  const prevent = (e: Event): void => e.preventDefault();
  canvas.addEventListener('contextmenu', prevent);
  return () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointermove', move);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', cancel);
    canvas.removeEventListener('contextmenu', prevent);
  };
}
