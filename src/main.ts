import './ui/styles.css';
import { versionLabel } from './config';
import { createLoop } from './loop';
import type { Scene } from './scene';
import { MIN_QUALITY_DPR, createSurface } from './render/canvas';
import { createAudio } from './render/audio';
import { attachPointer } from './input/pointer';
import { createSafeStorage } from './platform/storage';
import { watchVisibility } from './platform/visibility';
import { installGlobalErrorHandlers, showErrorScreen } from './platform/errors';
import { debugUnlocked, defaultSave, designUnlocked, loadSave, recordDebug, recordDesign, recordRuntimeScore, writeSave } from './core/progress';
import { DEBUG_LEVELS } from './core/level/debug-levels';
import type { DebugLevel, DesignLevel } from './core/level/types';
import { DebugScene, type DebugResult } from './modes/debug/debug-scene';
import { DESIGN_LEVELS } from './core/level/design-levels';
import { DesignScene } from './modes/design/design-scene';
import { currentStreak, dailyFor, recordDaily, shortDate, vnDateKey } from './core/level/daily';
import { BADGES, awardBadges, badgeCount } from './core/badges';
import { HubScene } from './modes/hub/hub-scene';
import { vnDateSeed } from './core/util/rng';
import { FrameStats, QUALITY_WINDOW, decideQuality } from './debug/stats';
import { createPerfOverlay } from './debug/perf-overlay';
import { SandboxScene } from './debug/sandbox-scene';
import { RuntimeGame, type RuntimeMode, type RuntimeResult } from './modes/runtime/game';
import { RuntimeScene, layoutRuntime } from './modes/runtime/runtime-scene';
import { TitleScene } from './modes/title/title-scene';
import { ICON_PAUSE, ICON_SOUND_OFF, ICON_SOUND_ON } from './ui/icons';
import { startScreen } from './ui/start-screen';
import { button, el, focusQuiet } from './ui/dom';
import { createShareButtonFactory } from './ui/share-button';
import { debugResultCard, designResultCard, dailyResultCard, runtimeResultCard, type Card, type PassResult } from './ui/result-cards';
import { aiInfoCard, badgesCard, levelListCard, settingsCard } from './ui/info-cards';

// Điểm vào của game: dựng canvas + vòng lặp, giữ trạng thái chung (tiến độ, âm thanh, scene đang chạy)
// và điều hướng giữa các màn. Phần dựng DOM của từng thẻ nằm trong src/ui/*.

