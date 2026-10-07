// Nền động cho màn bắt đầu: bo mạch neon với xung điện chạy dọc đường mạch.
// Chữ và nút nằm ở lớp DOM phía trên (dễ đọc, có trình đọc màn hình).
import type { RenderSurface } from '../../render/canvas';
import { PcbBackdrop } from '../../render/pcb';
import type { Scene } from '../../scene';

export class TitleScene implements Scene {
  private readonly pcb = new PcbBackdrop(2027, { pulses: 16, intensity: 1 });
  private surf: RenderSurface | null = null;

  // KHÔNG có pause(): màn bắt đầu không cần bảng "Đã tạm dừng" khi ẩn tab.
  update(dt: number): void {
    if (this.surf) this.pcb.update(dt, this.surf);
  }

  render(s: RenderSurface): void {
    this.surf = s;
    this.pcb.ensure(s);
    this.pcb.draw(s);
  }
}
