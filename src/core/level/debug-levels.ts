// Các màn KIỂM THỬ (SPEC mục 3, docs/LEVELS.md). Mạch do AI kỹ sư tự bố trí lên lưới (tools/solve-levels.ts).
// Lỗi viết theo tên trong `logic`. t01–t03: một cổng cho ra ngược; t04–t06: một dây bị kẹt ở 0 hoặc 1.
import type { DebugLevel } from './types';

const IN3 = (cols: number, rows: number) => ({
  cols,
  rows,
  layers: 2 as const,
  inputs: [{ id: 'A', cell: [0, 1] as [number, number] }, { id: 'B', cell: [0, 3] as [number, number] }, { id: 'C', cell: [0, 5] as [number, number] }],
  outputs: [{ id: 'Y', cell: [cols - 1, 3] as [number, number] }],
});

export const DEBUG_LEVELS: readonly DebugLevel[] = [
  {
    id: 't01',
    name: 'Chuỗi đảo',
    concept: 'Đo để khoanh vùng (chia đôi)',
    intro: 'Đèn Y sáng sai: một trong ba cổng NOT đang cho ra ngược. Chạm dây để đo (mỗi lần đo tốn 1 lượt), rồi báo cổng hỏng.',
    grid: { cols: 6, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [5, 1] }] },
    logic: {
      inputs: ['A'],
      outputs: ['Y'],
      gates: [
        { id: 'n1', type: 'NOT', inputs: ['A'], output: 'p' },
        { id: 'n2', type: 'NOT', inputs: ['p'], output: 'q' },
        { id: 'n3', type: 'NOT', inputs: ['q'], output: 'Y' },
      ],
    },
    model: 'gate-invert',
    fault: { kind: 'gate-invert', gate: 'n2' },
  },
  {
    id: 't02',
    name: 'Đọc bệnh án',
    concept: 'Suy luận từ bảng chân trị',
    intro: 'Bộ chọn MUX bị hỏng một cổng. So bảng chân trị chuẩn với đèn thật — có khi không cần đo lần nào!',
    grid: {
      cols: 6,
      rows: 7,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 5] }, { id: 'S', cell: [0, 3] }],
      outputs: [{ id: 'Y', cell: [5, 3] }],
    },
    logic: {
      inputs: ['A', 'B', 'S'],
      outputs: ['Y'],
      gates: [
        { id: 'n1', type: 'NOT', inputs: ['S'], output: 'ns' },
        { id: 'a1', type: 'AND', inputs: ['A', 'ns'], output: 'p' },
        { id: 'a2', type: 'AND', inputs: ['B', 'S'], output: 'q' },
        { id: 'o1', type: 'OR', inputs: ['p', 'q'], output: 'Y' },
      ],
    },
    model: 'gate-invert',
    fault: { kind: 'gate-invert', gate: 'a1' },
  },
  {
    id: 't03',
    name: 'Chẵn lẻ',
    concept: 'Lỗi giống nhau ở đầu ra',
    intro: 'Mạch kiểm tra chẵn lẻ: hỏng cổng nào thì Y cũng bị đảo y hệt nhau. Chỉ có đo bên trong mới biết.',
    grid: IN3(6, 7),
    logic: {
      inputs: ['A', 'B', 'C'],
      outputs: ['Y'],
      gates: [
        { id: 'x1', type: 'XOR', inputs: ['A', 'B'], output: 'p' },
        { id: 'x2', type: 'XOR', inputs: ['p', 'C'], output: 'q' },
        { id: 'n1', type: 'NOT', inputs: ['q'], output: 'Y' },
      ],
    },
    model: 'gate-invert',
    fault: { kind: 'gate-invert', gate: 'x1' },
  },
  {
    id: 't04',
    name: 'Dây kẹt',
    concept: 'Lỗi kẹt (stuck-at): chọn đúng hàng để đo',
    intro: 'Một dây bị KẸT ở 0 hoặc 1. Dây kẹt chỉ lộ ra ở vài hàng đầu vào — chọn công tắc khéo trước khi đo.',
    grid: {
      cols: 6,
      rows: 7,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 5] }, { id: 'S', cell: [0, 3] }],
      outputs: [{ id: 'Y', cell: [5, 3] }],
    },
    logic: {
      inputs: ['A', 'B', 'S'],
      outputs: ['Y'],
      gates: [
        { id: 'n1', type: 'NOT', inputs: ['S'], output: 'ns' },
        { id: 'a1', type: 'AND', inputs: ['A', 'ns'], output: 'p' },
        { id: 'a2', type: 'AND', inputs: ['B', 'S'], output: 'q' },
        { id: 'o1', type: 'OR', inputs: ['p', 'q'], output: 'Y' },
      ],
    },
    model: 'stuck-at',
    fault: { kind: 'stuck-at', net: 'A', value: 0 },
  },
  {
    id: 't05',
    name: 'Bốn nghi phạm',
    concept: 'Cây quyết định nhiều tầng',
    intro: 'Y = NOT((A AND B) OR C) đang sai và có nhiều dây khả nghi. Lên kế hoạch đo thật khéo: mỗi lần đo nên loại được nhiều khả năng nhất.',
    grid: IN3(6, 7),
    logic: {
      inputs: ['A', 'B', 'C'],
      outputs: ['Y'],
      gates: [
        { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'p' },
        { id: 'o1', type: 'OR', inputs: ['p', 'C'], output: 'q' },
        { id: 'n1', type: 'NOT', inputs: ['q'], output: 'Y' },
      ],
    },
    model: 'stuck-at',
    fault: { kind: 'stuck-at', net: 'p', value: 1 },
  },
  {
    id: 't06',
    name: 'Cộng đủ bị ốm',
    concept: 'Tìm lỗi trong mạch lớn',
    intro: 'Mạch cộng đủ báo Cout sai. Đừng đo mò cả 5 cổng — đọc bảng chân trị để khoanh vùng trước.',
    grid: {
      cols: 7,
      rows: 7,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }, { id: 'Cin', cell: [0, 5] }],
      outputs: [{ id: 'S', cell: [6, 2] }, { id: 'Cout', cell: [6, 5] }],
    },
    logic: {
      inputs: ['A', 'B', 'Cin'],
      outputs: ['S', 'Cout'],
      gates: [
        { id: 'x1', type: 'XOR', inputs: ['A', 'B'], output: 'p' },
        { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'g' },
        { id: 'x2', type: 'XOR', inputs: ['p', 'Cin'], output: 'S' },
        { id: 'a2', type: 'AND', inputs: ['p', 'Cin'], output: 't' },
        { id: 'o1', type: 'OR', inputs: ['g', 't'], output: 'Cout' },
      ],
    },
    model: 'stuck-at',
    fault: { kind: 'stuck-at', net: 't', value: 1 },
  },
];
