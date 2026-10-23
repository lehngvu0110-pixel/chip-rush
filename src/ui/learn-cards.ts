// Góc học tập: trang chính (3 ô), sơ đồ tư duy tương tác và trắc nghiệm.
// Chỉ dựng DOM; lưu điểm, chuyển màn qua callback từ main.ts.
import { MIND_ROOT, findMindPath, type MindLink, type MindNode } from '../core/learn/mindmap';
import { TOPIC_NAME, makeQuiz, quizStars, type QuizQuestion, type QuizTopic } from '../core/learn/quiz';
import { action, el, focusQuiet, starsEl } from './dom';
import { ICON_BOOK, ICON_MINDMAP, ICON_PART, ICON_QUIZ } from './icons';

/** Màu theo nhánh (khớp bảng màu của game; cặp cyan/cam an toàn cho người mù màu đỏ-lục). */
const BRANCH_COLOR: Record<string, string> = {
  quantity: '#38e8ff',
  laws: '#ffb020',
  passive: '#3ddc84',
  semi: '#ff6b9a',
  digital: '#a07cff',
  chip: '#7fb2ff',
};

const back = (text: string, onClick: () => void, cls = 'btn-secondary'): HTMLButtonElement => {
  const b = action(cls, text, onClick);
  b.dataset.back = '';
  return b;
};

// ---------------- Trang Góc học tập ----------------
export function learnHubCard(o: { quizBest: number | null; onMindmap: () => void; onQuiz: () => void; onParts: () => void; onBack: () => void }): { card: HTMLDivElement; focus: HTMLElement } {
  const card = el('div', 'card level-card learn-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Góc học tập');
  const head = el('div', 'learn-head');
  const ic = el('span', 'learn-head-icon');
  ic.innerHTML = ICON_BOOK;
  head.append(ic, el('p', 'card-title', 'Góc học tập'));
  card.append(head, el('p', 'note', 'Kiến thức điện - điện tử nền tảng cho người mới, nối thẳng với các màn chơi.'));
  const tiles = el('div', 'learn-tiles');
  const tile = (icon: string, title: string, desc: string, color: string, onClick: () => void, aria: string): HTMLButtonElement => {
    const b = action('learn-tile', '', onClick);
    b.style.setProperty('--c', color);
    const i = el('span', 'learn-tile-icon');
    i.innerHTML = icon;
    const t = el('span', 'learn-tile-text');
    t.append(el('strong', '', title), el('small', '', desc));
    b.append(i, t);
    b.setAttribute('aria-label', aria);
    tiles.append(b);
    return b;
  };
  const first = tile(ICON_MINDMAP, 'Sơ đồ tư duy', '6 nhánh, 30 ý chính: đại lượng, định luật, linh kiện, bán dẫn, mạch số, vi mạch', '#38e8ff', o.onMindmap, 'Sơ đồ tư duy');
  tile(ICON_QUIZ, 'Trắc nghiệm', o.quizBest === null ? '10 câu mỗi lượt, có lời giải từng câu' : `Kỷ lục ${o.quizBest}/10 · 10 câu mỗi lượt, có lời giải`, '#ffb020', o.onQuiz, 'Trắc nghiệm');
  tile(ICON_PART, 'Linh kiện 3D', '11 linh kiện xoay 360°, phóng to, đọc thông số', '#3ddc84', o.onParts, 'Linh kiện điện tử');
  card.append(tiles, back('Về màn chính', o.onBack));
  return { card, focus: first };
}

