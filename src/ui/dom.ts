// Tiện ích DOM nhỏ dùng chung cho mọi thẻ/bảng giao diện (không phụ thuộc trạng thái game).
import { ICON_STAR } from './icons';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export function button(cls: string, text: string): HTMLButtonElement {
  const b = el('button', `btn ${cls}`.trim(), text);
  b.type = 'button';
  return b;
}

/** Nút bấm có sẵn trình xử lý click. */
export function action(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = button(cls, text);
  b.addEventListener('click', onClick);
  return b;
}

/** Link mở tab mới (GitHub…). */
export function extLink(cls: string, text: string, href: string): HTMLAnchorElement {
  const a = el('a', cls, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener';
  return a;
}

/** 3 ngôi sao (n sao sáng) — role="img" + nhãn cho trình đọc màn hình. */
export function starsEl(n: number, label: string): HTMLSpanElement {
  const span = el('span', 'stars');
  span.setAttribute('role', 'img');
  span.setAttribute('aria-label', label);
  for (let i = 0; i < 3; i++) {
    const s = el('span', i < n ? 'star on' : 'star');
    s.style.setProperty('--i', String(i));
    s.innerHTML = ICON_STAR;
    span.append(s);
  }
  return span;
}

/** Số chạy từ 0 lên `to` trong 0,8 s (bỏ qua khi giảm chuyển động). Chỉ đổi chữ, nhãn aria giữ nguyên. */
export function countUp(node: HTMLElement, to: number, reducedMotion: boolean): void {
  if (reducedMotion || to <= 0) return;
  const t0 = performance.now();
  const tick = (now: number): void => {
    const k = Math.min(1, (now - t0) / 800);
    node.textContent = String(Math.round(to * (1 - (1 - k) ** 3)));
    if (k < 1 && node.isConnected) requestAnimationFrame(tick);
  };
  node.textContent = '0';
  requestAnimationFrame(tick);
}

/** Đưa focus vào nút cho người dùng bàn phím/trình đọc màn hình, không vẽ viền focus khi chạm. */
export function focusQuiet(b: HTMLElement | null | undefined): void {
  b?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
}
