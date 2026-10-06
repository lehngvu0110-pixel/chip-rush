import type { RenderSurface } from './render/canvas';
import type { GamePointer } from './input/pointer';

/** Một màn hình/chế độ chơi. Hub, VẬN HÀNH, THIẾT KẾ, KIỂM THỬ đều cài đặt interface này. */
export interface Scene {
  enter?(surface: RenderSurface): void;
  /** dt: giây thực, đã kẹp tối đa MAX_DT. */
  update(dt: number): void;
  render(surface: RenderSurface): void;
  /** Bị gọi khi ẩn tab / blur / xoay màn hình. Scene tự giữ trạng thái pause tới khi resume(). */
  pause?(): void;
  resume?(): void;
  onPointer?(p: GamePointer): void;
  exit?(): void;
}
