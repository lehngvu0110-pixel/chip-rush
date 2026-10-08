// Định dạng màn THIẾT KẾ (docs/ARCHITECTURE.md "Dữ liệu màn chơi").
// Dữ liệu màn được import vào bundle (có hash) nên không bao giờ lệch phiên bản với code (ADR-0005).
import type { GridSpec, Side } from '../circuit/grid';
import type { Fault, GateType, Netlist } from '../circuit/types';
import type { FaultModel } from '../debug/faults';

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
   * Lời giải mẫu viết tay (tuỳ chọn). Solver đọc mạch logic từ đây; par không bao giờ tệ hơn lời giải này.
   */
  solution?: LevelSolution;
  /**
   * Mạch logic (netlist) khi KHÔNG có lời giải mẫu: solver tự đặt cổng + đi dây.
   * `inputs`/`outputs` theo đúng thứ tự chân của lưới.
   */
  logic?: Netlist;
}

/** Kết quả solver ghi sẵn (tools/solve-levels.ts → solutions.json, ADR-0005). */
export interface SolvedLevel {
  par: { A: number; D: number; P: number; C: number };
  state: import('../circuit/grid').GridState;
  /** "solver" = AI kỹ sư tìm; "reference" = lời giải mẫu tốt hơn/bằng solver */
  source: 'solver' | 'reference';
  /** đã CHỨNG MINH Area nhỏ nhất với mạch logic này (duyệt hết cách đặt + chạm cận dưới) */
  proven: boolean;
  lowerBound: number | null;
}

/** Màn KIỂM THỬ (SPEC mục 3): mạch có sẵn + đúng 1 lỗi ẩn. */
export interface DebugLevel {
  id: string;
  name: string;
  concept: string;
  intro: string;
  /** lưới để AI kỹ sư bố trí mạch (bố trí tính offline, lưu trong debug-solutions.json) */
  grid: import('../circuit/grid').GridSpec;
  logic: Netlist;
  model: FaultModel;
  /** lỗi thật, viết theo tên cổng/net của `logic` */
  fault: Fault;
}

/** Kết quả tính offline cho màn KIỂM THỬ. */
export interface SolvedDebugLevel {
  state: import('../circuit/grid').GridState;
  /** số lần đo ít nhất trong trường hợp xấu nhất */
  par: number;
  optimal: boolean;
  classes: number;
}
