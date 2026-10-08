// Sinh + giải trước 28 đề Daily Chip (SPEC mục 4) → src/core/level/daily.json.
// Chạy: npx tsx tools/gen-daily.ts            (seed cố định → chạy lại ra đúng bộ đề cũ)
//
// Mỗi đề: mạch logic ngẫu nhiên 1–3 cổng trên 2–3 công tắc, lưới 5–7 ô có vật cản ngẫu nhiên.
// "AI kỹ sư" (src/ai/design-solver.ts) phải giải được thì đề mới được nhận, nên đề nào cũng có lời giải
// và có par 3 sao. Đề bị loại khi: đầu ra hằng số, đầu ra trùng một công tắc, cổng thừa (bỏ đi vẫn đúng
// bảng chân trị), hoặc trùng bảng chân trị với đề đã có.
import { writeFileSync } from 'node:fs';
import { solveDesign } from '../src/ai/design-solver';
import { compileOrThrow, truthTable } from '../src/core/circuit/simulate';
import type { GateInstance, GateType, Netlist } from '../src/core/circuit/types';
import type { DesignLevel, SolvedLevel } from '../src/core/level/types';
import { createRng, pick, randInt, type Rng } from '../src/core/util/rng';
import { gridFor, passingPpa } from '../src/core/level/validate';

const N = 28;
const SEED = 20261026;
const OUT = new URL('../src/core/level/daily.json', import.meta.url);

/** Độ khó xoay vòng theo tuần: thứ tự trong chu kỳ 4 đề. */
const TIERS = [
  { inputs: 2, gates: 1, outputs: 1 },
  { inputs: 2, gates: 2, outputs: 1 },
  { inputs: 3, gates: 2, outputs: 1 },
  { inputs: 2, gates: 2, outputs: 2 },
  // thay cho đề 1 cổng khi đã dùng hết 5 bảng chân trị 1 cổng
  { inputs: 3, gates: 3, outputs: 1 },
] as const;
const TYPES: GateType[] = ['AND', 'OR', 'XOR', 'NAND', 'NOR', 'AND', 'OR', 'XOR'];
const IN_IDS = ['A', 'B', 'C'];
const OUT_IDS = ['Y', 'X'];

function tableOf(nl: Netlist): Record<string, string> {
  const rows = truthTable(compileOrThrow(nl));
  const t: Record<string, string> = {};
  nl.outputs.forEach((_, j) => (t[OUT_IDS[j] as string] = rows.map((r) => r.outputs[j]).join('')));
  return t;
}

/** Mạch ngẫu nhiên: mỗi cổng đọc 2 tín hiệu đã có (công tắc hoặc chân ra cổng trước). */
function randomLogic(rng: Rng, nIn: number, nGates: number, nOut: number): Netlist {
  const inputs = IN_IDS.slice(0, nIn);
  const signals = [...inputs];
  const gates: GateInstance[] = [];
  for (let g = 0; g < nGates; g++) {
    // 15% NOT nếu còn chỗ, còn lại cổng 2 chân
    const type: GateType = rng() < 0.15 ? 'NOT' : pick(rng, TYPES);
    const a = pick(rng, signals);
    let b = pick(rng, signals);
    for (let k = 0; k < 8 && b === a; k++) b = pick(rng, signals);
    const ins = type === 'NOT' ? [a] : [a, b];
    if (type !== 'NOT' && a === b) return randomLogic(rng, nIn, nGates, nOut);
    const out = `n${g}`;
    gates.push({ id: `g${g}`, type, inputs: ins, output: out });
    signals.push(out);
  }
  const outputs = gates.slice(-nOut).map((g) => g.output);
  return { inputs, outputs, gates };
}

