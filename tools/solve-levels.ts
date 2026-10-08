// Chạy "AI kỹ sư" cho mọi màn THIẾT KẾ và ghi src/core/level/solutions.json (ADR-0005: par tính offline).
// Chạy: npx tsx tools/solve-levels.ts [id ...]
// Màn có lời giải mẫu: solver tối ưu bố trí cho CÙNG mạch logic; giữ lời giải nào có chi phí thấp hơn.
import { readFileSync, writeFileSync } from 'node:fs';
import { solveDesign } from '../src/ai/design-solver';
import { gridToNetlist } from '../src/core/circuit/netlist';
import { DESIGN_LEVELS } from '../src/core/level/design-levels';
import type { SolvedLevel } from '../src/core/level/types';
import { applySolution, gridFor, passingPpa } from '../src/core/level/validate';

const OUT = new URL('../src/core/level/solutions.json', import.meta.url);
const only = process.argv.slice(2);
const prev = JSON.parse(readFileSync(OUT, 'utf8')) as Record<string, SolvedLevel>;
const out: Record<string, SolvedLevel> = { ...prev };

for (const lv of DESIGN_LEVELS) {
  if (only.length && !only.includes(lv.id)) continue;
  let logic = lv.logic;
  let refState = null;
  if (lv.solution) {
    const ref = gridFor(lv);
    applySolution(ref, lv.solution);
    refState = ref.state();
    logic ??= gridToNetlist(ref).netlist;
  }
  if (!logic) throw new Error(`${lv.id}: không có mạch logic`);
  // nhiều seed cho beam search (màn nhiều cổng); màn ít cổng được duyệt hết nên seed không đổi kết quả
  let r: ReturnType<typeof solveDesign> = null;
  for (const seed of [1, 2, 3, 4, 5]) {
    const t = solveDesign(lv.grid, logic, { timeLimitMs: 30_000, beamWidth: 3000, deepCount: 200, orders: 40, seed });
    if (t && (!r || t.area < r.area)) r = t;
    if (t?.exhaustive) break;
  }
  const cand: { state: SolvedLevel['state']; source: SolvedLevel['source'] }[] = [];
  if (r) cand.push({ state: r.state, source: 'solver' });
  if (refState) cand.push({ state: refState, source: 'reference' });
  let best: (SolvedLevel & { C: number }) | null = null;
  const ms = r?.ms ?? 0;
  for (const c of cand) {
    const ppa = passingPpa(lv, gridFor(lv, c.state));
    if (!ppa) {
      console.error(`${lv.id}: lời giải ${c.source} KHÔNG qua màn`);
      continue;
    }
    // giữ lời giải chi phí thấp nhất; bằng nhau thì ưu tiên solver (đứng trước trong danh sách)
    if (!best || ppa.C < best.C) {
      best = { par: ppa, state: c.state, source: c.source, proven: c.source === 'solver' && !!r?.proven, lowerBound: r && Number.isFinite(r.lowerBound) ? r.lowerBound : null, C: ppa.C };
    }
  }
  if (!best) {
    console.error(`${lv.id}: KHÔNG có lời giải hợp lệ`);
    process.exitCode = 1;
    continue;
  }
  const { C: _c, ...rest } = best;
  out[lv.id] = rest;
  console.log(`${lv.id}  A/D/P/C ${best.par.A}/${best.par.D}/${best.par.P}/${best.par.C}  nguồn ${best.source}  ${best.proven ? 'TỐI ƯU (đã chứng minh)' : 'tốt nhất tìm được'}  cận dưới A ≥ ${best.lowerBound ?? '?'}  ${ms} ms`);
}
// mỗi màn 1 dòng: diff gọn khi solver đổi lời giải
const ids = Object.keys(out).sort();
writeFileSync(OUT, '{\n' + ids.map((id) => `  ${JSON.stringify(id)}: ${JSON.stringify(out[id])}`).join(',\n') + '\n}\n');
