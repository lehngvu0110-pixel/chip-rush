import './ui/styles.css';
import { versionLabel } from './config';
import { createLoop } from './loop';
import type { Scene } from './scene';
import { createSurface } from './render/canvas';
import { createAudio } from './render/audio';
import { attachPointer } from './input/pointer';
import { createSafeStorage } from './platform/storage';
import { watchVisibility } from './platform/visibility';
import { installGlobalErrorHandlers, showErrorScreen } from './platform/errors';
import { FrameStats, QUALITY_WINDOW, decideQuality } from './debug/stats';
import { createPerfOverlay } from './debug/perf-overlay';
import { SandboxScene } from './debug/sandbox-scene';

// Điểm vào của game. Hub thật làm ngày 22/10; hiện CHƠI NGAY mở màn THỬ NGHIỆM KỸ THUẬT
// để đo hiệu năng trên điện thoại (xem docs/TESTING.md).

interface Settings {
  muted: boolean;
  reducedMotion: boolean;
}
const SAVE_KEY = 'chiprush.v1';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function boot(root: HTMLElement): void {
  const ui = el('div', 'ui');
  const stage = el('div', 'stage');
  root.append(stage, ui);

  // 1. Lỗi chết → màn hình lỗi (cài sớm nhất có thể; vòng lặp tạo sau nên dừng qua biến)
  let stopLoop = (): void => {};
  installGlobalErrorHandlers(window, versionLabel(), (r) => {
    // Màn hình lỗi phải hiện kể cả khi việc dừng vòng lặp cũng hỏng.
    try {
      stopLoop();
    } catch {
      /* bỏ qua */
    }
    showErrorScreen(ui, r);
  });

  // 2. Lưu trữ + cài đặt
  const storage = createSafeStorage();
  const save = storage.get<{ settings?: Partial<Settings> }>(SAVE_KEY, {});
  const settings: Settings = { muted: false, reducedMotion: false, ...save.settings };
  const persistSettings = (): void => {
    const cur = storage.get<Record<string, unknown>>(SAVE_KEY, {});
    storage.set(SAVE_KEY, { ...cur, version: 1, settings });
  };
  const toast = (msg: string): void => {
    const t = el('div', 'toast', msg);
    t.setAttribute('role', 'status');
    ui.append(t);
    setTimeout(() => t.remove(), 5000);
  };
  storage.onPersistenceLost(() => toast('Tiến độ không lưu được trên trình duyệt này.'));

  // 3. Canvas, âm thanh, vòng lặp
  const surface = createSurface(stage);
  surface.reducedMotion ||= settings.reducedMotion;
  const audio = createAudio(undefined, settings.muted);
  const stats = new FrameStats();
  let scene: Scene | null = null;
  let pendingInputTs = -1;
  let warmup = 0;

  const loop = createLoop({
    update: (dt) => scene?.update(dt),
    render: () => scene?.render(surface),
    afterFrame: (frameMs) => {
      stats.addFrame(frameMs);
      if (pendingInputTs >= 0) {
        stats.addLatency(performance.now() - pendingInputTs);
        pendingInputTs = -1;
      }
      // Tự tắt glow nếu máy không theo kịp (bỏ qua 2 giây đầu vì lúc tải hay giật).
      if (++warmup > QUALITY_WINDOW && warmup % 60 === 0) {
        const q = decideQuality(surface.quality, stats.summary(QUALITY_WINDOW));
        if (q !== surface.quality) surface.quality = q;
      }
    },
  });

  stopLoop = () => loop.stop();

  attachPointer(surface.canvas, (p) => {
    if (p.phase === 'down') pendingInputTs = p.timeStamp;
    scene?.onPointer?.(p);
  });

  // 4. Tạm dừng khi rời đi
  const pausePanel = el('div', 'panel pause-panel');
  pausePanel.hidden = true;
  pausePanel.append(el('p', 'subtitle', 'Đã tạm dừng'));
  const resumeBtn = el('button', 'btn', 'Tiếp tục');
  resumeBtn.type = 'button';
  pausePanel.append(resumeBtn);
  ui.append(pausePanel);
  resumeBtn.addEventListener('click', () => {
    pausePanel.hidden = true;
    scene?.resume?.();
  });
  watchVisibility({
    doc: document,
    win: window,
    onPause: (reason) => {
      if (!scene) return;
      scene.pause?.();
      pausePanel.hidden = false;
      if (reason === 'hidden') loop.stop();
    },
    onVisible: () => {
      if (scene) loop.start(); // vẫn ở trạng thái dừng, chờ người chơi bấm Tiếp tục
    },
  });

  // 5. Màn bắt đầu
  const start = el('div', 'panel start-panel');
  const playBtn = el('button', 'btn btn-primary', 'CHƠI NGAY');
  playBtn.type = 'button';
  start.append(
    el('h1', 'title', 'CHIP RUSH'),
    el('p', 'subtitle', 'Thiết kế · Kiểm thử · Vận hành'),
    playBtn,
    el('p', 'note', 'Bản thử nghiệm kỹ thuật: chạm hoặc kéo trên lưới.'),
    el('p', 'version', versionLabel()),
  );
  ui.append(start);

  // 6. Thanh trên: tắt tiếng + tải nặng
  const hud = el('div', 'hud');
  hud.hidden = true;
  const muteBtn = el('button', 'btn btn-small', settings.muted ? 'Bật tiếng' : 'Tắt tiếng');
  muteBtn.type = 'button';
  muteBtn.setAttribute('aria-pressed', String(settings.muted));
  const heavyBtn = el('button', 'btn btn-small', 'Tải nặng: tắt');
  heavyBtn.type = 'button';
  hud.append(muteBtn, heavyBtn);
  ui.append(hud);
  muteBtn.addEventListener('click', () => {
    audio.muted = settings.muted = !settings.muted;
    muteBtn.textContent = settings.muted ? 'Bật tiếng' : 'Tắt tiếng';
    muteBtn.setAttribute('aria-pressed', String(settings.muted));
    persistSettings();
  });

  playBtn.addEventListener('click', () => {
    // Mở khóa âm thanh NGAY trong thao tác chạm (yêu cầu iOS); không chờ kết quả để không chậm.
    void audio.unlock();
    const sandbox = new SandboxScene(audio);
    heavyBtn.addEventListener('click', () => {
      sandbox.heavy = !sandbox.heavy;
      heavyBtn.textContent = `Tải nặng: ${sandbox.heavy ? 'bật' : 'tắt'}`;
    });
    scene = sandbox;
    sandbox.enter(surface);
    start.remove();
    hud.hidden = false;
    loop.start();
  });

  // 7. Công cụ dev
  const params = new URLSearchParams(location.search);
  if (params.has('debug')) {
    createPerfOverlay(ui, stats, {
      version: versionLabel(),
      quality: () => surface.quality,
      size: () => `${Math.round(surface.width)}×${Math.round(surface.height)} @${window.devicePixelRatio}x`,
    });
  }
  if (import.meta.env.DEV && params.has('crash')) {
    setTimeout(() => {
      throw new Error('Lỗi thử nghiệm (?crash=1)');
    }, 500);
  }
}

const root = document.getElementById('app');
if (root) boot(root);