function acceptable(nl: Netlist, seen: Set<string>): boolean {
  // mọi cổng phải góp vào đầu ra, mọi công tắc phải được dùng
  const used = new Set(nl.outputs);
  for (let i = nl.gates.length - 1; i >= 0; i--) {
    const g = nl.gates[i] as GateInstance;
    if (!used.has(g.output)) return false;
    g.inputs.forEach((x) => used.add(x));
  }
  if (!nl.inputs.every((x) => used.has(x))) return false;
  const rows = truthTable(compileOrThrow(nl));
  const n = rows.length;
  for (let j = 0; j < nl.outputs.length; j++) {
    const col = rows.map((r) => r.outputs[j]).join('');
    if (/^0+$|^1+$/.test(col)) return false; // hằng số
    // = công tắc, hoặc = đảo của công tắc (quá dễ)
    for (let i = 0; i < nl.inputs.length; i++) if (rows.every((r) => r.outputs[j] === r.inputs[i]) || rows.every((r) => r.outputs[j] !== r.inputs[i])) return false;
  }
  if (nl.outputs.length === 2 && rows.every((r) => r.outputs[0] === r.outputs[1])) return false; // 2 đèn y hệt nhau
  // cổng thừa: thay đầu ra một cổng bằng một đầu vào của nó mà bảng chân trị không đổi
  const want = JSON.stringify(rows.map((r) => r.outputs));
  for (const g of nl.gates) {
    for (const x of g.inputs) {
      const rename = (s: string): string => (s === g.output ? x : s);
      const cut: Netlist = {
        inputs: nl.inputs,
        outputs: nl.outputs.map(rename),
        gates: nl.gates.filter((h) => h !== g).map((h) => ({ ...h, inputs: h.inputs.map(rename) })),
      };
      if (JSON.stringify(truthTable(compileOrThrow(cut)).map((r) => r.outputs)) === want) return false;
    }
  }
  const key = `${n}:${nl.outputs.length}:${want}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}

function gridSpec(rng: Rng, nIn: number, nOut: number, layers: 1 | 2): DesignLevel['grid'] {
  const cols = 5 + randInt(rng, 3);
  const rows = nIn === 3 ? 7 : 5 + randInt(rng, 2);
  const inRows = nIn === 3 ? [1, 3, 5] : rows === 5 ? [1, 3] : [1, 4];
  const outRows = nOut === 2 ? (rows === 5 ? [1, 3] : [2, rows - 2]) : [Math.floor(rows / 2)];
  const inputs = inRows.map((r, i) => ({ id: IN_IDS[i] as string, cell: [0, r] as [number, number] }));
  const outputs = outRows.map((r, j) => ({ id: OUT_IDS[j] as string, cell: [cols - 1, r] as [number, number] }));
  // vật cản: không nằm ở cột chân, không sát chân
  const blocked: [number, number][] = [];
  const nBlock = randInt(rng, 4);
  for (let t = 0; t < 40 && blocked.length < nBlock; t++) {
    const c = 2 + randInt(rng, cols - 4);
    const r = randInt(rng, rows);
    if (blocked.some(([x, y]) => x === c && y === r)) continue;
    blocked.push([c, r]);
  }
  return { cols, rows, layers, inputs, outputs, ...(blocked.length ? { blocked } : {}) };
}

const rng = createRng(SEED);
const seen = new Set<string>();
const out: (DesignLevel & { solved: SolvedLevel })[] = [];
let attempts = 0;
let dayTries = 0;
while (out.length < N) {
  attempts++;
  if (attempts > 5000) throw new Error('không sinh đủ đề — nới điều kiện');
  // mỗi tầng 2 đầu vào chỉ có ít bảng chân trị khác nhau (1 cổng: 5; 2 cổng, 1 đèn: 10) → dùng hết thì
  // (thử 300 lần không ra đề mới) chuyển sang tầng 3 đầu vào, 3 cổng
  const i = out.length;
  dayTries++;
  const tier = (dayTries >= 300 ? TIERS[4] : TIERS[i % 4]) as (typeof TIERS)[number];
  const logic = randomLogic(rng, tier.inputs, tier.gates, tier.outputs);
  if (!acceptable(logic, seen)) continue;
  const k = out.length + 1;
  const id = `daily-${String(k).padStart(2, '0')}`;
  const allowed: DesignLevel['gatesAllowed'] = {};
  for (const g of logic.gates) allowed[g.type] = (allowed[g.type] ?? 0) + 1;
  let level: DesignLevel | null = null;
  let res: ReturnType<typeof solveDesign> = null;
  // thử lưới 1 lớp trước (dễ hơn cho người chơi); không đi dây được thì cho thêm lớp 2
  for (const layers of [1, 2] as const) {
    const grid = gridSpec(rng, tier.inputs, tier.outputs, layers);
    const lv: DesignLevel = {
      id,
      name: `Chip số ${k}`,
      concept: `Dùng ${Object.entries(allowed).map(([t, n]) => (n === 1 ? t : `${n} ${t}`)).join(' + ')}`,
      intro: 'Đề hôm nay: làm mọi đèn sáng đúng bảng chân trị bằng đúng các cổng được cho. 0 giờ có đề mới!',
      grid,
      gatesAllowed: allowed,
      table: tableOf(logic),
      logic,
    };
    res = solveDesign(grid, logic, { timeLimitMs: 15_000, beamWidth: 2000, deepCount: 150, orders: 30, seed: k });
    if (res) {
      level = lv;
      break;
    }
  }
  if (!level || !res) {
    seen.delete([...seen].pop() as string);
    continue;
  }
  const ppa = passingPpa(level, gridFor(level, res.state));
  if (!ppa) throw new Error(`${id}: lời giải AI không qua màn`);
  const solved: SolvedLevel = { par: ppa, state: res.state, source: 'solver', proven: res.proven, lowerBound: Number.isFinite(res.lowerBound) ? res.lowerBound : null };
  out.push({ ...level, solved });
  dayTries = 0;
  console.log(`${id}  ${level.grid.cols}×${level.grid.rows} L${level.grid.layers}  ${level.concept.padEnd(18)}  ${JSON.stringify(level.table)}  par C=${ppa.C}  ${res.proven ? 'TỐI ƯU' : 'tốt nhất tìm được'}  ${res.ms} ms`);
}
console.log(`${N} đề sau ${attempts} lần sinh`);
writeFileSync(OUT, '[\n' + out.map((l) => '  ' + JSON.stringify(l)).join(',\n') + '\n]\n');
