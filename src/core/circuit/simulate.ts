import { GATE_ARITY, evalGate } from './gates';
import type { Bit, CircuitError, Fault, GateType, Netlist, TruthRow } from './types';

/**
 * Số đầu vào tối đa. Bảng chân trị có 2^n hàng; màn chơi thật ≤ 3 đầu vào (full adder),
 * giới hạn 12 (4096 hàng) để solver/tools không vô tình chạy bùng nổ.
 */
export const MAX_INPUTS = 12;

/** Một cổng đã "biên dịch": chân vào/ra là chỉ số net thay vì chuỗi, để mô phỏng nhanh. */
export interface CompiledOp {
  readonly gate: string;
  readonly type: GateType;
  readonly ins: readonly number[];
  readonly out: number;
}

/** Mạch đã kiểm tra hợp lệ và sắp thứ tự topo, sẵn sàng mô phỏng nhiều lần. */
export interface CompiledCircuit {
  readonly netlist: Netlist;
  /** chỉ số → tên net */
  readonly nets: readonly string[];
  readonly netIndex: ReadonlyMap<string, number>;
  readonly inputIdx: readonly number[];
  readonly outputIdx: readonly number[];
  /** Cổng theo thứ tự topo: mỗi cổng chỉ đọc net đã được tính trước đó. */
  readonly ops: readonly CompiledOp[];
}

export type CompileResult =
  | { ok: true; circuit: CompiledCircuit }
  | { ok: false; errors: CircuitError[] };

/**
 * Kiểm tra cấu trúc mạch rồi sắp thứ tự topo.
 * Trả về TẤT CẢ lỗi tìm được (không dừng ở lỗi đầu) để UI tô đỏ hết chỗ sai một lần.
 * Lỗi vòng lặp chỉ được kiểm tra khi không còn lỗi đoản mạch/dây hở, vì khi đó đồ thị mới có nghĩa.
 */
export function compile(netlist: Netlist): CompileResult {
  const errors: CircuitError[] = [];

  if (netlist.inputs.length > MAX_INPUTS) {
    errors.push({ kind: 'too-many-inputs', count: netlist.inputs.length, max: MAX_INPUTS });
  }

  // 1. id cổng trùng + sai số chân
  const seenIds = new Set<string>();
  for (const g of netlist.gates) {
    if (seenIds.has(g.id)) errors.push({ kind: 'duplicate-gate-id', gate: g.id });
    seenIds.add(g.id);
    const expected = GATE_ARITY[g.type];
    if (g.inputs.length !== expected) {
      errors.push({ kind: 'arity', gate: g.id, expected, actual: g.inputs.length });
    }
  }

  // 2. Ai lái net nào (driver) và ai đọc net nào (reader)
  const drivers = new Map<string, string[]>();
  const addDriver = (net: string, who: string): void => {
    const list = drivers.get(net);
    if (list) list.push(who);
    else drivers.set(net, [who]);
  };
  for (const net of netlist.inputs) addDriver(net, `in:${net}`);
  for (const g of netlist.gates) addDriver(g.output, g.id);

  const readers = new Map<string, string[]>();
  const addReader = (net: string, who: string): void => {
    const list = readers.get(net);
    if (list) list.push(who);
    else readers.set(net, [who]);
  };
  for (const g of netlist.gates) for (const net of g.inputs) addReader(net, g.id);
  for (const net of netlist.outputs) addReader(net, `out:${net}`);

  for (const [net, who] of drivers) {
    if (who.length > 1) errors.push({ kind: 'multiple-drivers', net, drivers: [...who] });
  }
  for (const [net, who] of readers) {
    if (!drivers.has(net)) errors.push({ kind: 'undriven-net', net, readers: [...who] });
  }

  if (errors.length > 0) return { ok: false, errors };

  // 3. Sắp topo (Kahn): cổng phụ thuộc vào cổng lái các net đầu vào của nó
  const gateById = new Map(netlist.gates.map((g) => [g.id, g]));
  const driverGate = new Map<string, string>(); // net → id cổng lái (không tính đầu vào chính)
  for (const g of netlist.gates) driverGate.set(g.output, g.id);

  const indegree = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const g of netlist.gates) {
    indegree.set(g.id, 0);
    successors.set(g.id, []);
  }
  for (const g of netlist.gates) {
    for (const net of g.inputs) {
      const src = driverGate.get(net);
      if (src !== undefined) {
        indegree.set(g.id, (indegree.get(g.id) ?? 0) + 1);
        successors.get(src)?.push(g.id);
      }
    }
  }

  const queue: string[] = netlist.gates.filter((g) => indegree.get(g.id) === 0).map((g) => g.id);
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const d = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, d);
      if (d === 0) queue.push(next);
    }
  }

  if (order.length < netlist.gates.length) {
    // Cổng còn lại = nằm trong vòng lặp hoặc nằm sau vòng lặp. Bỏ dần các cổng "đuôi"
    // (không có cổng kế tiếp nào còn trong tập) để chỉ báo các cổng thực sự tạo vòng.
    const left = new Set(netlist.gates.map((g) => g.id).filter((id) => !order.includes(id)));
    let changed = true;
    while (changed) {
      changed = false;
      for (const id of [...left]) {
        const hasNextInLoop = (successors.get(id) ?? []).some((n) => left.has(n));
        if (!hasNextInLoop) {
          left.delete(id);
          changed = true;
        }
      }
    }
    return { ok: false, errors: [{ kind: 'combinational-loop', gates: [...left].sort() }] };
  }

  // 4. Đánh chỉ số net: đầu vào trước, rồi đầu ra cổng theo thứ tự topo
  const nets: string[] = [];
  const netIndex = new Map<string, number>();
  const indexOf = (net: string): number => {
    let i = netIndex.get(net);
    if (i === undefined) {
      i = nets.length;
      nets.push(net);
      netIndex.set(net, i);
    }
    return i;
  };
  const inputIdx = netlist.inputs.map(indexOf);
  const ops: CompiledOp[] = order.map((id) => {
    const g = gateById.get(id) as (typeof netlist.gates)[number];
    return { gate: g.id, type: g.type, ins: g.inputs.map(indexOf), out: indexOf(g.output) };
  });
  const outputIdx = netlist.outputs.map(indexOf);

  return { ok: true, circuit: { netlist, nets, netIndex, inputIdx, outputIdx, ops } };
}