// ---------------- Sơ đồ tư duy ----------------
export function mindmapCard(o: { onLink: (l: MindLink) => void; onBack: () => void; reducedMotion: boolean }): { card: HTMLDivElement; focus: HTMLElement } {
  const card = el('div', 'card level-card mm-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Sơ đồ tư duy');
  const crumbs = el('nav', 'mm-crumbs');
  crumbs.setAttribute('aria-label', 'Vị trí trong sơ đồ');
  const stage = el('div', 'mm-stage');
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('mm-lines');
  const nodes = el('div', 'mm-nodes');
  nodes.setAttribute('role', 'group');
  stage.append(svg, nodes);
  const detail = el('section', 'mm-detail');
  detail.setAttribute('aria-live', 'polite');
  const backBtn = back('Về Góc học tập', o.onBack);
  card.append(el('p', 'card-title', 'Sơ đồ tư duy'), crumbs, stage, detail, backBtn);

  let focus: MindNode = MIND_ROOT;

  const colorOf = (n: MindNode): string => {
    const path = findMindPath(n.id);
    return (path && path[1] && BRANCH_COLOR[path[1].id]) || '#e8ecf8';
  };

  const showDetail = (n: MindNode): void => {
    const items: HTMLElement[] = [el('h3', '', n.label)];
    if (n.formula) items.push(el('p', 'mm-formula', n.formula));
    items.push(el('p', '', n.detail));
    if (n.link) {
      const l = n.link;
      const txt =
        l.kind === 'part' ? 'Xem linh kiện 3D' : { design: 'Chơi THIẾT KẾ', debug: 'Chơi KIỂM THỬ', assembly: 'Chơi LẮP RÁP', runtime: 'Chơi VẬN HÀNH' }[l.id];
      items.push(action('btn-small mm-link', `${txt} →`, () => o.onLink(l)));
    }
    detail.style.setProperty('--c', colorOf(n));
    detail.replaceChildren(...items);
    for (const b of nodes.querySelectorAll<HTMLButtonElement>('.mm-node')) b.setAttribute('aria-pressed', String(b.dataset.id === n.id));
  };

  const render = (): void => {
    // đường dẫn: Gốc › Nhánh
    const path = findMindPath(focus.id) ?? [MIND_ROOT];
    crumbs.replaceChildren(
      ...path.flatMap((p, i) => {
        const b = action('mm-crumb', p.label, () => {
          focus = p;
          render();
          showDetail(p);
        });
        if (i === path.length - 1) b.setAttribute('aria-current', 'location');
        return i ? [el('span', 'mm-sep', '›'), b] : [b];
      }),
    );
    const kids = focus.children ?? [];
    const n = kids.length;
    // nút giữa + các con xếp trên vòng tròn (toạ độ %, để tự co theo bề rộng)
    const R = 36;
    const pos = kids.map((_, i): [number, number] => {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
      return [50 + R * Math.cos(a), 50 + R * Math.sin(a)];
    });
    svg.replaceChildren(
      ...pos.map(([x, y], i) => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', '50');
        line.setAttribute('y1', '50');
        line.setAttribute('x2', String(x));
        line.setAttribute('y2', String(y));
        line.setAttribute('stroke', focus === MIND_ROOT ? BRANCH_COLOR[kids[i]!.id] ?? '#9aa6c8' : colorOf(focus));
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        return line;
      }),
    );
    const mk = (m: MindNode, x: number, y: number, center: boolean, i: number): HTMLButtonElement => {
      const b = action(`mm-node${center ? ' center' : ''}${m.children ? ' has-kids' : ''}`, m.label, () => {
        if (!center && m.children) {
          focus = m;
          render();
          showDetail(m);
          focusQuiet(nodes.querySelector<HTMLElement>('.mm-node.center'));
        } else showDetail(m);
      });
      b.dataset.id = m.id;
      b.style.left = `${x}%`;
      b.style.top = `${y}%`;
      b.style.setProperty('--c', center && focus === MIND_ROOT ? '#e8ecf8' : colorOf(m));
      b.style.setProperty('--d', `${o.reducedMotion ? 0 : i * 40}ms`);
      b.setAttribute('aria-label', `${m.label}${m.children ? `, nhánh có ${m.children.length} ý, chạm để mở` : ''}`);
      return b;
    };
    nodes.setAttribute('aria-label', `${focus.label}: ${n} ý`);
    nodes.replaceChildren(mk(focus, 50, 50, true, 0), ...kids.map((k, i) => mk(k, pos[i]![0], pos[i]![1], false, i + 1)));
  };

  render();
  showDetail(MIND_ROOT);
  return { card, focus: nodes.querySelector<HTMLElement>('.mm-node:not(.center)') ?? backBtn };
}

// ---------------- Trắc nghiệm ----------------
export interface QuizDeps {
  best: number | null;
  /** seed đề (main dùng thời gian thực; test dùng ?seed=) */
  seed: () => number;
  /** lưu kết quả, trả về true nếu là kỷ lục mới */
  onFinish: (correct: number, total: number) => boolean;
  onBack: () => void;
}

