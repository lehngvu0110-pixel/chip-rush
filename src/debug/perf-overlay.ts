// Overlay đo hiệu năng, chỉ hiện khi URL có ?debug=1. Dùng để điền docs/TESTING.md:
// bấm "Đo 60 s", chơi/vẽ liên tục, rồi "Sao chép" kết quả.
import type { FrameStats } from './stats';

export interface OverlayInfo {
  version: string;
  quality: () => string;
  size: () => string;
}

const MEASURE_MS = 60_000;

export function createPerfOverlay(host: HTMLElement, stats: FrameStats, info: OverlayInfo): void {
  const box = document.createElement('div');
  box.className = 'perf-overlay';
  const text = document.createElement('pre');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-small';
  btn.textContent = 'Đo 60 s';
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'btn btn-small';
  copy.textContent = 'Sao chép';
  copy.hidden = true;
  box.append(text, btn, copy);
  host.append(box);

  let measuring = false;
  let endAt = 0;
  let lastResult = '';

  const fmt = (n: number | null): string => (n === null || Number.isNaN(n) ? '—' : n.toFixed(1));

  const refresh = (): void => {
    const s = stats.summary();
    const left = measuring ? ` · còn ${Math.ceil((endAt - performance.now()) / 1000)} s` : '';
    text.textContent =
      `${info.version}${left}\n` +
      `frame trung vị ${fmt(s.medianMs)} ms · p95 ${fmt(s.p95Ms)} ms · ${fmt(s.fps)} fps\n` +
      `trễ chạm p95 ${fmt(s.latencyP95Ms)} ms (${s.latencySamples} lần)\n` +
      `chất lượng ${info.quality()} · ${info.size()}`;
    if (measuring && performance.now() >= endAt) {
      measuring = false;
      btn.textContent = 'Đo 60 s';
      lastResult = JSON.stringify(
        {
          version: info.version,
          userAgent: navigator.userAgent,
          durationS: 60,
          frames: s.frames,
          medianMs: +s.medianMs.toFixed(2),
          p95Ms: +s.p95Ms.toFixed(2),
          fps: +s.fps.toFixed(1),
          latencyP95Ms: s.latencyP95Ms === null ? null : +s.latencyP95Ms.toFixed(1),
          latencySamples: s.latencySamples,
          quality: info.quality(),
          size: info.size(),
        },
        null,
        1,
      );
      copy.hidden = false;
    }
  };

  btn.addEventListener('click', () => {
    stats.reset();
    measuring = true;
    endAt = performance.now() + MEASURE_MS;
    btn.textContent = 'Đang đo…';
    copy.hidden = true;
  });
  copy.addEventListener('click', () => {
    navigator.clipboard?.writeText(lastResult).then(
      () => (copy.textContent = 'Đã sao chép'),
      () => window.prompt('Sao chép kết quả:', lastResult),
    );
  });

  // Cập nhật chữ 2 lần/giây để bản thân overlay không làm giật game.
  setInterval(refresh, 500);
  refresh();
}
