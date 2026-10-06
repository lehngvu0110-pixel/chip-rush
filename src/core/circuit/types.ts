// Kiểu dữ liệu mạch ở mức netlist (đồ thị cổng–dây), độc lập với lưới vẽ.
// Lưới 2 lớp (grid.ts, làm sau) sẽ được chuyển thành Netlist rồi mới mô phỏng.

/** Một bit logic. Dùng 0/1 thay vì boolean để khớp bảng chân trị và dễ cộng/đếm. */
export type Bit = 0 | 1;

/** Các loại cổng game hỗ trợ. NOR/XNOR chưa dùng ở màn nào nhưng có sẵn cho Daily Chip. */
export type GateType = 'NOT' | 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'XNOR';

/** Một cổng cụ thể trong mạch: đọc các net `inputs`, ghi ra net `output`. */
export interface GateInstance {
  id: string;
  type: GateType;
  inputs: string[];
  output: string;
}

/**
 * Mạch dạng netlist. Net được định danh bằng chuỗi.
 * - `inputs`: net do công tắc đầu vào điều khiển, theo đúng thứ tự cột bảng chân trị.
 * - `outputs`: net được quan sát (LED), theo thứ tự cột đầu ra.
 * Mỗi net phải có đúng 1 nguồn điều khiển (1 đầu vào hoặc 1 đầu ra cổng).
 */
export interface Netlist {
  inputs: string[];
  outputs: string[];
  gates: GateInstance[];
}

/** Lỗi cấu trúc mạch, phát hiện trước khi mô phỏng. */
export type CircuitError =
  | { kind: 'multiple-drivers'; net: string; drivers: string[] } // đoản mạch: 2 nguồn cùng lái 1 net
  | { kind: 'undriven-net'; net: string; readers: string[] } // dây hở: net được đọc nhưng không ai lái
  | { kind: 'combinational-loop'; gates: string[] } // vòng lặp tổ hợp
  | { kind: 'arity'; gate: string; expected: number; actual: number } // sai số chân vào
  | { kind: 'duplicate-gate-id'; gate: string }
  | { kind: 'too-many-inputs'; count: number; max: number };

/**
 * Lỗi phần cứng cài vào mạch ở chế độ KIỂM THỬ (xem SPEC mục 3).
 * - `gate-invert`: cổng cho đầu ra đảo ngược.
 * - `stuck-at`: net luôn mang giá trị cố định bất kể nguồn lái.
 */
export type Fault =
  | { kind: 'gate-invert'; gate: string }
  | { kind: 'stuck-at'; net: string; value: Bit };

/** Một hàng bảng chân trị. */
export interface TruthRow {
  inputs: Bit[];
  outputs: Bit[];
}
