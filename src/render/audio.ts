// Âm thanh tổng hợp bằng Web Audio (không có file âm thanh → không rủi ro bản quyền, không tốn dung lượng).
// iOS/Safari chỉ cho phát âm thanh sau một thao tác của người dùng: `unlock()` PHẢI được gọi
// bên trong handler của lần chạm đầu (nút CHƠI NGAY). Lưu ý: gạt im lặng trên iPhone có thể tắt
// Web Audio, nên game không bao giờ truyền thông tin chỉ bằng âm thanh.

export type SoundName = 'tick' | 'ting' | 'error' | 'place' | 'probe' | 'win' | 'lose' | 'unlock';

/** Phần nhỏ của AudioContext mà game dùng — để test được bằng đối tượng giả. */
export interface MiniAudioContext {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createOscillator(): {
    type: string;
    frequency: { setValueAtTime(v: number, t: number): void };
    connect(n: unknown): unknown;
    start(t: number): void;
    stop(t: number): void;
  };
  createGain(): {
    gain: { setValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void };
    connect(n: unknown): unknown;
  };
}

export interface GameAudio {
  /** Gọi trong handler chạm/bấm. An toàn khi gọi nhiều lần. */
  unlock(): Promise<void>;
  play(name: SoundName): void;
  muted: boolean;
  /** false nếu trình duyệt không có Web Audio hoặc tạo context lỗi — game vẫn chạy, chỉ im lặng. */
  readonly available: boolean;
  readonly unlocked: boolean;
}

interface Note {
  wave: string;
  freq: number;
  at: number; // giây, tính từ lúc phát
  dur: number;
}

const SOUNDS: Record<SoundName, Note[]> = {
  tick: [{ wave: 'square', freq: 1200, at: 0, dur: 0.03 }],
  ting: [
    { wave: 'sine', freq: 880, at: 0, dur: 0.12 },
    { wave: 'sine', freq: 1320, at: 0.08, dur: 0.18 },
  ],
  error: [{ wave: 'triangle', freq: 160, at: 0, dur: 0.2 }],
  // đặt cổng/via: tiếng "cạch" trầm
  place: [
    { wave: 'square', freq: 320, at: 0, dur: 0.04 },
    { wave: 'triangle', freq: 210, at: 0.03, dur: 0.07 },
  ],
  // que đo chạm dây: "bíp" cao ngắn
  probe: [
    { wave: 'sine', freq: 1500, at: 0, dur: 0.05 },
    { wave: 'sine', freq: 2000, at: 0.05, dur: 0.06 },
  ],
  // qua màn: hợp âm rải Đô trưởng (C5 E5 G5 C6)
  win: [
    { wave: 'sine', freq: 523, at: 0, dur: 0.14 },
    { wave: 'sine', freq: 659, at: 0.09, dur: 0.14 },
    { wave: 'sine', freq: 784, at: 0.18, dur: 0.16 },
    { wave: 'sine', freq: 1046, at: 0.28, dur: 0.3 },
  ],
  // thua: đi xuống
  lose: [
    { wave: 'triangle', freq: 330, at: 0, dur: 0.16 },
    { wave: 'triangle', freq: 247, at: 0.14, dur: 0.16 },
    { wave: 'triangle', freq: 165, at: 0.28, dur: 0.3 },
  ],
  // mở khoá cổng mới
  unlock: [
    { wave: 'sine', freq: 660, at: 0, dur: 0.08 },
    { wave: 'sine', freq: 880, at: 0.07, dur: 0.08 },
    { wave: 'sine', freq: 1320, at: 0.14, dur: 0.16 },
  ],
};

const VOLUME = 0.15;

function defaultFactory(): MiniAudioContext | null {
  const w = globalThis as unknown as { AudioContext?: new () => MiniAudioContext; webkitAudioContext?: new () => MiniAudioContext };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  return Ctor ? new Ctor() : null;
}

export function createAudio(factory: () => MiniAudioContext | null = defaultFactory, initiallyMuted = false): GameAudio {
  let ctx: MiniAudioContext | null = null;
  let failed = false;
  let unlocked = false;

  const playNotes = (c: MiniAudioContext, notes: Note[], volume: number): void => {
    const t0 = c.currentTime;
    for (const n of notes) {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = n.wave;
      osc.frequency.setValueAtTime(n.freq, t0 + n.at);
      // Bao biên nhanh để không có tiếng "bụp" ở đầu/cuối nốt
      gain.gain.setValueAtTime(volume, t0 + n.at);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + n.at + n.dur);
      osc.connect(gain);
      gain.connect(c.destination);
      osc.start(t0 + n.at);
      osc.stop(t0 + n.at + n.dur + 0.02);
    }
  };

  const audio: GameAudio = {
    muted: initiallyMuted,
    async unlock() {
      if (unlocked || failed) return;
      try {
        // Tạo context NGAY trong thao tác người dùng (yêu cầu của iOS).
        ctx ??= factory();
        if (!ctx) {
          failed = true;
          return;
        }
        // Phát một nốt gần như im lặng trong cùng thao tác: cách mở khóa chắc chắn trên iOS cũ.
        playNotes(ctx, [{ wave: 'sine', freq: 440, at: 0, dur: 0.01 }], 0.0001);
        if (ctx.state !== 'running') await ctx.resume();
        unlocked = true;
      } catch {
        failed = true; // không có âm thanh vẫn chơi được
      }
    },
    play(name) {
      if (audio.muted || !unlocked || !ctx) return;
      try {
        playNotes(ctx, SOUNDS[name], VOLUME);
      } catch {
        /* bỏ qua: lỗi âm thanh không được làm hỏng game */
      }
    },
    get available() {
      return !failed;
    },
    get unlocked() {
      return unlocked;
    },
  };
  return audio;
}
