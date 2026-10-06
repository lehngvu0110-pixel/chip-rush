// Vòng lặp game duy nhất. Logic nhận `dt` (giây, thời gian thực) nên chạy đúng tốc độ
// ở mọi tần số quét (60 Hz, 120 Hz ProMotion, hay máy yếu tụt khung).

/** dt tối đa cho 1 bước (giây). Sau khi tab ẩn lâu, không cho game "nhảy cóc" một lúc. */
export const MAX_DT = 0.1;

export interface LoopDeps {
  raf: (cb: (t: number) => void) => number;
  caf: (id: number) => void;
}

export interface LoopHooks {
  update: (dt: number) => void;
  render: () => void;
  /** Gọi sau render mỗi frame, nhận thời lượng frame (ms) — dùng cho overlay đo hiệu năng. */
  afterFrame?: (frameMs: number, now: number) => void;
}

export interface Loop {
  start(): void;
  stop(): void;
  readonly running: boolean;
}

// Bọc trong arrow function: gọi `requestAnimationFrame` tách khỏi `window` (deps.raf(...))
// làm trình duyệt ném "Illegal invocation". Lỗi này đã gặp khi chạy thử trên Chromium ngày 08/10.
const defaultDeps = (): LoopDeps => ({
  raf: (cb) => requestAnimationFrame(cb),
  caf: (id) => cancelAnimationFrame(id),
});

export function createLoop(hooks: LoopHooks, deps: LoopDeps = defaultDeps()): Loop {
  let id = 0;
  let running = false;
  let last = -1;

  const frame = (t: number): void => {
    if (!running) return;
    // Frame đầu sau khi start: dt = 0 (không biết frame trước ở đâu).
    const frameMs = last < 0 ? 0 : t - last;
    const dt = Math.min(MAX_DT, Math.max(0, frameMs / 1000));
    last = t;
    hooks.update(dt);
    hooks.render();
    if (frameMs > 0) hooks.afterFrame?.(frameMs, t);
    id = deps.raf(frame);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = -1;
      id = deps.raf(frame);
    },
    stop() {
      running = false;
      deps.caf(id);
    },
    get running() {
      return running;
    },
  };
}
