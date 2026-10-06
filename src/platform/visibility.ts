// Tạm dừng game khi người chơi rời đi: ẩn tab, khóa máy, chuyển app, xoay màn hình.
// Quan trọng cho VẬN HÀNH: không được để gói bit rơi khi người chơi không nhìn.

export type PauseReason = 'hidden' | 'blur' | 'orientation';

interface EventSource {
  addEventListener(type: string, cb: () => void): void;
  removeEventListener(type: string, cb: () => void): void;
}

export interface VisibilityOptions {
  doc: EventSource & { readonly visibilityState: string };
  win: EventSource;
  /** Gọi khi cần tạm dừng (scene pause + dừng vòng lặp nếu ẩn). */
  onPause: (reason: PauseReason) => void;
  /** Gọi khi trang hiện lại. Scene vẫn ở trạng thái pause cho tới khi người chơi bấm Tiếp tục. */
  onVisible: () => void;
}

/** Trả về hàm hủy đăng ký. */
export function watchVisibility(o: VisibilityOptions): () => void {
  const onVisibility = (): void => {
    if (o.doc.visibilityState === 'hidden') o.onPause('hidden');
    else o.onVisible();
  };
  const onBlur = (): void => o.onPause('blur');
  const onOrientation = (): void => o.onPause('orientation');

  o.doc.addEventListener('visibilitychange', onVisibility);
  o.win.addEventListener('blur', onBlur);
  o.win.addEventListener('orientationchange', onOrientation);
  return () => {
    o.doc.removeEventListener('visibilitychange', onVisibility);
    o.win.removeEventListener('blur', onBlur);
    o.win.removeEventListener('orientationchange', onOrientation);
  };
}
