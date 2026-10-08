// Biểu tượng SVG nội tuyến (font Be Vietnam Pro không có ký tự ⏸ 🔊 nên không dùng chữ).
// Chỉ là chuỗi tĩnh do mình viết, không chứa dữ liệu người dùng → gán innerHTML an toàn.
const svg = (body: string, size = 22): string =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** Ngôi sao (font không có ký tự ★). */
export const ICON_STAR = '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" fill="currentColor"/></svg>';

export const ICON_PAUSE = svg('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>');
export const ICON_SOUND_ON = svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>');
export const ICON_SOUND_OFF = svg('<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>');

/** Logo CHIP RUSH: vỏ chip có chân + tia chớp (= "rush"). Dùng ở màn bắt đầu và làm logo nộp bài. */
export const LOGO_SVG = `<svg viewBox="0 0 120 120" width="96" height="96" role="img" aria-label="Logo CHIP RUSH">
<defs>
<linearGradient id="lgBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2852"/><stop offset="1" stop-color="#0b1126"/></linearGradient>
<linearGradient id="lgBolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffb020"/></linearGradient>
</defs>
<g fill="#38e8ff">
<rect x="36" y="10" width="6" height="14" rx="2"/><rect x="50" y="10" width="6" height="14" rx="2"/><rect x="64" y="10" width="6" height="14" rx="2"/><rect x="78" y="10" width="6" height="14" rx="2"/>
<rect x="36" y="96" width="6" height="14" rx="2"/><rect x="50" y="96" width="6" height="14" rx="2"/><rect x="64" y="96" width="6" height="14" rx="2"/><rect x="78" y="96" width="6" height="14" rx="2"/>
<rect x="10" y="36" width="14" height="6" rx="2"/><rect x="10" y="50" width="14" height="6" rx="2"/><rect x="10" y="64" width="14" height="6" rx="2"/><rect x="10" y="78" width="14" height="6" rx="2"/>
<rect x="96" y="36" width="14" height="6" rx="2"/><rect x="96" y="50" width="14" height="6" rx="2"/><rect x="96" y="64" width="14" height="6" rx="2"/><rect x="96" y="78" width="14" height="6" rx="2"/>
</g>
<rect x="22" y="22" width="76" height="76" rx="12" fill="url(#lgBody)" stroke="#38e8ff" stroke-width="3"/>
<rect x="34" y="34" width="52" height="52" rx="6" fill="none" stroke="#38e8ff" stroke-opacity="0.35" stroke-width="1.5"/>
<circle cx="33" cy="33" r="3" fill="#38e8ff" fill-opacity="0.6"/>
<path d="M66 36 L48 63 H59 L54 84 L73 55 H62 Z" fill="url(#lgBolt)" stroke="#fff3c4" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
