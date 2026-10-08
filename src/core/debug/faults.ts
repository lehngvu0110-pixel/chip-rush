// Mô hình lỗi của chế độ KIỂM THỬ (SPEC mục 3) — thuần, chạy được trong Node.
//
// Người chơi THẤY MIỄN PHÍ: công tắc (đổi tuỳ ý) và đèn (đầu ra) ở mọi hàng → biết "chữ ký đầu ra" của chip hỏng.
// Người chơi PHẢI TỐN 1 LẦN ĐO: đọc 1 dây bên trong ở hàng đầu vào đang đặt.
// Vì vậy các lỗi "nghi ngờ" là mọi lỗi có CÙNG chữ ký đầu ra với lỗi thật; đo dây bên trong để phân biệt.
// Hai lỗi cùng LỚP TƯƠNG ĐƯƠNG khi mọi dây ở mọi hàng đều giống nhau → không phép đo nào phân biệt được,
// nên trả lời lỗi nào trong lớp cũng tính là đúng.
import { compileOrThrow, evaluateRow, type CompiledCircuit } from '../circuit/simulate';
import type { Fault, Netlist } from '../circuit/types';

export type FaultModel = 'gate-invert' | 'stuck-at';

export function enumerateFaults(c: CompiledCircuit, model: FaultModel): Fault[] {
  if (model === 'gate-invert') return c.ops.map((op) => ({ kind: 'gate-invert', gate: op.gate }));
  const out: Fault[] = [];
  for (const net of c.nets) for (const value of [0, 1] as const) out.push({ kind: 'stuck-at', net, value });
  return out;
}

function rows(c: CompiledCircuit): number {
  return 1 << c.inputIdx.length;
}

/** Giá trị đèn ở mọi hàng (chuỗi), có cài lỗi. */
export function outputSignature(c: CompiledCircuit, fault?: Fault): string {
  let s = '';
  for (let r = 0; r < rows(c); r++) {
    const v = evaluateRow(c, r, fault);
    for (const i of c.outputIdx) s += v[i];
  }
  return s;
}

/**
 * Giá trị các dây QUAN SÁT ĐƯỢC (mặc định: mọi dây) ở mọi hàng — hai lỗi cùng chuỗi này thì
 * không phép đo nào phân biệt được. Dây không có ô nào để chạm (cổng nối thẳng cổng) thì không đo được.
 */
export function fullSignature(c: CompiledCircuit, fault?: Fault, obs?: readonly number[]): string {
  const nets = obs ?? c.nets.map((_, i) => i);
  let s = '';
  for (let r = 0; r < rows(c); r++) {
    const v = evaluateRow(c, r, fault);
    for (const i of nets) s += v[i];
  }
  return s;
}

export function sameClass(c: CompiledCircuit, a: Fault, b: Fault, obs?: readonly number[]): boolean {
  return fullSignature(c, a, obs) === fullSignature(c, b, obs);
}

export interface FaultGroup {
  circuit: CompiledCircuit;
  /** các lớp lỗi nghi ngờ (cùng chữ ký đầu ra với lỗi thật), mỗi lớp = các lỗi tương đương */
  classes: Fault[][];
  /** chỉ số lớp chứa lỗi thật */
  trueClass: number;
}

/** Tên ngắn của lỗi (dùng làm khoá, log). */
export function faultKey(f: Fault): string {
  return f.kind === 'gate-invert' ? `inv:${f.gate}` : `sa${f.value}:${f.net}`;
}

/**
 * Nhóm lỗi nghi ngờ cho một lỗi thật. Ném lỗi nếu lỗi thật không gây triệu chứng ở đầu ra
 * (chip "hỏng mà không ai thấy" — không làm màn được).
 */
export function faultGroup(netlist: Netlist, model: FaultModel, trueFault: Fault, obs?: readonly number[]): FaultGroup {
  const c = compileOrThrow(netlist);
  const good = outputSignature(c);
  const sig = outputSignature(c, trueFault);
  if (sig === good) throw new Error(`Lỗi ${faultKey(trueFault)} không làm đổi đầu ra nào — không phát hiện được`);
  const byFull = new Map<string, Fault[]>();
  for (const f of enumerateFaults(c, model)) {
    if (outputSignature(c, f) !== sig) continue;
    const k = fullSignature(c, f, obs);
    const list = byFull.get(k);
    if (list) list.push(f);
    else byFull.set(k, [f]);
  }
  const classes = [...byFull.values()];
  const tk = fullSignature(c, trueFault, obs);
  const trueClass = classes.findIndex((cl) => cl[0] !== undefined && fullSignature(c, cl[0], obs) === tk);
  return { circuit: c, classes, trueClass };
}
