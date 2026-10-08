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
import { designUnlocked, loadSave, recordDesign, recordRuntimeScore, writeSave } from './core/progress';
import { DESIGN_LEVELS } from './core/level/design-levels';
import type { DesignLevel } from './core/level/types';
import { DesignScene } from './modes/design/design-scene';
import { ICON_STAR } from './ui/icons';
import { vnDateSeed } from './core/util/rng';
import { FrameStats, QUALITY_WINDOW, decideQuality } from './debug/stats';
import { createPerfOverlay } from './debug/perf-overlay';
import { SandboxScene } from './debug/sandbox-scene';
import { RuntimeGame, type RuntimeMode, type RuntimeResult } from './modes/runtime/game';
import { GATE_HINT, RuntimeScene, layoutRuntime } from './modes/runtime/runtime-scene';
import { TitleScene } from './modes/title/title-scene';
import { ICON_PAUSE, ICON_SOUND_OFF, ICON_SOUND_ON, LOGO_SVG } from './ui/icons';

// Điểm vào của game. Hub thật (hình die chip, 3 chế độ) làm ngày 22/10;
// hiện màn bắt đầu có: CHƠI NGAY (VẬN HÀNH – Vô tận), Thử thách 60 giây, và màn đo hiệu năng.

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text);
  b.type = 'button';
  return b;
}

