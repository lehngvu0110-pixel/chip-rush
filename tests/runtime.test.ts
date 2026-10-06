import { describe, expect, it, vi } from 'vitest';
import { MAX_DT, createLoop } from '../src/loop';
import { computeCanvasSize } from '../src/render/canvas';
import { toCanvasPoint } from '../src/input/pointer';
import { createAudio, type MiniAudioContext } from '../src/render/audio';
import { FrameStats, LOW_QUALITY_P95_MS, QUALITY_WINDOW, decideQuality, percentile } from '../src/debug/stats';
import { BIT_PERIOD_S, CELL, SandboxScene } from '../src/debug/sandbox-scene';

/** requestAnimationFrame giả: tự điều khiển thời gian từng frame. */
function fakeRaf() {
  let cb: ((t: number) => void) | null = null;
  return {
    raf: (f: (t: number) => void) => {
      cb = f;
      return 1;
    },
    caf: vi.fn(() => {
      cb = null;
    }),
    tick(t: number) {
      const f = cb;
      cb = null;
      f?.(t);
    },
    get pending() {
      return cb !== null;
    },
  };
}

describe('createLoop', () => {
  it('dt tính theo thời gian thực (giây), frame đầu dt = 0', () => {
    const r = fakeRaf();
    const dts: number[] = [];
    const loop = createLoop({ update: (dt) => dts.push(dt), render: () => {} }, r);
    loop.start();
    r.tick(1000);
    r.tick(1016);
    r.tick(1050);
    expect(dts[0]).toBe(0);
    expect(dts[1]).toBeCloseTo(0.016);
    expect(dts[2]).toBeCloseTo(0.034);
  });

  it(`kẹp dt tối đa ${MAX_DT} s sau khi tab bị treo lâu`, () => {
    const r = fakeRaf();
    const dts: number[] = [];
    const loop = createLoop({ update: (dt) => dts.push(dt), render: () => {} }, r);
    loop.start();
    r.tick(0);
    r.tick(5000);
    expect(dts[1]).toBe(MAX_DT);
  });

  it('stop dừng hẳn; start lại thì frame đầu dt = 0 (không cộng dồn thời gian đã dừng)', () => {
    const r = fakeRaf();
    const dts: number[] = [];
    const loop = createLoop({ update: (dt) => dts.push(dt), render: () => {} }, r);
    loop.start();
    r.tick(0);
    loop.stop();
    expect(loop.running).toBe(false);
    expect(r.pending).toBe(false);
    loop.start();
    r.tick(9000);
    expect(dts).toEqual([0, 0]);
  });

  it('afterFrame nhận thời lượng frame (ms), bỏ qua frame đầu', () => {
    const r = fakeRaf();
    const after = vi.fn();
    const loop = createLoop({ update: () => {}, render: () => {}, afterFrame: after }, r);
    loop.start();
    r.tick(100);
    r.tick(108.3);
    expect(after).toHaveBeenCalledTimes(1);
    expect(after.mock.calls[0]?.[0]).toBeCloseTo(8.3);
  });
});