/** Như `compile` nhưng ném lỗi — dùng cho mạch do game/tools tạo ra, vốn phải luôn hợp lệ. */
export function compileOrThrow(netlist: Netlist): CompiledCircuit {
  const r = compile(netlist);
  if (!r.ok) throw new Error(`Mạch không hợp lệ: ${JSON.stringify(r.errors)}`);
  return r.circuit;
}

/** Bit thứ i của hàng `row`, đầu vào đầu tiên là bit cao nhất (A B: 00, 01, 10, 11). */
export function inputBit(row: number, i: number, nInputs: number): Bit {
  return ((row >> (nInputs - 1 - i)) & 1) as Bit;
}

/** Chuẩn bị lỗi cài vào thành chỉ số, kiểm tra lỗi trỏ tới cổng/net có thật. */
function resolveFault(c: CompiledCircuit, fault?: Fault): { stuck: number; stuckVal: Bit; invertOp: number } {
  if (!fault) return { stuck: -1, stuckVal: 0, invertOp: -1 };
  if (fault.kind === 'stuck-at') {
    const i = c.netIndex.get(fault.net);
    if (i === undefined) throw new Error(`Lỗi stuck-at trỏ tới net không tồn tại: ${fault.net}`);
    return { stuck: i, stuckVal: fault.value, invertOp: -1 };
  }
  const op = c.ops.findIndex((o) => o.gate === fault.gate);
  if (op < 0) throw new Error(`Lỗi gate-invert trỏ tới cổng không tồn tại: ${fault.gate}`);
  return { stuck: -1, stuckVal: 0, invertOp: op };
}

/**
 * Mô phỏng một hàng: trả về giá trị MỌI net (theo chỉ số trong `c.nets`).
 * `fault` dùng cho chế độ KIỂM THỬ. Truyền `buf` để tái dùng bộ nhớ khi gọi nhiều lần.
 */
export function evaluateRow(c: CompiledCircuit, row: number, fault?: Fault, buf?: Uint8Array): Uint8Array {
  const v = buf && buf.length >= c.nets.length ? buf : new Uint8Array(c.nets.length);
  const f = resolveFault(c, fault);
  const n = c.inputIdx.length;
  for (let i = 0; i < n; i++) v[c.inputIdx[i] as number] = inputBit(row, i, n);
  if (f.stuck >= 0) v[f.stuck] = f.stuckVal;

  const tmp: Bit[] = [0, 0];
  for (let k = 0; k < c.ops.length; k++) {
    const op = c.ops[k] as CompiledOp;
    tmp.length = op.ins.length;
    for (let j = 0; j < op.ins.length; j++) tmp[j] = v[op.ins[j] as number] as Bit;
    let out = evalGate(op.type, tmp);
    if (k === f.invertOp) out = (out ^ 1) as Bit;
    v[op.out] = out;
    // Net bị kẹt: giá trị cố định thắng nguồn lái (đặt lại ngay để cổng sau đọc đúng)
    if (op.out === f.stuck) v[op.out] = f.stuckVal;
  }
  return v;
}

