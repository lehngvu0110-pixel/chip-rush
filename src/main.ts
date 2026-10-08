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
import { debugUnlocked, defaultSave, designUnlocked, loadSave, recordDebug, recordDesign, recordRuntimeScore, writeSave } from './core/progress';
import { DEBUG_LEVELS } from './core/level/debug-levels';
import type { DebugLevel } from './core/level/types';
import { DebugScene, type DebugResult } from './modes/debug/debug-scene';
import { DESIGN_LEVELS } from './core/level/design-levels';
import type { DesignLevel } from './core/level/types';
import { DesignScene } from './modes/design/design-scene';
import { ICON_GEAR, ICON_STAR } from './ui/icons';
import { gameUrl, shareResult } from './platform/share';
import { makeShareFile, type ShareCardData } from './render/share-card';
import { DIE_BLOCKS, HubScene, type BlockId } from './modes/hub/hub-scene';
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
  // giảm chuyển động = cài đặt hệ điều hành HOẶC cài đặt trong game
  const systemReduced = surface.reducedMotion;
  const applyMotion = (): void => {
    surface.reducedMotion = systemReduced || save.settings.reducedMotion;
    document.documentElement.classList.toggle('reduce-motion', surface.reducedMotion);
  };
  applyMotion();
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
    audio.play(isRecord && r.score > 0 ? 'win' : 'lose');
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
    const modeName = r.mode === 'endless' ? 'Vô tận' : 'Thử thách 60 giây';
    const share = shareButton(
      { mode: 'VẬN HÀNH', title: modeName, big: String(r.score), bigLabel: 'điểm', lines: [`Độ chính xác ${Math.round(r.accuracy * 100)}%`, `Chuỗi đúng dài nhất ${r.bestCombo}`], badge: isRecord && r.score > 0 ? 'Kỷ lục mới!' : undefined },
      `Mình đạt ${r.score} điểm ở chế độ VẬN HÀNH (${modeName}) của CHIP RUSH — game về vi mạch. Ai vượt được không?`,
    );
    card.append(again, share, home);
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
      s.style.setProperty('--i', String(i));
      s.innerHTML = ICON_STAR;
      span.append(s);
    }
    return span;
  };

  /**
   * Nút Chia sẻ: ảnh thẻ được tạo SẴN ngay khi hiện thẻ kết quả (iOS chỉ cho share() trong thao tác chạm,
   * không chờ được việc vẽ ảnh). Chưa kịp có ảnh thì vẫn chia sẻ chữ + link.
   */
  const shareButton = (data: Omit<ShareCardData, 'url'>, text: string): HTMLButtonElement => {
    const b = button('btn-share', 'Chia sẻ kết quả');
    let file: File | null = null;
    void makeShareFile({ ...data, url: gameUrl() }).then((f) => (file = f));
    b.addEventListener('click', () => {
      void shareResult({ title: 'CHIP RUSH', text, url: gameUrl(), file }).then((out) => {
        if (out === 'copied') toast('Đã sao chép lời mời kèm link — dán vào Zalo/Messenger nhé!');
        else if (out === 'unavailable') window.prompt('Sao chép lời mời này để gửi bạn bè:', `${text} ${gameUrl()}`);
      });
    });
    return b;
  };

  /** Số chạy từ 0 lên `to` trong 0,8 s (bỏ qua khi giảm chuyển động). Chỉ đổi chữ, nhãn aria giữ nguyên. */
  const countUp = (node: HTMLElement, to: number): void => {
    if (surface.reducedMotion || to <= 0) return;
    const t0 = performance.now();
    const tick = (now: number): void => {
      const k = Math.min(1, (now - t0) / 800);
      node.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1 && node.isConnected) requestAnimationFrame(tick);
    };
    node.textContent = '0';
    requestAnimationFrame(tick);
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
    // đã xem lời giải AI thì lần qua màn này không tính vào kết quả
    const counted = !scene.aiShown;
    const improved = counted && recordDesign(save, lv.id, r.ppa, r.stars, scene.hinted);
    if (counted) persist();
    resultPanel.replaceChildren();
    const card = el('div', 'card');
    card.append(el('h2', 'result-title', 'Qua màn!'), starsEl(r.stars, `${r.stars} trên 3 sao`));
    const score = el('p', 'result-score', String(r.score));
    score.setAttribute('aria-label', `Điểm ${r.score}`);
    countUp(score, r.score);
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
    if (counted && scene.hinted) card.append(el('p', 'note', 'Đã dùng gợi ý nên màn này tối đa 2 sao. Chơi lại không gợi ý để lấy đủ 3 sao!'));
    if (!counted) card.append(el('p', 'note', 'Bạn đã xem lời giải của AI kỹ sư nên lần này không tính vào kết quả. Tự vẽ lại để ghi sao nhé!'));
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
    const showAi = button('', 'Xem cách AI kỹ sư làm');
    showAi.addEventListener('click', () => {
      resultPanel.hidden = true;
      hud.hidden = false;
      if (scene instanceof DesignScene) scene.showAiSolution();
    });
    const list = button('btn-secondary', 'Danh sách màn');
    list.addEventListener('click', showLevels);
    const shareD = shareButton(
      {
        mode: 'THIẾT KẾ',
        title: `${lv.id.toUpperCase()} · ${lv.name}`,
        big: String(r.score),
        bigLabel: 'điểm (1000 = ngang AI kỹ sư)',
        stars: r.stars,
        lines: [`Chi phí ${r.ppa.C} · AI kỹ sư ${r.par.C}`, `Area ${r.ppa.A} · Delay ${r.ppa.D} · Power ${r.ppa.P}`],
        badge: r.score > 1000 ? 'Vượt AI kỹ sư!' : undefined,
      },
      `Mình thiết kế mạch "${lv.name}" (${lv.id.toUpperCase()}) đạt ${r.score} điểm, ${r.stars} sao trong CHIP RUSH${r.score > 1000 ? ' — vượt cả AI kỹ sư!' : ''}. Bạn thử vượt mình xem:`,
    );
    if (counted) card.append(shareD);
    card.append(again, showAi, list);
    resultPanel.append(card);
    resultPanel.hidden = false;
    hud.hidden = true;
    (card.querySelector('.btn-primary') as HTMLButtonElement | null)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  // 7c. KIỂM THỬ: danh sách màn → màn chơi → thẻ kết quả
  const debugIds = DEBUG_LEVELS.map((l) => l.id);
  const showDebugLevels = (): void => {
    setScene(new TitleScene());
    start.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = true;
    levelPanel.replaceChildren();
    const card = el('div', 'card level-card');
    card.append(el('p', 'card-title', 'KIỂM THỬ'), el('p', 'note', 'Chip vừa sản xuất có 1 lỗi ẩn. Đo càng ít lần càng nhiều sao; AI kỹ sư biết số lần đo ít nhất.'));
    const list = el('div', 'level-list');
    DEBUG_LEVELS.forEach((lv, i) => {
      const open = debugUnlocked(save, debugIds, i);
      const rec = save.debug[lv.id];
      const b = button('level-item', '');
      b.disabled = !open;
      const head = el('span', 'level-head');
      head.append(el('strong', '', `${lv.id.toUpperCase()} · ${lv.name}`), el('small', '', open ? lv.concept : i === 0 ? 'Qua màn THIẾT KẾ D05 để mở' : 'Qua màn trước để mở'));
      b.append(head, starsEl(rec?.stars ?? 0, `${rec?.stars ?? 0} sao`));
      b.setAttribute('aria-label', `${lv.id} ${lv.name}${open ? '' : ', chưa mở'}, ${rec?.stars ?? 0} sao`);
      b.addEventListener('click', () => startDebug(lv));
      list.append(b);
    });
    const back = button('btn-secondary', 'Về màn chính');
    back.addEventListener('click', showStart);
    card.append(list, back);
    levelPanel.append(card);
    levelPanel.hidden = false;
  };

  const startDebug = (lv: DebugLevel): void => {
    void audio.unlock();
    exposeForTests(null);
    start.hidden = true;
    levelPanel.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = false;
    heavyBtn.hidden = true;
    setScene(new DebugScene(lv, { ui, audio, onEnd: showDebugResult }));
  };

  const showDebugResult = (lv: DebugLevel, r: DebugResult): void => {
    if (!(scene instanceof DebugScene) || scene.level.id !== lv.id) return;
    const improved = r.win && recordDebug(save, lv.id, r.stars, r.probes);
    if (r.win) persist();
    resultPanel.replaceChildren();
    const card = el('div', 'card');
    card.append(el('h2', 'result-title', r.win ? 'Tìm ra lỗi!' : 'Chưa tìm ra lỗi'));
    if (r.win) {
      card.append(starsEl(r.stars, `${r.stars} trên 3 sao`));
      const n = el('p', 'result-score', String(r.probes));
      n.setAttribute('aria-label', `Số lần đo ${r.probes}`);
      card.append(n, el('p', 'note', `lần đo · AI kỹ sư cần ${r.par} lần (trường hợp xấu nhất)`));
    } else {
      card.append(el('p', 'note', r.reason ?? ''));
    }
    card.append(el('p', 'note', `Lỗi thật: ${r.answer}.${r.wrong ? ` Bạn đã báo sai ${r.wrong} lần.` : ''}`));
    if (improved) card.append(el('p', 'result-record', 'Kết quả tốt nhất của bạn!'));
    const idx = debugIds.indexOf(lv.id);
    const next = DEBUG_LEVELS[idx + 1];
    if (r.win && next) {
      const nb = button('btn-primary', 'Màn tiếp');
      nb.addEventListener('click', () => startDebug(next));
      card.append(nb);
    }
    const again = button(r.win ? '' : 'btn-primary', 'Chơi lại');
    again.addEventListener('click', () => startDebug(lv));
    const list = button('btn-secondary', 'Danh sách màn');
    list.addEventListener('click', showDebugLevels);
    if (r.win) {
      card.append(
        shareButton(
          { mode: 'KIỂM THỬ', title: `${lv.id.toUpperCase()} · ${lv.name}`, big: String(r.probes), bigLabel: 'lần đo để tìm ra lỗi', stars: r.stars, lines: [`AI kỹ sư cần ${r.par} lần (trường hợp xấu nhất)`, `Lỗi: ${r.answer}`], badge: r.probes < r.par ? 'Ít hơn AI kỹ sư!' : undefined },
          `Mình tìm ra lỗi chip ở màn ${lv.id.toUpperCase()} "${lv.name}" chỉ với ${r.probes} lần đo (AI kỹ sư cần ${r.par}) trong CHIP RUSH. Thử sức nhé:`,
        ),
      );
    }
    card.append(again, list);
    resultPanel.append(card);
    resultPanel.hidden = false;
    hud.hidden = true;
    (card.querySelector('.btn-primary') as HTMLButtonElement | null)?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  // 7d. Cài đặt + giới thiệu (nút bánh răng ở màn hình chính)
  const REPO_URL = 'https://github.com/lehngvu0110-pixel/chip-rush';
  const showSettings = (): void => {
    levelPanel.replaceChildren();
    const card = el('div', 'card level-card');
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-label', 'Cài đặt');
    card.append(el('p', 'card-title', 'Cài đặt'));
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void): HTMLButtonElement => {
      const b = button('setting', '');
      const sync = (): void => {
        b.textContent = `${label}: ${get() ? 'Bật' : 'Tắt'}`;
        b.setAttribute('aria-pressed', String(get()));
      };
      b.addEventListener('click', () => {
        set(!get());
        sync();
        persist();
      });
      sync();
      return b;
    };
    card.append(
      toggle('Âm thanh', () => !save.settings.muted, (v) => {
        save.settings.muted = !v;
        audio.muted = !v;
        syncMute();
        if (v) void audio.unlock().then(() => audio.play('ting'));
      }),
      toggle('Giảm chuyển động', () => save.settings.reducedMotion, (v) => {
        save.settings.reducedMotion = v;
        applyMotion();
      }),
    );
    if (systemReduced) card.append(el('p', 'note', 'Máy bạn đang bật "giảm chuyển động" trong cài đặt hệ thống, game luôn tôn trọng cài đặt đó.'));
    const about = el('div', 'about');
    about.append(
      el('p', 'note', 'CHIP RUSH: thiết kế, kiểm thử và vận hành một con chip. Dự thi Phần thi Công nghệ – Road to Predator League 2027.'),
      el('p', 'note', '"AI kỹ sư" là thuật toán tìm kiếm (branch-and-bound, PathFinder, minimax) tính trước và chạy ngay trên máy bạn; game không gửi dữ liệu đi đâu.'),
    );
    const link = el('a', 'repo-link', 'Mã nguồn trên GitHub');
    link.href = REPO_URL;
    link.target = '_blank';
    link.rel = 'noopener';
    about.append(link, el('p', 'version', versionLabel()));
    card.append(about);
    let armed = false;
    const reset = button('btn-danger', 'Xoá toàn bộ tiến độ');
    reset.addEventListener('click', () => {
      if (!armed) {
        armed = true;
        reset.textContent = 'Bấm lần nữa để XOÁ HẾT (không hoàn tác)';
        return;
      }
      const keep = save.settings;
      Object.assign(save, defaultSave(), { settings: keep });
      persist();
      toast('Đã xoá toàn bộ tiến độ.');
      showStart();
    });
    const close = button('btn-primary', 'Xong');
    close.addEventListener('click', showStart);
    card.append(reset, close);
    levelPanel.append(card);
    start.hidden = true;
    levelPanel.hidden = false;
    close.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
  };

  const showStart = (): void => {
    levelPanel.hidden = true;
    hud.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    start.replaceChildren();
    const play = button('btn-primary', 'CHƠI NGAY');
    const sixty = button('btn-secondary sixty', 'Thử thách 60 giây');
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
    const titleRow = el('div', 'title-row');
    titleRow.append(logo, el('h1', 'title', 'CHIP RUSH'));
    hero.append(titleRow, el('p', 'subtitle', 'Thiết kế · Kiểm thử · Vận hành'));

    // Die chip: 3 khối vẽ bằng canvas (HubScene), nút DOM trong suốt đặt đúng vị trí từng khối
    const stats = {
      designStars: Object.values(save.design).reduce((a, d) => a + (d?.stars ?? 0), 0),
      designMax: DESIGN_LEVELS.length * 3,
      debugStars: Object.values(save.debug).reduce((a, d) => a + (d?.stars ?? 0), 0),
      debugMax: DEBUG_LEVELS.length * 3,
      debugOpen: save.design.d05 !== undefined,
      bestEndless: save.runtime.bestEndless,
      best60: save.runtime.best60,
    };
    const slot = el('div', 'die-slot');
    const blockBtn = (id: BlockId, name: string, onClick: () => void): void => {
      const b = DIE_BLOCKS[id];
      const btn = button('die-btn', '');
      btn.setAttribute('aria-label', name);
      btn.style.left = `${b.x * 100}%`;
      btn.style.top = `${b.y * 100}%`;
      btn.style.width = `${b.w * 100}%`;
      btn.style.height = `${b.h * 100}%`;
      btn.addEventListener('click', onClick);
      slot.append(btn);
    };
    blockBtn('design', 'THIẾT KẾ: tự vẽ mạch', showLevels);
    blockBtn('debug', 'KIỂM THỬ: tìm lỗi chip', showDebugLevels);
    blockBtn('runtime', 'VẬN HÀNH: chơi vô tận', () => startRuntime('endless'));
    const actions = el('div', 'start-actions');
    actions.append(play, sixty);
    const gear = button('btn-icon gear', '');
    gear.innerHTML = ICON_GEAR;
    gear.setAttribute('aria-label', 'Cài đặt');
    gear.addEventListener('click', showSettings);
    start.append(gear);
    start.append(
      hero,
      slot,
      actions,
      el('p', 'note', 'Chạm vào một khối của con chip để chọn công đoạn. CHƠI NGAY = VẬN HÀNH: cắm đúng cổng logic trước khi chip chạm ổ cắm.'),
      el('p', 'records', `Kỷ lục: Vô tận ${save.runtime.bestEndless} · 60 giây ${save.runtime.best60}`),
      perf,
      el('p', 'version', versionLabel()),
    );
    start.hidden = false;
    setScene(new HubScene(slot, stats));
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
      debug: () => {
        const ds = scene;
        if (!(ds instanceof DebugScene)) return null;
        const g = ds.grid;
        return {
          level: ds.level.id,
          probes: ds.probes.length,
          wrong: ds.wrong,
          tool: ds.tool,
          faultCell: g.colRow(ds.faultCell()),
          gates: g.gates().map((x) => g.colRow(x.cell)),
          wires: [...new Set([...ds.setup.probeCells.keys()].map((k) => Number(k.split(':')[1])))].map((c) => g.colRow(c)),
          cell: (c: number, r: number) => ds.cellCenter(c, r),
        };
      },
      design: () =>
        scene instanceof DesignScene
          ? { level: scene.level.id, tool: scene.tool, layer: scene.layer, inputs: [...scene.inputs], wires: scene.grid.wires().length, cell: (c: number, r: number) => (scene as DesignScene).cellCenter(c, r), showAi: () => (scene as DesignScene).showAiSolution() }
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