export function quizCard(d: QuizDeps): { card: HTMLDivElement; focus: HTMLElement } {
  const card = el('div', 'card level-card quiz-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Trắc nghiệm');
  const body = el('div', 'quiz-body');
  const backBtn = back('Về Góc học tập', d.onBack);
  card.append(el('p', 'card-title', 'Trắc nghiệm điện - điện tử'), body, backBtn);
  let topic: QuizTopic | 'all' = 'all';
  let best = d.best;

  const setup = (): HTMLElement => {
    const chips = el('div', 'quiz-topics');
    chips.setAttribute('role', 'group');
    chips.setAttribute('aria-label', 'Chọn chủ đề');
    const all: (QuizTopic | 'all')[] = ['all', 'basic', 'parts', 'semi', 'digital'];
    const btns = all.map((t) => {
      const b = action('quiz-topic', t === 'all' ? 'Tất cả' : TOPIC_NAME[t], () => {
        topic = t;
        btns.forEach((x, i) => x.setAttribute('aria-pressed', String(all[i] === t)));
      });
      b.setAttribute('aria-pressed', String(t === topic));
      return b;
    });
    chips.append(...btns);
    const start = action('btn-primary', 'Bắt đầu 10 câu', () => run(makeQuiz(d.seed(), topic)));
    body.replaceChildren(
      el('p', 'note', best === null ? 'Mỗi lượt 10 câu: câu lý thuyết và câu tính toán đổi số mỗi lần. Sai cũng không sao, mỗi câu đều có lời giải.' : `Kỷ lục của bạn: ${best}/10 câu đúng.`),
      chips,
      start,
    );
    return start;
  };

  const run = (qs: QuizQuestion[]): void => {
    let i = 0;
    let correct = 0;
    const wrong: { q: QuizQuestion; picked: number }[] = [];
    const show = (): void => {
      const q = qs[i]!;
      const bar = el('div', 'quiz-progress');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', 'Tiến độ');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', String(qs.length));
      bar.setAttribute('aria-valuenow', String(i));
      const fill = el('span', '');
      fill.style.width = `${(i / qs.length) * 100}%`;
      bar.append(fill);
      const meta = el('p', 'quiz-meta', `Câu ${i + 1}/${qs.length} · ${TOPIC_NAME[q.topic]} · đúng ${correct}`);
      const title = el('h3', 'quiz-q', q.q);
      title.id = `quiz-q-${i}`;
      const opts = el('div', 'quiz-opts');
      opts.setAttribute('role', 'group');
      opts.setAttribute('aria-labelledby', title.id);
      const explain = el('div', 'quiz-explain');
      explain.setAttribute('role', 'status');
      const buttons = q.options.map((t, k) => {
        const b = action('quiz-opt', '', () => choose(k));
        b.append(el('span', 'quiz-key', 'ABCD'[k]!), el('span', 'quiz-text', t));
        return b;
      });
      opts.append(...buttons);
      const choose = (k: number): void => {
        const ok = k === q.answer;
        if (ok) correct++;
        else wrong.push({ q, picked: k });
        buttons.forEach((b, j) => {
          b.disabled = true;
          if (j === q.answer) b.classList.add('ok');
          if (j === k && !ok) b.classList.add('bad');
          // dấu ✓ / ✕ bằng chữ: không chỉ dựa vào màu
          if (j === q.answer) b.querySelector('.quiz-key')!.textContent = '✓';
          else if (j === k) b.querySelector('.quiz-key')!.textContent = '✕';
        });
        const next = action('btn-primary quiz-next', i + 1 < qs.length ? 'Câu tiếp' : 'Xem kết quả', () => {
          i++;
          if (i < qs.length) show();
          else finish();
        });
        explain.replaceChildren(el('strong', ok ? 'quiz-good' : 'quiz-bad', ok ? 'Chính xác!' : `Chưa đúng. Đáp án: ${q.options[q.answer]}`), el('p', '', q.explain), next);
        explain.dataset.kind = ok ? 'good' : 'bad';
        focusQuiet(next);
      };
      body.replaceChildren(bar, meta, title, opts, explain);
      focusQuiet(buttons[0]);
    };
    const finish = (): void => {
      const record = d.onFinish(correct, qs.length);
      if (best === null || correct > best) best = correct;
      const s = quizStars(correct, qs.length);
      const score = el('p', 'result-score', `${correct}/${qs.length}`);
      score.setAttribute('aria-label', `${correct} trên ${qs.length} câu đúng`);
      const items: HTMLElement[] = [el('h3', 'result-title', s >= 2 ? 'Giỏi lắm!' : 'Ôn thêm chút nữa nhé'), starsEl(s, `${s} trên 3 sao`), score];
      if (record) items.push(el('p', 'result-record', 'Kỷ lục mới!'));
      if (wrong.length) {
        const list = el('ul', 'quiz-review');
        list.tabIndex = 0;
        list.setAttribute('aria-label', 'Các câu sai');
        for (const w of wrong) {
          const li = el('li', '');
          li.append(el('strong', '', w.q.q), el('span', '', `Bạn chọn: ${w.q.options[w.picked]} · Đúng: ${w.q.options[w.q.answer]}`));
          list.append(li);
        }
        items.push(el('p', 'note', 'Xem lại câu sai:'), list);
      }
      const again = action('btn-primary', 'Làm đề khác', () => run(makeQuiz(d.seed(), topic)));
      items.push(again, action('', 'Chọn chủ đề khác', () => focusQuiet(setup())));
      body.replaceChildren(...items);
      focusQuiet(again);
    };
    show();
  };

  const start = setup();
  return { card, focus: start };
}