/** Đọc các đầu ra (LED) từ mảng giá trị net. */
export function readOutputs(c: CompiledCircuit, values: Uint8Array): Bit[] {
  return c.outputIdx.map((i) => values[i] as Bit);
}

/** Bảng chân trị đầy đủ, hàng theo thứ tự nhị phân tăng dần. */
export function truthTable(c: CompiledCircuit, fault?: Fault): TruthRow[] {
  const n = c.inputIdx.length;
  const rows: TruthRow[] = [];
  const buf = new Uint8Array(c.nets.length);
  for (let r = 0; r < 1 << n; r++) {
    const v = evaluateRow(c, r, fault, buf);
    const inputs: Bit[] = [];
    for (let i = 0; i < n; i++) inputs.push(inputBit(r, i, n));
    rows.push({ inputs, outputs: readOutputs(c, v) });
  }
  return rows;
}

export interface TruthComparison {
  correctRows: number;
  totalRows: number;
  pass: boolean;
  /** chỉ số các hàng sai, để UI tô đỏ */
  wrongRows: number[];
}

/**
 * So bảng chân trị người chơi với đáp án. Qua màn chỉ khi đúng 100% (SPEC mục 2).
 * Hai bảng phải cùng thứ tự hàng và cùng đầu vào từng hàng — sai thì là lỗi dữ liệu màn, ném lỗi.
 */
export function compareTruthTable(actual: readonly TruthRow[], expected: readonly TruthRow[]): TruthComparison {
  if (actual.length !== expected.length) {
    throw new Error(`Bảng chân trị lệch số hàng: ${actual.length} so với ${expected.length}`);
  }
  const wrongRows: number[] = [];
  actual.forEach((row, i) => {
    const exp = expected[i] as TruthRow;
    if (row.inputs.join('') !== exp.inputs.join('')) {
      throw new Error(`Hàng ${i} lệch đầu vào: ${row.inputs.join('')} so với ${exp.inputs.join('')}`);
    }
    if (row.outputs.join('') !== exp.outputs.join('')) wrongRows.push(i);
  });
  const correctRows = actual.length - wrongRows.length;
  return { correctRows, totalRows: actual.length, pass: wrongRows.length === 0, wrongRows };
}

/**
 * Delay (D) theo SPEC: số cổng nhiều nhất trên một đường từ đầu vào đến một đầu ra.
 * Đầu ra nối thẳng vào đầu vào có độ sâu 0.
 */
export function logicDepth(c: CompiledCircuit): number {
  const depth = new Int32Array(c.nets.length); // đầu vào = 0
  for (const op of c.ops) {
    let m = 0;
    for (const i of op.ins) m = Math.max(m, depth[i] as number);
    depth[op.out] = m + 1;
  }
  let d = 0;
  for (const i of c.outputIdx) d = Math.max(d, depth[i] as number);
  return d;
}

/** Thứ tự hàng theo mã Gray n bit: hai hàng liên tiếp chỉ khác đúng 1 đầu vào. */
export function grayOrder(nInputs: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < 1 << nInputs; i++) out.push(i ^ (i >> 1));
  return out;
}

/**
 * Power (P) theo SPEC: tổng số lần đổi 0↔1 trên MỌI net (kể cả net đầu vào)
 * khi duyệt bảng chân trị theo thứ tự mã Gray. Không tính bước quay vòng từ hàng cuối về hàng đầu.
 */
export function toggleCount(c: CompiledCircuit): number {
  const order = grayOrder(c.inputIdx.length);
  let prev = evaluateRow(c, order[0] as number).slice();
  const cur = new Uint8Array(c.nets.length);
  let toggles = 0;
  for (let k = 1; k < order.length; k++) {
    evaluateRow(c, order[k] as number, undefined, cur);
    for (let i = 0; i < cur.length; i++) if (cur[i] !== prev[i]) toggles++;
    prev = cur.slice();
  }
  return toggles;
}