describe('createLoop – mặc định dùng requestAnimationFrame thật', () => {
  it('gọi rAF/cAF đúng ngữ cảnh (hồi quy lỗi "Illegal invocation" 08/10)', () => {
    // Hàm native của trình duyệt ném lỗi nếu bị gọi với `this` khác window; giả lập điều đó.
    function strictRaf(this: unknown, _cb: unknown): number {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
      return 7;
    }
    function strictCaf(this: unknown, _id: unknown): void {
      if (this !== undefined && this !== globalThis) throw new TypeError('Illegal invocation');
    }
    vi.stubGlobal('requestAnimationFrame', strictRaf);
    vi.stubGlobal('cancelAnimationFrame', strictCaf);
    try {
      const loop = createLoop({ update: () => {}, render: () => {} });
      expect(() => loop.start()).not.toThrow();
      expect(() => loop.stop()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('computeCanvasSize', () => {
  it('kẹp DPR tối đa 2 (iPhone DPR 3 → vẽ ở 2x)', () => {
    expect(computeCanvasSize(390, 844, 3)).toEqual({ width: 780, height: 1688, scale: 2 });
  });
  it('DPR 1 hoặc không xác định → 1x; không bao giờ ra kích thước 0', () => {
    expect(computeCanvasSize(360, 640, 1)).toEqual({ width: 360, height: 640, scale: 1 });
    expect(computeCanvasSize(0, 0, 0)).toEqual({ width: 1, height: 1, scale: 1 });
  });
  it('Redmi Note 8 (393×851 CSS px, DPR 2.75) → 2x', () => {
    expect(computeCanvasSize(393, 851, 2.75).scale).toBe(2);
  });
});

describe('toCanvasPoint', () => {
  it('trừ vị trí canvas trên màn hình', () => {
    expect(toCanvasPoint(150, 300, { left: 50, top: 100 })).toEqual({ x: 100, y: 200 });
  });
});

/** AudioContext giả ghi lại các nốt được phát. */
function fakeAudioCtx(state = 'suspended') {
  const started: number[] = [];
  const ctx: MiniAudioContext & { started: number[]; resumed: number } = {
    state,
    currentTime: 0,
    destination: {},
    started,
    resumed: 0,
    resume: async () => {
      ctx.resumed++;
      (ctx as { state: string }).state = 'running';
    },
    createOscillator: () => ({
      type: '',
      frequency: { setValueAtTime: () => {} },
      connect: () => ({}),
      start: (t: number) => started.push(t),
      stop: () => {},
    }),
    createGain: () => ({
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => ({}),
    }),
  };
  return ctx;
}

describe('createAudio', () => {
  it('chưa unlock thì play không phát gì (tuân thủ chính sách tự phát của iOS)', () => {
    const ctx = fakeAudioCtx();
    const factory = vi.fn(() => ctx);
    const a = createAudio(factory);
    a.play('tick');
    expect(factory).not.toHaveBeenCalled(); // context chỉ được tạo trong thao tác người dùng
    expect(ctx.started).toHaveLength(0);
  });

  it('unlock tạo context, resume, sau đó play phát nốt; gọi unlock lần 2 không tạo lại', async () => {
    const ctx = fakeAudioCtx();
    const factory = vi.fn(() => ctx);
    const a = createAudio(factory);
    await a.unlock();
    await a.unlock();
    expect(factory).toHaveBeenCalledTimes(1);
    expect(ctx.resumed).toBe(1);
    expect(a.unlocked).toBe(true);
    const before = ctx.started.length;
    a.play('ting');
    expect(ctx.started.length - before).toBe(2); // "ting" gồm 2 nốt
  });

  it('muted thì không phát', async () => {
    const ctx = fakeAudioCtx();
    const a = createAudio(() => ctx, true);
    await a.unlock();
    const before = ctx.started.length;
    a.play('tick');
    expect(ctx.started.length).toBe(before);
  });

  it('trình duyệt không có Web Audio hoặc tạo context lỗi → im lặng, không crash', async () => {
    const a = createAudio(() => null);
    await a.unlock();
    expect(a.available).toBe(false);
    expect(() => a.play('error')).not.toThrow();
    const b = createAudio(() => {
      throw new Error('NotAllowedError');
    });
    await expect(b.unlock()).resolves.toBeUndefined();
    expect(b.available).toBe(false);
  });
});

describe('thống kê hiệu năng', () => {
  it('percentile nearest-rank', () => {
    const s = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentile(s, 0.5)).toBe(5);
    expect(percentile(s, 0.95)).toBe(10);
    expect(percentile([], 0.5)).toBeNaN();
  });

  it('summary: trung vị, p95, fps, độ trễ chạm', () => {
    const st = new FrameStats();
    for (let i = 0; i < 95; i++) st.addFrame(16);
    for (let i = 0; i < 5; i++) st.addFrame(50);
    st.addLatency(20);
    st.addLatency(40);
    st.addLatency(-1); // giá trị vô nghĩa bị bỏ
    const s = st.summary();
    expect(s.medianMs).toBe(16);
    expect(s.p95Ms).toBe(16);
    expect(s.frames).toBe(100);
    expect(s.fps).toBeCloseTo((100 * 1000) / (95 * 16 + 5 * 50));
    expect(s.latencySamples).toBe(2);
    expect(s.latencyP95Ms).toBe(40);
  });

  it('bộ đệm vòng giữ đúng N frame gần nhất', () => {
    const st = new FrameStats(3);
    [1, 2, 3, 4].forEach((v) => st.addFrame(v));
    expect(st.summary().frames).toBe(3);
    expect(st.summary().medianMs).toBe(3);
  });

  it('chỉ hạ chất lượng khi đủ mẫu và p95 vượt ngưỡng; không tự nâng lại', () => {
    const mk = (frames: number, p95: number) => ({ frames, medianMs: 16, p95Ms: p95, fps: 60, latencySamples: 0, latencyP95Ms: null });
    expect(decideQuality('high', mk(QUALITY_WINDOW - 1, 80))).toBe('high');
    expect(decideQuality('high', mk(QUALITY_WINDOW, LOW_QUALITY_P95_MS + 1))).toBe('low');
    expect(decideQuality('high', mk(QUALITY_WINDOW, 20))).toBe('high');
    expect(decideQuality('low', mk(QUALITY_WINDOW, 8))).toBe('low');
  });
});

describe('SandboxScene', () => {
  const audio = { play: vi.fn(), unlock: async () => {}, muted: false, available: true, unlocked: true };
  const surface = { width: 390, height: 844 } as never;

  /** Chạy scene ở tần số `hz` trong `seconds` giây thời gian thực, trả về chu kỳ đo được. */
  function runAt(hz: number, seconds: number): number {
    let clock = 0;
    const sc = new SandboxScene(audio, () => clock);
    sc.enter(surface);
    const dt = 1 / hz;
    for (let i = 0; i < hz * seconds; i++) {
      clock += dt * 1000;
      sc.update(dt);
    }
    return sc.period;
  }

  it(`chu kỳ chấm chạy = ${BIT_PERIOD_S} s ở cả 60 Hz và 120 Hz (logic theo dt, không theo số frame)`, () => {
    expect(runAt(60, 10)).toBeCloseTo(BIT_PERIOD_S, 1);
    expect(runAt(120, 10)).toBeCloseTo(BIT_PERIOD_S, 1);
  });

  it('cellAt: ô trong lưới, ngoài lưới trả -1; ô ≥ 44 px', () => {
    const sc = new SandboxScene(audio);
    sc.enter(surface);
    expect(CELL).toBeGreaterThanOrEqual(44);
    expect(sc.cellAt(-10, -10)).toBe(-1);
  });
});
