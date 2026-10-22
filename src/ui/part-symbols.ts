// Ký hiệu sơ đồ mạch của từng linh kiện (kiểu IEC, như sách giáo khoa Việt Nam), SVG nội tuyến tự vẽ.
// Chỉ là chuỗi tĩnh do mình viết, không chứa dữ liệu người dùng → gán innerHTML an toàn.
import type { PartId } from '../core/parts/catalog';

const wrap = (body: string): string =>
  `<svg viewBox="0 0 96 48" width="120" height="60" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Mũi tên ánh sáng đi ra (LED). */
const rays = '<path d="M56 12l8-8M58 4h6v6M64 16l8-8M66 8h6v6"/>';
const diodeBody = '<path d="M6 24h32M58 24h32"/><path d="M38 12v24l20-12z" fill="currentColor" fill-opacity="0.15"/><path d="M58 12v24"/>';

export const PART_SYMBOLS: Record<PartId, string> = {
  resistor: wrap('<path d="M6 24h22M68 24h22"/><rect x="28" y="16" width="40" height="16" rx="1"/>'),
  'ceramic-cap': wrap('<path d="M6 24h37M53 24h37M43 10v28M53 10v28"/>'),
  electrolytic: wrap('<path d="M6 24h37M54 24h36M43 10v28"/><path d="M58 10q-8 14 0 28"/><path d="M32 10h6M35 7v6" stroke-width="2"/>'),
  inductor: wrap('<path d="M6 30h14M76 30h14"/><path d="M20 30a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0a7 7 0 0 1 14 0"/>'),
  diode: wrap(diodeBody),
  led: wrap(diodeBody + rays),
  bjt: wrap(
    '<circle cx="52" cy="24" r="18"/><path d="M6 24h38M44 12v24M44 18l16-12V2M44 30l16 12v4"/><path d="M60 42l-8-1 4-6z" fill="currentColor"/>',
  ),
  mosfet: wrap(
    '<path d="M6 32h30M36 14v18M44 12v6M44 21v6M44 30v6M44 15h18V4M44 33h18v11M44 24h18v9"/><path d="M44 24l8-4v8z" fill="currentColor"/>',
  ),
  ic555: wrap(
    '<rect x="30" y="4" width="36" height="40" rx="2"/><path d="M44 4a4 4 0 0 0 8 0"/><path d="M18 12h12M18 20h12M18 28h12M18 36h12M66 12h12M66 20h12M66 28h12M66 36h12"/>',
  ),
  crystal: wrap('<path d="M6 24h30M60 24h30M36 12v24M60 12v24"/><rect x="41" y="10" width="14" height="28" rx="1"/>'),
  button: wrap('<path d="M6 34h22M68 34h22"/><circle cx="28" cy="34" r="2.5" fill="currentColor"/><circle cx="68" cy="34" r="2.5" fill="currentColor"/><path d="M24 24h48M48 24V10M40 10h16"/>'),
};
