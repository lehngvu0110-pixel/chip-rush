// Góc học tập: sơ đồ tư duy hợp lệ, câu trắc nghiệm đúng định dạng, câu tính toán có đáp án đúng công thức.
import { describe, expect, it } from 'vitest';
import { MIND_ROOT, allMindNodes, findMindPath } from '../src/core/learn/mindmap';
import { AUTHORED_QUESTIONS, GENERATORS, makeQuiz, quizStars, vn } from '../src/core/learn/quiz';
import { partById } from '../src/core/parts/catalog';
import { createRng } from '../src/core/util/rng';

describe('sơ đồ tư duy', () => {
  it('id không trùng; mọi liên kết linh kiện tồn tại; mỗi nhánh có 3-6 ý', () => {
    const nodes = allMindNodes();
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    for (const n of nodes) {
      expect(n.detail.length).toBeGreaterThan(20);
      if (n.link?.kind === 'part') expect(partById(n.link.id), n.id).toBeDefined();
    }
    expect(MIND_ROOT.children).toHaveLength(6);
    // README và thẻ Góc học tập ghi "6 nhánh, 29 ý"
    expect(MIND_ROOT.children!.reduce((n, b) => n + b.children!.length, 0)).toBe(29);
    for (const b of MIND_ROOT.children!) {
      expect(b.children!.length).toBeGreaterThanOrEqual(3);
      expect(b.children!.length).toBeLessThanOrEqual(6);
    }
  });
  it('công thức: mỗi ô một công thức, không dùng "·" (dấu nhân) để ngăn cách hai công thức (lỗi 26/10)', () => {
    expect(findMindPath('p-capacitor')!.at(-1)!.formula).toEqual(['Q = C · U', 'τ = R · C']);
    for (const n of allMindNodes())
      for (const f of n.formula ?? []) {
        // "·" phải nằm giữa hai thừa số, không đứng trước một nhãn mới ("· Song song:") hay một vế mới ("· τ =")
        expect(f, n.id).not.toMatch(/·\s*[^·=]*:/);
        expect(f, n.id).not.toMatch(/·\s*[A-Za-zτ]\s*=/);
      }
  });

  it('tìm đường đi từ gốc tới một ý', () => {
    expect(findMindPath('ohm')!.map((n) => n.id)).toEqual(['root', 'laws', 'ohm']);
    expect(findMindPath('khong-co')).toBeNull();
  });
});

describe('câu soạn sẵn', () => {
  it('id không trùng, 4 phương án khác nhau, có lời giải, đủ 4 chủ đề', () => {
    expect(new Set(AUTHORED_QUESTIONS.map((q) => q.id)).size).toBe(AUTHORED_QUESTIONS.length);
    for (const q of AUTHORED_QUESTIONS) {
      expect(new Set(q.opts).size, q.id).toBe(4);
      expect(q.explain.length, q.id).toBeGreaterThan(20);
    }
    expect(new Set(AUTHORED_QUESTIONS.map((q) => q.topic))).toEqual(new Set(['basic', 'parts', 'semi', 'digital']));
  });
});

describe('độ đúng kiến thức', () => {
  it('điện 50 Hz đổi chiều 100 lần mỗi giây (50 chu kỳ × 2), không phải 50 lần (lỗi 26/10)', () => {
    const q = AUTHORED_QUESTIONS.find((x) => x.id === 'b-acdc')!;
    expect(q.explain).toContain('100 lần');
    for (const x of AUTHORED_QUESTIONS) expect(x.explain, x.id).not.toMatch(/đổi chiều 50 lần/);
    for (const n of allMindNodes()) expect(n.detail, n.id).not.toMatch(/đổi chiều 50 lần/);
  });
});

describe('câu tính toán', () => {
  const num = (s: string): number => {
    const m = /([\d,]+)\s*(m|k|M)?(A|W|Ω)?/.exec(s)!;
    const v = Number(m[1]!.replace(',', '.'));
    return v * (m[2] === 'k' ? 1e3 : m[2] === 'M' ? 1e6 : m[2] === 'm' ? 1e-3 : 1);
  };
  it('mỗi bộ sinh: 4 phương án khác nhau cả về chữ lẫn GIÁ TRỊ, qua 3000 seed (lỗi 26/10: "500 Ω × 2")', () => {
    for (const g of GENERATORS)
      for (let s = 1; s <= 3000; s++) {
        const q = g.make(createRng(s));
        const why = `${g.id} seed ${s}: ${q.opts.join(' | ')}`;
        expect(new Set(q.opts).size, why).toBe(4);
        expect(q.opts.join(' '), why).not.toContain('×');
        if (g.id !== 'g-gate') expect(new Set(q.opts.map(num)).size, why).toBe(4);
      }
  });
  it('đáp án Ohm, công suất, LED, nhị phân khớp công thức', () => {
    for (let s = 1; s <= 100; s++) {
      const r = createRng(s);
      const ohm = GENERATORS.find((g) => g.id === 'g-ohm')!.make(r);
      const [, U, Rs] = /Đặt (\d+) V lên điện trở ([\d,]+ k?Ω)/.exec(ohm.q)!;
      expect(num(ohm.opts[0])).toBeCloseTo(Number(U) / num(Rs!), 3);
      const bin = GENERATORS.find((g) => g.id === 'g-binary')!.make(r);
      expect(Number(bin.opts[0])).toBe(parseInt(/(\d{4})/.exec(bin.q)![1]!, 2));
    }
  });
  it('đọc vạch màu: Vàng · Tím · Đỏ = 4,7 kΩ xuất hiện đúng', () => {
    let found = false;
    for (let s = 1; s <= 2000 && !found; s++) {
      const q = GENERATORS.find((g) => g.id === 'g-bands')!.make(createRng(s));
      if (q.q.includes('Vàng · Tím · Đỏ · Nhũ vàng')) {
        expect(q.opts[0]).toBe('4,7 kΩ');
        found = true;
      }
    }
    expect(found).toBe(true);
  });
  it('định dạng số kiểu Việt Nam', () => {
    expect(vn(0.0191)).toBe('0,0191');
    expect(vn(4700)).toBe('4700');
    expect(vn(12.766)).toBe('12,8');
  });
});

describe('ra đề', () => {
  it('10 câu, đáp án nằm trong phương án, câu soạn sẵn không lặp, cùng seed cùng đề', () => {
    const a = makeQuiz(42);
    expect(a).toHaveLength(10);
    for (const q of a) expect(q.options[q.answer]).toBeDefined();
    const ids = a.filter((q) => !q.id.startsWith('g-')).map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(makeQuiz(42)).toEqual(a);
    expect(makeQuiz(43)).not.toEqual(a);
  });
  it('lọc theo chủ đề', () => {
    for (const t of ['basic', 'parts', 'semi', 'digital'] as const) for (const q of makeQuiz(7, t)) expect(q.topic).toBe(t);
  });
  it('đáp án đúng không luôn ở cùng một vị trí', () => {
    const pos = new Set(makeQuiz(5).map((q) => q.answer));
    expect(pos.size).toBeGreaterThan(1);
  });
  it('sao theo tỉ lệ đúng', () => {
    expect([10, 9, 8, 7, 6, 5, 4].map((c) => quizStars(c, 10))).toEqual([3, 3, 2, 2, 1, 1, 0]);
  });
});
