// In par (A/D/P/C) của mọi màn THIẾT KẾ để điền docs/LEVELS.md. Chạy: npx tsx tools/print-par.ts
import { DESIGN_LEVELS } from '../src/core/level/design-levels';
import { levelPar } from '../src/core/level/validate';
for (const l of DESIGN_LEVELS) { const p = levelPar(l); console.log(`${l.id} ${l.grid.cols}x${l.grid.rows}x${l.grid.layers} ${p.A}/${p.D}/${p.P}/${p.C}`); }
