import type { Netlist } from '../../src/core/circuit/types';

// Các mạch mẫu dùng chung cho test, cũng là lời giải tham chiếu của vài màn THIẾT KẾ.

/** d11: half adder. S = A xor B, C = A and B. */
export const halfAdder: Netlist = {
  inputs: ['A', 'B'],
  outputs: ['S', 'C'],
  gates: [
    { id: 'x1', type: 'XOR', inputs: ['A', 'B'], output: 'S' },
    { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'C' },
  ],
};

/** d12: full adder ghép từ 2 half adder + OR. */
export const fullAdder: Netlist = {
  inputs: ['A', 'B', 'Cin'],
  outputs: ['S', 'Cout'],
  gates: [
    { id: 'x1', type: 'XOR', inputs: ['A', 'B'], output: 'p' },
    { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'g' },
    { id: 'x2', type: 'XOR', inputs: ['p', 'Cin'], output: 'S' },
    { id: 'a2', type: 'AND', inputs: ['p', 'Cin'], output: 't' },
    { id: 'o1', type: 'OR', inputs: ['g', 't'], output: 'Cout' },
  ],
};

/** d08: NAND ghép từ AND + NOT. */
export const nandFromAndNot: Netlist = {
  inputs: ['A', 'B'],
  outputs: ['Y'],
  gates: [
    { id: 'a1', type: 'AND', inputs: ['A', 'B'], output: 'n' },
    { id: 'n1', type: 'NOT', inputs: ['n'], output: 'Y' },
  ],
};

/** d10: MUX 2:1. Y = S ? B : A  =  (A and not S) or (B and S). */
export const mux2: Netlist = {
  inputs: ['S', 'A', 'B'],
  outputs: ['Y'],
  gates: [
    { id: 'n1', type: 'NOT', inputs: ['S'], output: 'ns' },
    { id: 'a1', type: 'AND', inputs: ['A', 'ns'], output: 'pa' },
    { id: 'a2', type: 'AND', inputs: ['B', 'S'], output: 'pb' },
    { id: 'o1', type: 'OR', inputs: ['pa', 'pb'], output: 'Y' },
  ],
};
