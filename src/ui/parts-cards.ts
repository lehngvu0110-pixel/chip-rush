// Thư viện linh kiện: danh sách (ảnh 3D nhỏ + tên) và thẻ chi tiết (mô hình 3D xoay/phóng to + thông tin).
// Chỉ dựng DOM; chuyển thẻ qua callback từ main.ts.
import { PARTS, type Part, type PartId } from '../core/parts/catalog';
import { partModel } from '../render/part-models';
import { action, el } from './dom';
import { PART_SYMBOLS } from './part-symbols';
import { partThumb, partViewer } from './part-viewer';

export function partsListCard(o: { onPick: (id: PartId) => void; onBack: () => void; focusId?: PartId }): { card: HTMLDivElement; focus: HTMLElement } {
  const card = el('div', 'card level-card parts-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Linh kiện điện tử');
  card.append(el('p', 'card-title', 'Linh kiện điện tử'), el('p', 'note', 'Chạm vào một linh kiện để xoay mô hình 3D, phóng to và đọc cách dùng.'));
  const list = el('div', 'level-list parts-list');
  let focus: HTMLElement | null = null;
  for (const p of PARTS) {
    const b = action('level-item part-item', '', () => o.onPick(p.id));
    const head = el('span', 'level-head');
    head.append(el('strong', '', p.name), el('small', '', p.short));
    b.append(partThumb(partModel(p.id), 52), head);
    b.setAttribute('aria-label', `${p.name}: ${p.short}`);
    if (p.id === o.focusId) focus = b;
    list.append(b);
  }
  const back = action('btn-secondary', 'Về Góc học tập', o.onBack);
  back.dataset.back = '';
  card.append(list, back);
  return { card, focus: focus ?? back };
}

export interface PartDetailDeps {
  reducedMotion: boolean;
  onPick: (id: PartId) => void;
  onList: () => void;
}

export function partDetailCard(p: Part, d: PartDetailDeps): { card: HTMLDivElement; focus: HTMLElement } {
  const i = PARTS.findIndex((x) => x.id === p.id);
  const prev = PARTS[(i - 1 + PARTS.length) % PARTS.length]!;
  const next = PARTS[(i + 1) % PARTS.length]!;

  const card = el('div', 'card level-card part-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', p.name);
  card.append(el('p', 'card-title', p.name), el('p', 'part-sub', `${p.en} · ký hiệu ${p.letter} · ${i + 1}/${PARTS.length}`));
  card.append(partViewer({ mesh: partModel(p.id), name: p.name, reducedMotion: d.reducedMotion }));

  const body = el('div', 'part-body');
  // vùng cuộn được → cho focus bằng bàn phím để cuộn (axe scrollable-region-focusable)
  body.tabIndex = 0;
  body.setAttribute('aria-label', `Thông tin ${p.name}`);
  const sample = el('p', 'part-sample');
  sample.append(el('strong', '', 'Mẫu đang xem: '), document.createTextNode(p.sample));
  const symbol = el('div', 'part-symbol');
  const svg = el('span', 'part-symbol-svg');
  svg.innerHTML = PART_SYMBOLS[p.id];
  symbol.append(svg, el('small', '', `Ký hiệu trên sơ đồ mạch (${p.letter})`));
  symbol.setAttribute('role', 'img');
  symbol.setAttribute('aria-label', `Ký hiệu sơ đồ của ${p.name}`);

  const specs = el('table', 'part-specs');
  const cap = el('caption', 'sr-only', `Thông số ${p.name}`);
  const tb = el('tbody', '');
  for (const [k, v] of p.specs) {
    const tr = el('tr', '');
    tr.append(el('th', '', k), el('td', '', v));
    tr.firstElementChild?.setAttribute('scope', 'row');
    tb.append(tr);
  }
  specs.append(cap, tb);

  const tips = el('ul', 'part-tips');
  for (const t of p.tips) tips.append(el('li', '', t));
  const chip = el('section', 'ai-sec part-chip');
  chip.append(el('h3', '', 'Liên hệ với vi mạch'), el('p', '', p.chip));

  body.append(sample, el('p', 'part-summary', p.summary), symbol, specs, el('h3', 'part-h', 'Nhận biết và lưu ý'), tips, chip);

  const nav = el('div', 'part-nav');
  const prevBtn = action('btn-secondary btn-small', `‹ ${prev.name}`, () => d.onPick(prev.id));
  prevBtn.setAttribute('aria-label', `Linh kiện trước: ${prev.name}`);
  const nextBtn = action('btn-secondary btn-small', `${next.name} ›`, () => d.onPick(next.id));
  nextBtn.setAttribute('aria-label', `Linh kiện sau: ${next.name}`);
  const list = action('btn-small', 'Danh sách', d.onList);
  list.dataset.back = '';
  nav.append(prevBtn, list, nextBtn);
  card.append(body, nav);
  return { card, focus: list };
}
