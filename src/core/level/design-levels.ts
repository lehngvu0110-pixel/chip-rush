// Các màn THIẾT KẾ (SPEC mục 2, docs/LEVELS.md). Toạ độ ô là [cột, hàng], gốc ở góc trên-trái.
// Bảng chân trị: thứ tự hàng A B = 00, 01, 10, 11 (đầu vào đầu tiên là bit cao).
import type { DesignLevel } from './types';

export const DESIGN_LEVELS: readonly DesignLevel[] = [
  {
    id: 'd01',
    name: 'Nối điện',
    concept: 'Dây dẫn',
    intro: 'Kéo ngón tay từ công tắc A tới đèn Y để nối dây. Chạm vào công tắc để đổi 0/1.',
    grid: { cols: 5, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [4, 1] }] },
    gatesAllowed: {},
    table: { Y: '01' },
    solution: { wires: [[0, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]]] },
  },
  {
    id: 'd02',
    name: 'Đi vòng',
    concept: 'Đi dây quanh vật cản',
    intro: 'Ô gạch chéo là vật cản. Đi dây vòng qua, càng ngắn càng tốt.',
    grid: {
      cols: 5,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 2] }],
      outputs: [{ id: 'Y', cell: [4, 2] }],
      blocked: [[2, 1], [2, 2], [2, 3]],
    },
    gatesAllowed: {},
    table: { Y: '01' },
    solution: { wires: [[0, [[0, 2], [1, 2], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [4, 2]]]] },
  },
  {
    id: 'd03',
    name: 'Hai đường',
    concept: 'Dây cắt nhau = chập mạch',
    intro: 'Nối A tới Y và B tới X. Hai dây cắt nhau trên cùng lớp sẽ bị chập mạch!',
    grid: {
      cols: 5,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }],
      outputs: [{ id: 'X', cell: [2, 4] }, { id: 'Y', cell: [4, 3] }],
    },
    gatesAllowed: {},
    table: { X: '0101', Y: '0011' },
    solution: {
      wires: [
        [0, [[0, 1], [1, 1], [2, 1], [3, 1], [3, 2], [3, 3], [4, 3]]],
        [0, [[0, 3], [1, 3], [2, 3], [2, 4]]],
      ],
    },
  },
  {
    id: 'd04',
    name: 'Đảo',
    concept: 'Cổng NOT',
    intro: 'NOT đảo bit: 0 thành 1, 1 thành 0. Đặt cổng, nối dây vào bên trái và ra bên phải.',
    grid: { cols: 5, rows: 3, layers: 1, inputs: [{ id: 'A', cell: [0, 1] }], outputs: [{ id: 'Y', cell: [4, 1] }] },
    gatesAllowed: { NOT: 1 },
    table: { Y: '10' },
    solution: { gates: [[2, 1, 'NOT']], wires: [[0, [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]]]] },
  },
  {
    id: 'd05',
    name: 'Cả hai',
    concept: 'Cổng AND',
    intro: 'AND ra 1 khi CẢ HAI đầu vào là 1. Chân ra ở bên phải; dây vào được từ trái, trên hoặc dưới.',
    grid: {
      cols: 5,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }],
      outputs: [{ id: 'Y', cell: [4, 2] }],
    },
    gatesAllowed: { AND: 1 },
    table: { Y: '0001' },
    solution: {
      gates: [[1, 2, 'AND']],
      wires: [
        [0, [[0, 1], [1, 1], [1, 2]]],
        [0, [[0, 3], [1, 3], [1, 2]]],
        [0, [[1, 2], [2, 2], [3, 2], [4, 2]]],
      ],
    },
  },
  {
    id: 'd06',
    name: 'Một trong hai',
    concept: 'Cổng OR',
    intro: 'OR ra 1 khi CÓ ÍT NHẤT MỘT đầu vào là 1.',
    grid: {
      cols: 5,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 0] }, { id: 'B', cell: [0, 4] }],
      outputs: [{ id: 'Y', cell: [4, 3] }],
    },
    gatesAllowed: { OR: 1 },
    table: { Y: '0111' },
    solution: {
      gates: [[1, 2, 'OR']],
      wires: [
        [0, [[0, 0], [1, 0], [1, 1], [1, 2]]],
        [0, [[0, 4], [1, 4], [1, 3], [1, 2]]],
        [0, [[1, 2], [2, 2], [3, 2], [3, 3], [4, 3]]],
      ],
    },
  },
  {
    id: 'd07',
    name: 'Khác nhau',
    concept: 'Cổng XOR + đọc bảng chân trị',
    intro: 'Không ai nói dùng cổng nào. Đọc bảng chân trị rồi tự chọn cổng đúng.',
    grid: {
      cols: 5,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }],
      outputs: [{ id: 'Y', cell: [4, 1] }],
    },
    gatesAllowed: { AND: 1, OR: 1, XOR: 1 },
    table: { Y: '0110' },
    solution: {
      gates: [[1, 1, 'XOR']],
      wires: [
        [0, [[0, 1], [1, 1]]],
        [0, [[0, 3], [1, 3], [1, 2], [1, 1]]],
        [0, [[1, 1], [2, 1], [3, 1], [4, 1]]],
      ],
    },
  },
  {
    id: 'd08',
    name: 'Tự ghép',
    concept: 'NAND = AND + NOT',
    intro: 'Không có cổng NAND. Ghép AND với NOT để được NAND (ngược lại của AND).',
    grid: {
      cols: 6,
      rows: 5,
      layers: 1,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }],
      outputs: [{ id: 'Y', cell: [5, 2] }],
    },
    gatesAllowed: { AND: 1, NOT: 1 },
    table: { Y: '1110' },
    solution: {
      gates: [[1, 2, 'AND'], [2, 2, 'NOT']],
      wires: [
        [0, [[0, 1], [1, 1], [1, 2]]],
        [0, [[0, 3], [1, 3], [1, 2]]],
        [0, [[1, 2], [2, 2], [3, 2], [4, 2], [5, 2]]],
      ],
    },
  },
  {
    id: 'd09',
    name: 'Cầu vượt',
    concept: 'Via và lớp kim loại 2',
    intro: 'Hai dây buộc phải giao nhau. Đặt via rồi đi một dây ở lớp 2 để vượt qua dây kia.',
    grid: {
      cols: 5,
      rows: 5,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 3] }],
      outputs: [{ id: 'X', cell: [4, 3] }, { id: 'Y', cell: [4, 1] }],
    },
    gatesAllowed: {},
    table: { X: '0011', Y: '0101' },
    solution: {
      vias: [[1, 3], [3, 1]],
      wires: [
        [0, [[0, 1], [1, 1], [2, 1], [2, 2], [2, 3], [3, 3], [4, 3]]],
        [0, [[0, 3], [1, 3]]],
        [1, [[1, 3], [1, 2], [2, 2], [3, 2], [3, 1]]],
        [0, [[3, 1], [4, 1]]],
      ],
    },
  },
  {
    id: 'd11',
    name: 'Cộng nửa',
    concept: 'Mạch cộng nửa (half adder)',
    intro: 'Cộng 2 bit: S = A XOR B (tổng), C = A AND B (nhớ). Khối cộng nhỏ nhất trong CPU!',
    grid: {
      cols: 6,
      rows: 7,
      layers: 2,
      inputs: [{ id: 'A', cell: [0, 1] }, { id: 'B', cell: [0, 6] }],
      outputs: [{ id: 'S', cell: [5, 2] }, { id: 'C', cell: [5, 5] }],
    },
    gatesAllowed: { XOR: 1, AND: 1 },
    table: { S: '0110', C: '0001' },
    solution: {
      gates: [[3, 2, 'XOR'], [3, 5, 'AND']],
      vias: [[2, 5], [2, 3]],
      wires: [
        [0, [[0, 1], [1, 1], [2, 1], [3, 1], [3, 2]]],
        [0, [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [3, 5]]],
        [0, [[0, 6], [1, 6], [2, 6], [3, 6], [3, 5]]],
        [0, [[2, 6], [2, 5]]],
        [1, [[2, 5], [2, 4], [2, 3]]],
        [0, [[2, 3], [2, 2], [3, 2]]],
        [0, [[3, 2], [4, 2], [5, 2]]],
        [0, [[3, 5], [4, 5], [5, 5]]],
      ],
    },
  },
];

export function levelById(id: string): DesignLevel | undefined {
  return DESIGN_LEVELS.find((l) => l.id === id);
}