function boot(root: HTMLElement): void {
  const ui = el('div', 'ui');
  const stage = el('div', 'stage');
  root.append(stage, ui);
  const params = new URLSearchParams(location.search);
  // Điện thoại xoay ngang: màn quá thấp để vẽ mạch → nhắc xoay dọc (chỉ hiện bằng CSS, xem .rotate-hint).
  // Game tự tạm dừng khi xoay (platform/visibility), xoay lại là chơi tiếp.
  const rotateHint = el('div', 'rotate-hint');
  rotateHint.setAttribute('role', 'status');
  rotateHint.innerHTML = '<svg viewBox="0 0 48 48" width="56" height="56" aria-hidden="true"><rect x="14" y="6" width="20" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3"/><path d="M6 30a18 18 0 0 0 10 12M42 18A18 18 0 0 0 32 6" fill="none" stroke="#ffb020" stroke-width="3" stroke-linecap="round"/></svg><p>Xoay dọc điện thoại để chơi CHIP RUSH</p>';
  root.append(rotateHint);

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
  // Huy hiệu: người đã chơi từ trước được trao bù ngay khi mở game (không báo, tránh dồn thông báo)
  if (awardBadges(save, vnDateKey()).length > 0) persist();
  /** Lưu tiến độ sau một kết quả + trao huy hiệu vừa đạt (báo bằng 1 thông báo gộp). */
  const saveProgress = (): void => {
    const fresh = awardBadges(save, vnDateKey());
    persist();
    if (fresh.length > 0) {
      audio.play('unlock');
      toast(`Huy hiệu mới: ${fresh.map((b) => b.name).join(', ')}!`);
    }
  };

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
  let qualityChangedAt = 0;

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
      // Tự hạ đồ hoạ nếu máy không theo kịp. Bỏ qua lúc mới tải (hay giật), và sau mỗi lần hạ phải đo
      // lại đủ QUALITY_WINDOW frame mới xét tiếp (số đo cũ là của mức chất lượng trước).
      if (++warmup - qualityChangedAt > QUALITY_WINDOW && warmup % 30 === 0) {
        const next = decideQuality(surface.quality, stats.summary(QUALITY_WINDOW));
        if (next !== surface.quality) {
          surface.quality = next;
          qualityChangedAt = warmup;
          // low: ẩn lớp nền bo mạch — trên máy vẽ bằng CPU, ghép 2 lớp toàn màn hình rất tốn (ADR-0006)
          surface.backdrop.style.visibility = 'hidden';
          // min: vẽ ở độ phân giải thấp hơn (số điểm ảnh giảm ~2,5 lần so với DPR 2)
          if (next === 'min') {
            surface.dprCap = MIN_QUALITY_DPR;
            surface.resize();
          }
        }
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

  // 6. Thẻ kết quả + bảng (danh sách màn, Cài đặt, trang AI) dùng chung 2 panel
  const resultPanel = el('div', 'panel result-panel');
  resultPanel.hidden = true;
  resultPanel.setAttribute('role', 'dialog');
  resultPanel.setAttribute('aria-label', 'Kết quả');
  ui.append(resultPanel);
  const start = el('div', 'panel start-panel');
  ui.append(start);
  const levelPanel = el('div', 'panel level-panel');
  levelPanel.hidden = true;
  ui.append(levelPanel);
  const share = createShareButtonFactory(toast);

  /** Hiện thẻ kết quả (ẩn HUD), focus nút chính. */
  const showCard = ({ card, focus }: Card): void => {
    resultPanel.replaceChildren(card);
    resultPanel.hidden = false;
    hud.hidden = true;
    focusQuiet(focus);
  };
  /** Ẩn thẻ kết quả để chơi tiếp trên cùng màn (Tối ưu tiếp / xem AI). */
  const backToBoard = (): void => {
    resultPanel.hidden = true;
    hud.hidden = false;
  };
  /** Hiện một thẻ trong panel giữa (danh sách màn, Cài đặt, trang AI). */
  const showPanel = (card: HTMLElement, focus?: HTMLElement): void => {
    levelPanel.replaceChildren(card);
    start.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = true;
    levelPanel.hidden = false;
    focusQuiet(focus);
  };
  /** Chuẩn bị vào một màn chơi: ẩn mọi panel, hiện HUD. */
  const enterPlay = (): void => {
    void audio.unlock(); // mở khoá âm thanh NGAY trong thao tác chạm (yêu cầu iOS)
    start.hidden = true;
    levelPanel.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    hud.hidden = false;
    heavyBtn.hidden = true;
  };

  // 7. VẬN HÀNH
  let lastMode: RuntimeMode = 'endless';
  const startRuntime = (mode: RuntimeMode): void => {
    lastMode = mode;
    enterPlay();
    // 60 giây: seed theo ngày (cả nước cùng chuỗi gói); Vô tận: ngẫu nhiên. ?seed= để test tái lập.
    const seedParam = Number(params.get('seed'));
    const seed = Number.isFinite(seedParam) && params.has('seed') ? seedParam : mode === 'sixty' ? vnDateSeed() : (Math.random() * 2 ** 32) >>> 0;
    const game = new RuntimeGame(mode, seed);
    exposeForTests(game);
    setScene(new RuntimeScene(game, audio, showResult));
  };
  const showResult = (r: RuntimeResult): void => {
    const isRecord = recordRuntimeScore(save, r.mode, r.score);
    audio.play(isRecord && r.score > 0 ? 'win' : 'lose');
    saveProgress();
    const best = r.mode === 'endless' ? save.runtime.bestEndless : save.runtime.best60;
    showCard(runtimeResultCard(r, { isRecord, best, share, onAgain: () => startRuntime(lastMode), onHome: showStart }));
  };

  // 7b. THIẾT KẾ: danh sách màn → màn chơi → thẻ kết quả
  const levelIds = DESIGN_LEVELS.map((l) => l.id);
  const showLevels = (): void => {
    setScene(new TitleScene());
    showPanel(
      levelListCard({
        title: 'THIẾT KẾ',
        note: 'Vẽ mạch đúng bảng chân trị. Chi phí càng thấp càng nhiều sao; thử vượt AI kỹ sư!',
        items: DESIGN_LEVELS.map((lv, i) => {
          const open = designUnlocked(save, levelIds, i);
          return { id: lv.id, name: lv.name, sub: open ? lv.concept : 'Qua màn trước để mở', open, stars: save.design[lv.id]?.stars ?? 0, onPick: () => startDesign(lv) };
        }),
        onAiInfo: () => showAiInfo(showLevels),
        onBack: showStart,
      }),
    );
  };
  const startDesign = (lv: DesignLevel): void => {
    enterPlay();
    exposeForTests(null);
    // hướng dẫn lần đầu ở màn đầu tiên, tới khi qua màn lần đầu (không trừ sao)
    setScene(new DesignScene(lv, { ui, audio, onPass: showDesignResult, tutorial: lv.id === 'd01' && !save.design[lv.id] }));
  };
  const showAiOnBoard = (): void => {
    backToBoard();
    if (scene instanceof DesignScene) scene.showAiSolution();
  };
  const showDesignResult = (lv: DesignLevel, r: PassResult): void => {
    if (!(scene instanceof DesignScene) || scene.level.id !== lv.id) return; // người chơi đã rời màn
    // đã xem lời giải AI thì lần qua màn này không tính vào kết quả
    const counted = !scene.aiShown;
    const improved = counted && recordDesign(save, lv.id, r.ppa, r.stars, scene.hinted);
    if (counted) saveProgress();
    const next = DESIGN_LEVELS[levelIds.indexOf(lv.id) + 1];
    showCard(
      designResultCard(lv, r, {
        counted,
        improved,
        hinted: scene.hinted,
        reducedMotion: surface.reducedMotion,
        share,
        onNext: next ? () => startDesign(next) : undefined,
        onTune: backToBoard,
        onShowAi: showAiOnBoard,
        onList: showLevels,
      }),
    );
  };

  // 7b'. Daily Chip: mỗi ngày (giờ VN) một đề THIẾT KẾ, chuỗi ngày liên tiếp (SPEC mục 4)
  // ?e2e&date=YYYY-MM-DD để test giả ngày (chỉ khi chạy test)
  const todayKey = (): string => {
    const forced = params.has('e2e') ? params.get('date') : null;
    return forced && /^\d{4}-\d{2}-\d{2}$/.test(forced) ? forced : vnDateKey();
  };
  const startDaily = (): void => {
    const key = todayKey();
    enterPlay();
    exposeForTests(null);
    setScene(new DesignScene(dailyFor(key), { ui, audio, heading: `CHIP HÔM NAY · ${shortDate(key)}`, onPass: (l, r) => showDailyResult(key, l, r) }));
  };
  const showDailyResult = (key: string, lv: DesignLevel, r: PassResult): void => {
    if (!(scene instanceof DesignScene) || scene.level.id !== lv.id) return;
    const counted = !scene.aiShown;
    const rec = counted ? recordDaily(save, key, r.stars, r.score) : null;
    if (counted) saveProgress();
    showCard(
      dailyResultCard(key, lv, r, {
        counted,
        rec,
        streak: currentStreak(save, key),
        hinted: scene.hinted,
        reducedMotion: surface.reducedMotion,
        share,
        onHome: showStart,
        onTune: backToBoard,
        onShowAi: showAiOnBoard,
      }),
    );
  };

  // 7c. KIỂM THỬ: danh sách màn → màn chơi → thẻ kết quả
  const debugIds = DEBUG_LEVELS.map((l) => l.id);
  const showDebugLevels = (): void => {
    setScene(new TitleScene());
    showPanel(
      levelListCard({
        title: 'KIỂM THỬ',
        note: 'Chip vừa sản xuất có 1 lỗi ẩn. Đo càng ít lần càng nhiều sao; AI kỹ sư biết số lần đo ít nhất.',
        items: DEBUG_LEVELS.map((lv, i) => {
          const open = debugUnlocked(save, debugIds, i);
          return { id: lv.id, name: lv.name, sub: open ? lv.concept : i === 0 ? 'Qua màn THIẾT KẾ D05 để mở' : 'Qua màn trước để mở', open, stars: save.debug[lv.id]?.stars ?? 0, onPick: () => startDebug(lv) };
        }),
        onAiInfo: () => showAiInfo(showDebugLevels),
        onBack: showStart,
      }),
    );
  };
  const startDebug = (lv: DebugLevel): void => {
    enterPlay();
    exposeForTests(null);
    setScene(new DebugScene(lv, { ui, audio, onEnd: showDebugResult, tutorial: lv.id === 't01' && !save.debug[lv.id] }));
  };
  const showDebugResult = (lv: DebugLevel, r: DebugResult): void => {
    if (!(scene instanceof DebugScene) || scene.level.id !== lv.id) return;
    const improved = r.win && recordDebug(save, lv.id, r.stars, r.probes);
    if (r.win) saveProgress();
    const next = DEBUG_LEVELS[debugIds.indexOf(lv.id) + 1];
    showCard(
      debugResultCard(lv, r, {
        improved,
        share,
        onNext: next ? () => startDebug(next) : undefined,
        onAgain: () => startDebug(lv),
        onWatchAi: () => {
          backToBoard();
          if (scene instanceof DebugScene) scene.replayAi();
        },
        onList: showDebugLevels,
      }),
    );
  };

  // 7d. "AI kỹ sư hoạt động thế nào?" + Cài đặt (nút bánh răng ở màn hình chính)
  const showAiInfo = (back: () => void): void => {
    const { card, focus } = aiInfoCard(back);
    showPanel(card, focus);
  };
  const showBadges = (): void => {
    const { card, focus } = badgesCard(
      BADGES.map((b) => ({ name: b.name, desc: b.desc, earned: save.badges[b.id] ?? null })),
      showStart,
    );
    showPanel(card, focus);
  };
  const showSettings = (): void => {
    const { card, focus } = settingsCard({
      sound: {
        get: () => !save.settings.muted,
        set: (on) => {
          save.settings.muted = !on;
          audio.muted = !on;
          syncMute();
          persist();
          if (on) void audio.unlock().then(() => audio.play('ting'));
        },
      },
      reducedMotion: {
        get: () => save.settings.reducedMotion,
        set: (on) => {
          save.settings.reducedMotion = on;
          applyMotion();
          persist();
        },
      },
      systemReduced,
      onAiInfo: () => showAiInfo(showSettings),
      onReset: () => {
        Object.assign(save, defaultSave(), { settings: save.settings });
        persist();
        toast('Đã xoá toàn bộ tiến độ.');
        showStart();
      },
      onClose: showStart,
    });
    showPanel(card, focus);
  };

  const showStart = (): void => {
    levelPanel.hidden = true;
    hud.hidden = true;
    resultPanel.hidden = true;
    pausePanel.hidden = true;
    const key = todayKey();
    const { nodes, slot } = startScreen(
      {
        dateLabel: shortDate(key),
        doneStars: save.daily.history[key]?.stars ?? null,
        streak: currentStreak(save, key),
        bestEndless: save.runtime.bestEndless,
        best60: save.runtime.best60,
        badges: { earned: badgeCount(save), total: BADGES.length },
        showPerf: params.has('debug'),
      },
      {
        onDesign: showLevels,
        onDebug: showDebugLevels,
        onRuntime: startRuntime,
        onDaily: startDaily,
        onSettings: showSettings,
        onBadges: showBadges,
        onPerf: () => {
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
        },
      },
    );
    start.replaceChildren(...nodes);
    start.hidden = false;
    // Die chip vẽ bằng canvas (HubScene) đúng vào ô `slot`
    setScene(
      new HubScene(slot, {
        designStars: Object.values(save.design).reduce((n, d) => n + (d?.stars ?? 0), 0),
        designMax: DESIGN_LEVELS.length * 3,
        debugStars: Object.values(save.debug).reduce((n, d) => n + (d?.stars ?? 0), 0),
        debugMax: DEBUG_LEVELS.length * 3,
        debugOpen: save.design.d05 !== undefined,
        bestEndless: save.runtime.bestEndless,
        best60: save.runtime.best60,
      }),
    );
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
      // đo hiệu năng tự động (tools/perf-bench.mjs): chất lượng đồ hoạ hiện tại + thống kê 120 frame gần nhất
      perf: () => ({ quality: surface.quality, ...stats.summary(QUALITY_WINDOW) }),
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
          // hướng dẫn lần đầu: hàng đầu vào cần đặt + các ô dây nên đo tiếp
          coach: ds.coach
            ? {
                remaining: ds.coach.remaining,
                row: ds.coach.next?.row ?? null,
                currentRow: ds.board.currentRow(),
                cells: [...ds.setup.probeCells].filter(([, n]) => n === ds.coach?.next?.net).map(([k]) => g.colRow(Number(k.split(':')[1]))),
              }
            : null,
        };
      },
      design: () =>
        scene instanceof DesignScene
          ? { level: scene.level.id, tool: scene.tool, layer: scene.layer, inputs: [...scene.inputs], wires: scene.grid.wires().length, tut: scene.tutStep, cell: (c: number, r: number) => (scene as DesignScene).cellCenter(c, r), showAi: () => (scene as DesignScene).showAiSolution(), applyAi: () => (scene as DesignScene).loadAiForTest() }
          : null,
    };
  }

  showStart();

  // 8. Công cụ dev
  if (params.has('debug')) {
    createPerfOverlay(ui, stats, {
      version: versionLabel(),
      quality: () => surface.quality,
      size: () => `${Math.round(surface.width)}×${Math.round(surface.height)} @${Math.min(window.devicePixelRatio, surface.dprCap)}x`,
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