function boot(root: HTMLElement): void {
  const ui = el('div', 'ui');
  const stage = el('div', 'stage');
  root.append(stage, ui);
  const params = new URLSearchParams(location.search);

  // 1. Lỗi chết → màn hình lỗi (cài sớm nhất; vòng lặp tạo sau nên dừng qua biến)
  let stopLoop = (): void => {};
  installGlobalErrorHandlers(window, versionLabel(), (r) => {
    try {
      stopLoop();
    } catch {
      /* màn hình lỗi vẫn phải hiện */
    }
    showErrorScreen(ui, r);
  });

  // 2. Lưu trữ
  const toast = (msg: string): void => {
    const t = el('div', 'toast', msg);
    t.setAttribute('role', 'status');
    ui.append(t);
    setTimeout(() => t.remove(), 5000);
  };
  const storage = createSafeStorage();
  const { data: save, wasReset } = loadSave(storage);
  if (wasReset) toast('Dữ liệu lưu cũ không đọc được nên đã được đặt lại.');
  storage.onPersistenceLost(() => toast('Tiến độ không lưu được trên trình duyệt này.'));
  const persist = (): void => void writeSave(storage, save);

  // 3. Canvas, âm thanh, vòng lặp
  const surface = createSurface(stage);
  surface.reducedMotion ||= save.settings.reducedMotion;
  const audio = createAudio(undefined, save.settings.muted);
  const stats = new FrameStats();
  let scene: Scene | null = null;
  let pendingInputTs = -1;
  let warmup = 0;

  const loop = createLoop({
    update: (dt) => scene?.update(dt),
    render: () => {
      // canvas chính trong suốt (nền nằm ở lớp backdrop) nên xoá mỗi frame
      surface.ctx.clearRect(0, 0, surface.width, surface.height);
      scene?.render(surface);
    },
    afterFrame: (frameMs) => {
      stats.addFrame(frameMs);
      if (pendingInputTs >= 0) {
        stats.addLatency(performance.now() - pendingInputTs);
        pendingInputTs = -1;
      }
      // Tự tắt glow nếu máy không theo kịp (bỏ qua 2 giây đầu vì lúc tải hay giật).
      if (++warmup > QUALITY_WINDOW && warmup % 60 === 0) {
        surface.quality = decideQuality(surface.quality, stats.summary(QUALITY_WINDOW));
        // Máy không theo kịp: ẩn luôn lớp nền bo mạch. Đo trên Chromium chạy đồ hoạ bằng CPU,
        // ghép 2 lớp canvas toàn màn hình chiếm khoảng nửa thời gian mỗi frame (ADR-0006).
        surface.backdrop.style.visibility = surface.quality === 'low' ? 'hidden' : '';
      }
    },
  });
  stopLoop = () => loop.stop();

  attachPointer(surface.canvas, (p) => {
    if (p.phase === 'down') pendingInputTs = p.timeStamp;
    scene?.onPointer?.(p);
  });

  const setScene = (next: Scene | null): void => {
    scene?.exit?.();
    scene = next;
    if (next) {
      next.enter?.(surface);
      loop.start();
    } else {
      loop.stop();
    }
  };

  // 4. Thanh trên: tạm dừng + tắt tiếng (+ tải nặng ở màn đo hiệu năng)
  const hud = el('div', 'hud');
  hud.hidden = true;
  const pauseBtn = button('btn-icon', '');
  pauseBtn.innerHTML = ICON_PAUSE;
  pauseBtn.setAttribute('aria-label', 'Tạm dừng');
  const muteBtn = button('btn-icon', '');
  const syncMute = (): void => {
    muteBtn.innerHTML = save.settings.muted ? ICON_SOUND_OFF : ICON_SOUND_ON;
    muteBtn.setAttribute('aria-label', save.settings.muted ? 'Bật tiếng' : 'Tắt tiếng');
    muteBtn.setAttribute('aria-pressed', String(save.settings.muted));
  };
  syncMute();
  const heavyBtn = button('btn-small', 'Tải nặng: tắt');
  heavyBtn.hidden = true;
  hud.append(pauseBtn, muteBtn, heavyBtn);
  ui.append(hud);
  muteBtn.addEventListener('click', () => {
    audio.muted = save.settings.muted = !save.settings.muted;
    syncMute();
    persist();
  });

  // 5. Tạm dừng (nút Dừng, ẩn tab, blur, xoay màn hình)
  const pausePanel = el('div', 'panel pause-panel');
  pausePanel.hidden = true;
  const resumeBtn = button('btn-primary', 'Tiếp tục');
  const quitBtn = button('btn-secondary', 'Về màn chính');
  const pauseCard = el('div', 'card');
  pauseCard.append(el('p', 'card-title', 'Đã tạm dừng'), resumeBtn, quitBtn);
  pausePanel.append(pauseCard);
  ui.append(pausePanel);
  const doPause = (): void => {
    // Chỉ màn chơi có pause() mới hiện bảng tạm dừng (màn bắt đầu thì không)
    if (!scene?.pause || !resultPanel.hidden) return;
    scene.pause?.();
    pausePanel.hidden = false;
    resumeBtn.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };
  pauseBtn.addEventListener('click', doPause);
  resumeBtn.addEventListener('click', () => {
    pausePanel.hidden = true;
    scene?.resume?.();
  });
  quitBtn.addEventListener('click', () => {
    pausePanel.hidden = true;
    showStart();
  });
  watchVisibility({
    doc: document,
    win: window,
    onPause: (reason) => {
      doPause();
      if (reason === 'hidden') loop.stop();
    },
    onVisible: () => {
      if (scene) loop.start(); // game vẫn dừng, chờ người chơi bấm Tiếp tục
    },
  });

  // 6. Màn kết quả
  const resultPanel = el('div', 'panel result-panel');
  resultPanel.hidden = true;
  resultPanel.setAttribute('role', 'dialog');
  resultPanel.setAttribute('aria-label', 'Kết quả');
  ui.append(resultPanel);
  let lastMode: RuntimeMode = 'endless';

  const showResult = (r: RuntimeResult): void => {
    const isRecord = recordRuntimeScore(save, r.mode, r.score);
    persist();
    const best = r.mode === 'endless' ? save.runtime.bestEndless : save.runtime.best60;
    resultPanel.replaceChildren();
    const card = el('div', 'card');
    resultPanel.append(card);
    card.append(el('h2', 'result-title', r.mode === 'endless' ? 'Hết mạng!' : 'Hết giờ!'));
    const score = el('p', 'result-score', String(r.score));
    score.setAttribute('aria-label', `Điểm ${r.score}`);
    card.append(score);
    card.append(el('p', isRecord && r.score > 0 ? 'result-record' : 'subtitle', isRecord && r.score > 0 ? 'Kỷ lục mới!' : `Kỷ lục: ${best}`));
    const statsList = el('ul', 'result-stats');
    const li = (k: string, v: string): void => {
      const item = el('li', '');
      item.append(el('span', '', k), el('strong', '', v));
      statsList.append(item);
    };
    li('Độ chính xác', `${Math.round(r.accuracy * 100)}% (${r.correct}/${r.answered})`);
    li('Chuỗi đúng dài nhất', String(r.bestCombo));
    card.append(statsList);
    if (r.weakest) {
      // Giải thích độ khó thích nghi (SPEC 5.4): người chơi biết vì sao game ra nhiều câu loại đó
      card.append(
        el('p', 'note', `Bạn hay sai cổng ${r.weakest.gate} (${GATE_HINT[r.weakest.gate] ?? ''}) nên game đã ra thêm câu ${r.weakest.gate} để bạn luyện.`),
      );
    }
    const again = button('btn-primary', 'Chơi lại');
    const home = button('btn-secondary', 'Về màn chính');
    again.addEventListener('click', () => startRuntime(lastMode));
    home.addEventListener('click', showStart);
    card.append(again, home);
    resultPanel.hidden = false;
    hud.hidden = true;
    // Đưa focus vào nút chính cho người dùng bàn phím/trình đọc màn hình, không vẽ viền focus khi chạm
    again.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  // 7. Màn bắt đầu
  const start = el('div', 'panel start-panel');
  ui.append(start);

  const startRuntime = (mode: RuntimeMode): void => {
    lastMode = mode;
    // Mở khóa âm thanh NGAY trong thao tác chạm (yêu cầu iOS); không chờ để không chậm.
    void audio.unlock();
    // 60 giây: seed theo ngày (cả nước cùng chuỗi gói); Vô tận: ngẫu nhiên. ?seed= để test tái lập.
    const seedParam = Number(params.get('seed'));
    const seed = Number.isFinite(seedParam) && params.has('seed') ? seedParam : mode === 'sixty' ? vnDateSeed() : (Math.random() * 2 ** 32) >>> 0;
    const game = new RuntimeGame(mode, seed);
    exposeForTests(game);
    start.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = false;
    heavyBtn.hidden = true;
    setScene(new RuntimeScene(game, audio, showResult));
  };

  // 7b. THIẾT KẾ: danh sách màn → màn chơi → thẻ kết quả
  const levelPanel = el('div', 'panel level-panel');
  levelPanel.hidden = true;
  ui.append(levelPanel);
  const levelIds = DESIGN_LEVELS.map((l) => l.id);
  const starsEl = (n: number, label: string): HTMLSpanElement => {
    const span = el('span', 'stars');
    span.setAttribute('aria-label', label);
    for (let i = 0; i < 3; i++) {
      const s = el('span', i < n ? 'star on' : 'star');
      s.innerHTML = ICON_STAR;
      span.append(s);
    }
    return span;
  };

  const showLevels = (): void => {
    setScene(new TitleScene());
    start.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = true;
    levelPanel.replaceChildren();
    const card = el('div', 'card level-card');
    card.append(el('p', 'card-title', 'THIẾT KẾ'), el('p', 'note', 'Vẽ mạch đúng bảng chân trị. Chi phí càng thấp càng nhiều sao; thử vượt AI kỹ sư!'));
    const list = el('div', 'level-list');
    DESIGN_LEVELS.forEach((lv, i) => {
      const open = designUnlocked(save, levelIds, i);
      const rec = save.design[lv.id];
      const b = button('level-item', '');
      b.disabled = !open;
      const head = el('span', 'level-head');
      head.append(el('strong', '', `${lv.id.toUpperCase()} · ${lv.name}`), el('small', '', open ? lv.concept : 'Qua màn trước để mở'));
      b.append(head, starsEl(rec?.stars ?? 0, `${rec?.stars ?? 0} sao`));
      b.setAttribute('aria-label', `${lv.id} ${lv.name}${open ? '' : ', chưa mở'}, ${rec?.stars ?? 0} sao`);
      b.addEventListener('click', () => startDesign(lv));
      list.append(b);
    });
    const back = button('btn-secondary', 'Về màn chính');
    back.addEventListener('click', showStart);
    card.append(list, back);
    levelPanel.append(card);
    levelPanel.hidden = false;
  };

  const startDesign = (lv: DesignLevel): void => {
    void audio.unlock();
    exposeForTests(null);
    start.hidden = true;
    levelPanel.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = false;
    heavyBtn.hidden = true;
    setScene(new DesignScene(lv, { ui, audio, onPass: showDesignResult }));
  };

  const showDesignResult = (lv: DesignLevel, r: { ppa: { A: number; D: number; P: number; C: number }; par: { A: number; D: number; P: number; C: number }; stars: number; score: number }): void => {
    if (!(scene instanceof DesignScene) || scene.level.id !== lv.id) return; // người chơi đã rời màn
    const improved = recordDesign(save, lv.id, r.ppa, r.stars);
    persist();
    resultPanel.replaceChildren();
    const card = el('div', 'card');
    card.append(el('h2', 'result-title', 'Qua màn!'), starsEl(r.stars, `${r.stars} trên 3 sao`));
    const score = el('p', 'result-score', String(r.score));
    score.setAttribute('aria-label', `Điểm ${r.score}`);
    card.append(score, el('p', 'note', r.score > 1000 ? 'Bạn thiết kế tốt hơn AI kỹ sư!' : r.score === 1000 ? 'Ngang AI kỹ sư. 1000 = bằng AI.' : 'AI kỹ sư đạt 1000. Thử tối ưu tiếp?'));
    const tbl = el('table', 'ppa-table');
    const tr = (cells: string[], th = false): void => {
      const row = el('tr', '');
      for (const c of cells) row.append(el(th ? 'th' : 'td', '', c));
      tbl.append(row);
    };
    tr(['', 'Bạn', 'AI kỹ sư'], true);
    tr(['Area (ô)', String(r.ppa.A), String(r.par.A)]);
    tr(['Delay (tầng cổng)', String(r.ppa.D), String(r.par.D)]);
    tr(['Power (lần đổi bit)', String(r.ppa.P), String(r.par.P)]);
    tr(['Chi phí C', String(r.ppa.C), String(r.par.C)]);
    card.append(tbl);
    if (improved) card.append(el('p', 'result-record', 'Kết quả tốt nhất của bạn!'));
    const idx = levelIds.indexOf(lv.id);
    const next = DESIGN_LEVELS[idx + 1];
    if (next) {
      const nb = button('btn-primary', 'Màn tiếp');
      nb.addEventListener('click', () => startDesign(next));
      card.append(nb);
    }
    const again = button('', 'Tối ưu tiếp');
    again.addEventListener('click', () => {
      resultPanel.hidden = true;
      hud.hidden = false;
    });
    const list = button('btn-secondary', 'Danh sách màn');
    list.addEventListener('click', showLevels);
    card.append(again, list);
    resultPanel.append(card);
    resultPanel.hidden = false;
    hud.hidden = true;
    (card.querySelector('.btn-primary') as HTMLButtonElement | null)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  const showStart = (): void => {
    setScene(new TitleScene());
    levelPanel.hidden = true;
    hud.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    start.replaceChildren();
    const play = button('btn-primary', 'CHƠI NGAY');
    const sixty = button('', 'Thử thách 60 giây');
    // Màn đo hiệu năng chỉ dành cho nhóm phát triển: chỉ hiện khi URL có ?debug=1
    const perf = button('btn-link', 'Đo hiệu năng (dành cho nhóm phát triển)');
    perf.hidden = !params.has('debug');
    play.addEventListener('click', () => startRuntime('endless'));
    sixty.addEventListener('click', () => startRuntime('sixty'));
    perf.addEventListener('click', () => {
      void audio.unlock();
      const sandbox = new SandboxScene(audio);
      heavyBtn.hidden = false;
      heavyBtn.onclick = () => {
        sandbox.heavy = !sandbox.heavy;
        heavyBtn.textContent = `Tải nặng: ${sandbox.heavy ? 'bật' : 'tắt'}`;
      };
      start.hidden = true;
      hud.hidden = false;
      setScene(sandbox);
    });
    const logo = el('div', 'logo');
    logo.innerHTML = LOGO_SVG;
    const hero = el('div', 'hero');
    hero.append(logo, el('h1', 'title', 'CHIP RUSH'), el('p', 'subtitle', 'Thiết kế · Kiểm thử · Vận hành'));
    const menu = el('div', 'menu');
    const design = button('', 'THIẾT KẾ: tự vẽ mạch');
    design.addEventListener('click', showLevels);
    menu.append(
      play,
      el('p', 'note', 'VẬN HÀNH: cắm đúng cổng logic để con chip cho ra bit mục tiêu, trước khi nó chạm ổ cắm.'),
      sixty,
      design,
    );
    start.append(
      hero,
      menu,
      el('p', 'records', `Kỷ lục: Vô tận ${save.runtime.bestEndless} · 60 giây ${save.runtime.best60}`),
      perf,
      el('p', 'version', versionLabel()),
    );
    start.hidden = false;
  };

  // Móc cho test tự động (Playwright) đọc trạng thái — chỉ khi URL có ?e2e hoặc ?debug.
  let testGame: RuntimeGame | null = null;
  function exposeForTests(game: RuntimeGame | null): void {
    testGame = game;
  }
  if (params.has('e2e') || params.has('debug')) {
    (window as unknown as { __CHIPRUSH__: unknown }).__CHIPRUSH__ = {
      runtime: () => {
        const game = testGame;
        if (!game) return null;
        return {
          mode: game.mode,
          score: game.score,
          lives: game.lives,
          combo: game.combo,
          ended: game.ended,
          paused: game.paused,
          unlocked: [...game.unlocked],
          validGates: [...game.packet.validGates],
          packet: { a: game.packet.a, b: game.packet.b, target: game.packet.target },
          fall: game.fall,
          timeLeft: game.timeLeft,
        };
      },
      // vị trí 4 nút cổng (CSS px) để test bấm bằng chạm thật lên canvas
      buttons: () => layoutRuntime(surface.width, surface.height).buttons,
      // màn THIẾT KẾ: id màn, toạ độ tâm ô, đầu vào hiện tại
      design: () =>
        scene instanceof DesignScene
          ? { level: scene.level.id, tool: scene.tool, layer: scene.layer, inputs: [...scene.inputs], wires: scene.grid.wires().length, cell: (c: number, r: number) => (scene as DesignScene).cellCenter(c, r) }
          : null,
    };
  }

  showStart();

  // 8. Công cụ dev
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
