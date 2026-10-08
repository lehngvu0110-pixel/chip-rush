// Định dạng màn THIẾT KẾ (docs/ARCHITECTURE.md "Dữ liệu màn chơi").
// Dữ liệu màn được import vào bundle (có hash) nên không bao giờ lệch phiên bản với code (ADR-0005).
import type { GridSpec, Side } from '../circuit/grid';
import type { GateType } from '../circuit/types';

type CR = [number, number];

/** Lời giải tham chiếu, viết theo đường đi cho dễ đọc. */
export interface LevelSolution {
  /** [lớp, dãy ô liên tiếp] — mỗi cặp ô kề nhau là một đoạn dây */
  wires?: [number, CR[]][];
  /** [cột, hàng, loại cổng, phía chân ra (mặc định Đông)] */
  gates?: [number, number, GateType, Side?][];
  vias?: CR[];
}

export interface DesignLevel {
  id: string;
  name: string;
  /** khái niệm mới của màn (hiện ở danh sách màn) */
  concept: string;
  /** 1–2 câu hướng dẫn hiện khi vào màn */
  intro: string;
  grid: GridSpec;
  /** số cổng tối đa mỗi loại được dùng */
  gatesAllowed: Partial<Record<GateType, number>>;
  /**
   * Bảng chân trị mong muốn: id đèn → chuỗi bit theo thứ tự hàng nhị phân tăng dần,
   * đầu vào đầu tiên là bit cao nhất (A B = 00, 01, 10, 11). Ví dụ AND: "0001".
   */
  table: Record<string, string>;
  /**
   * Lời giải tham chiếu. Par = PPA của lời giải này nên 3 sao LUÔN đạt được.
   * Hiện viết tay (parSource "reference"); solver AI kỹ sư (SPEC 5.1) sẽ thay bằng lời giải tốt nhất nó tìm được.
   */
  solution: LevelSolution;
}
