// Màn bắt đầu: logo, die chip 4 khối (canvas vẽ ở HubScene, nút DOM trong suốt đè lên),
// nút Chip hôm nay, CHƠI NGAY / 60 giây, kỷ lục, Huy hiệu, Linh kiện điện tử. Chỉ dựng DOM; hành động qua callback.
import { versionLabel } from '../config';
import { DIE_BLOCKS, type BlockId } from '../modes/hub/hub-scene';
import { action, button, el } from './dom';
import { ICON_GEAR, ICON_MEDAL, ICON_PART, LOGO_SVG } from './icons';

export interface StartScreenData {
  /** "26/10" */
  dateLabel: string;
  /** số sao đề hôm nay nếu đã xong */
  doneStars: number | null;
  streak: number;
  bestEndless: number;
  best60: number;
  badges: { earned: number; total: number };
  /** hiện nút màn đo hiệu năng (chỉ khi ?debug) */
  showPerf: boolean;
}

export interface StartScreenActions {
  onDesign: () => void;
  onDebug: () => void;
  onAssembly: () => void;
  onRuntime: (mode: 'endless' | 'sixty') => void;
  onDaily: () => void;
  onSettings: () => void;
  onBadges: () => void;
  onParts: () => void;
  onPerf: () => void;
}

/** Trả về các nút/khối để gắn vào panel và ô `slot` cho HubScene vẽ die chip. */
export function startScreen(d: StartScreenData, a: StartScreenActions): { nodes: HTMLElement[]; slot: HTMLDivElement } {
  const logo = el('div', 'logo');
  logo.innerHTML = LOGO_SVG;
  const hero = el('div', 'hero');
  const titleRow = el('div', 'title-row');
  titleRow.append(logo, el('h1', 'title', 'CHIP RUSH'));
  hero.append(titleRow, el('p', 'subtitle', 'Thiết kế · Kiểm thử · Lắp ráp · Vận hành'));

  // Die chip: nút DOM trong suốt đặt đúng vị trí từng khối (trình đọc màn hình + test bấm được)
  const slot = el('div', 'die-slot');
  const blockBtn = (id: BlockId, name: string, onClick: () => void): void => {
    const b = DIE_BLOCKS[id];
    const btn = action('die-btn', '', onClick);
    btn.setAttribute('aria-label', name);
    btn.style.left = `${b.x * 100}%`;
    btn.style.top = `${b.y * 100}%`;
    btn.style.width = `${b.w * 100}%`;
    btn.style.height = `${b.h * 100}%`;
    slot.append(btn);
  };
  blockBtn('design', 'THIẾT KẾ: tự vẽ mạch', a.onDesign);
  blockBtn('debug', 'KIỂM THỬ: tìm lỗi chip', a.onDebug);
  blockBtn('assembly', 'LẮP RÁP: cắm linh kiện lên bo mạch', a.onAssembly);
  blockBtn('runtime', 'VẬN HÀNH: chơi vô tận', () => a.onRuntime('endless'));

  // Chip hôm nay: trạng thái hôm nay + chuỗi ngày
  const daily = action('btn-daily', '', a.onDaily);
  const starTxt = (n: number): string => {
    const k = Math.max(0, Math.min(3, Math.floor(n) || 0)); // dữ liệu lưu lạ không được làm văng màn chính
    return `${'★'.repeat(k)}${'☆'.repeat(3 - k)}`;
  };
  daily.append(
    el('strong', '', `CHIP HÔM NAY · ${d.dateLabel}`),
    el(
      'small',
      '',
      d.doneStars !== null
        ? `Đã xong ${starTxt(d.doneStars)} · chuỗi ${d.streak} ngày`
        : d.streak > 0
          ? `Làm đề hôm nay để giữ chuỗi ${d.streak} ngày!`
          : 'Mỗi ngày một con chip mới, ai cũng cùng đề',
    ),
  );
  daily.setAttribute('aria-label', `Chip hôm nay, ngày ${d.dateLabel}${d.doneStars !== null ? `, đã xong ${d.doneStars} sao` : ''}, chuỗi ${d.streak} ngày`);
  daily.classList.toggle('done', d.doneStars !== null);

  const actions = el('div', 'start-actions');
  actions.append(action('btn-primary', 'CHƠI NGAY', () => a.onRuntime('endless')), action('btn-secondary sixty', 'Thử thách 60 giây', () => a.onRuntime('sixty')));

  const gear = button('btn-icon gear', '');
  gear.innerHTML = ICON_GEAR;
  gear.setAttribute('aria-label', 'Cài đặt');
  gear.addEventListener('click', a.onSettings);

  const badgeLink = action('btn-chip badge-link', '', a.onBadges);
  badgeLink.innerHTML = ICON_MEDAL;
  badgeLink.append(el('span', '', `Huy hiệu ${d.badges.earned}/${d.badges.total}`));
  badgeLink.setAttribute('aria-label', `Huy hiệu: đã đạt ${d.badges.earned} trên ${d.badges.total}`);
  const links = el('div', 'start-links');
  const partsLink = action('btn-chip parts-link', '', a.onParts);
  partsLink.innerHTML = ICON_PART;
  partsLink.append(el('span', '', 'Linh kiện điện tử'));
  links.append(badgeLink, partsLink);

  // Màn đo hiệu năng chỉ dành cho nhóm phát triển
  const perf = action('btn-link', 'Đo hiệu năng (dành cho nhóm phát triển)', a.onPerf);
  perf.hidden = !d.showPerf;

  return {
    slot,
    nodes: [
      gear,
      hero,
      slot,
      daily,
      actions,
      el('p', 'note', 'Chạm một khối của con chip để chọn công đoạn: thiết kế mạch, tìm lỗi, lắp linh kiện lên bo, rồi vận hành. CHƠI NGAY = VẬN HÀNH.'),
      el('p', 'records', `Kỷ lục: Vô tận ${d.bestEndless} · 60 giây ${d.best60}`),
      links,
      perf,
      el('p', 'version', versionLabel()),
    ],
  };
}
