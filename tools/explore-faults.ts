// Khám phá lỗi cho màn KIỂM THỬ: với bố trí đã lưu, thử MỌI lỗi của mô hình làm "lỗi thật" rồi in
// số lớp nghi ngờ + par (minimax). Dùng để chọn lỗi cho màn mới: tránh lỗi par 0 (nhìn đèn là biết).
// Chạy: npx tsx tools/explore-faults.ts t07 t08 (sau khi tools/solve-levels.ts đã bố trí mạch)
import { DEBUG_LEVELS } from '../src/core/level/debug-levels';
import { debugSetup, solvedDebug } from '../src/core/level/debug-setup';
import { solveDebug } from '../src/ai/debug-solver';
import type { Fault } from '../src/core/circuit/types';
for (const id of process.argv.slice(2)) {
  const lv = DEBUG_LEVELS.find((l) => l.id === id)!;
  const st = solvedDebug(id)!.state;
  const faults: Fault[] = lv.model === 'gate-invert'
    ? lv.logic.gates.map((g) => ({ kind: 'gate-invert', gate: g.id }))
    : [...lv.logic.inputs, ...lv.logic.gates.map((g) => g.output)].flatMap((n) => [0, 1].map((v) => ({ kind: 'stuck-at', net: n, value: v as 0 | 1 })));
  for (const f of faults) {
    try {
      const s = debugSetup({ ...lv, fault: f }, st);
      // lỗi không làm đèn sai = không chơi được
      const sol = solveDebug(s.group.circuit, s.group.classes, s.probeNets);
      console.log(id, JSON.stringify(f), 'classes', s.group.classes.length, 'par', sol.par);
    } catch (e) { console.log(id, JSON.stringify(f), 'ERR', (e as Error).message); }
  }
}
