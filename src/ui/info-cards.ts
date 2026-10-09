// Các thẻ "đứng yên" (không phải kết quả): danh sách màn, trang "AI kỹ sư hoạt động thế nào?", Cài đặt.
// Chỉ dựng DOM; đọc/ghi tiến độ và chuyển màn qua callback từ main.ts.
import { versionLabel } from '../config';
import { aiStats } from '../core/level/ai-info';
import { action, button, el, extLink, starsEl } from './dom';

export const REPO_URL = 'https://github.com/lehngvu0110-pixel/chip-rush';
export const AI_LOG_URL = `${REPO_URL}/tree/main/docs/ai-log`;

// ---------------- Danh sách màn (THIẾT KẾ, KIỂM THỬ) ----------------
export interface LevelItem {
  id: string;
  name: string;
  /** dòng nhỏ dưới tên: khái niệm khi đã mở, lý do khoá khi chưa */
  sub: string;
  open: boolean;
  stars: number;
  onPick: () => void;
}

export function levelListCard(o: { title: string; note: string; items: LevelItem[]; onAiInfo: () => void; onBack: () => void }): HTMLDivElement {
  const card = el('div', 'card level-card');
  card.append(el('p', 'card-title', o.title), el('p', 'note', o.note), action('btn-link', 'AI kỹ sư là gì?', o.onAiInfo));
  const list = el('div', 'level-list');
  for (const it of o.items) {
    const b = button('level-item', '');
    b.disabled = !it.open;
    const head = el('span', 'level-head');
    head.append(el('strong', '', `${it.id.toUpperCase()} · ${it.name}`), el('small', '', it.sub));
    b.append(head, starsEl(it.stars, `${it.stars} sao`));
    b.setAttribute('aria-label', `${it.id} ${it.name}${it.open ? '' : ', chưa mở'}, ${it.stars} sao`);
    b.addEventListener('click', it.onPick);
    list.append(b);
  }
  card.append(list, action('btn-secondary', 'Về màn chính', o.onBack));
  return card;
}

// ---------------- "AI kỹ sư hoạt động thế nào?" (ứng dụng AI có trách nhiệm) ----------------
export function aiInfoCard(onBack: () => void): { card: HTMLDivElement; focus: HTMLButtonElement } {
  const st = aiStats();
  const card = el('div', 'card level-card ai-info');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'AI kỹ sư hoạt động thế nào?');
  card.append(el('p', 'card-title', 'AI kỹ sư hoạt động thế nào?'));
  const body = el('div', 'ai-body');
  const sec = (title: string, how: string, limit: string): void => {
    const d = el('section', 'ai-sec');
    d.append(el('h3', '', title), el('p', '', how), el('p', 'ai-limit', limit));
    body.append(d);
  };
  body.append(el('p', 'note', 'AI kỹ sư không phải chatbot. Đó là 3 thuật toán tìm kiếm cổ điển, tính sẵn hoặc chạy ngay trên máy bạn — không gửi dữ liệu đi đâu, không học gì từ bạn ngoài ván đang chơi.'));
  sec(
    'THIẾT KẾ – tìm mạch rẻ nhất',
    `Thử các cách đặt cổng, bỏ sớm những nhánh chắc chắn không tốt hơn (branch-and-bound với cận dưới), rồi đi dây bằng PathFinder — thuật toán đi dây của chip FPGA. Chứng minh tối ưu ${st.designProven}/${st.designTotal} màn và ${st.dailyProven}/${st.dailyTotal} đề Chip hôm nay.`,
    'Giới hạn: "tối ưu" chỉ đúng với cách ghép cổng của AI; bạn ghép khác vẫn có thể rẻ hơn. Màn chưa chứng minh là kết quả tốt nhất AI tìm được — vượt được!',
  );
  sec(
    'KIỂM THỬ – đo ít nhất',
    `Coi mỗi lần đo là một câu hỏi có/không và tìm cây câu hỏi ngắn nhất trong trường hợp xấu nhất (minimax). Tối ưu ở ${st.debugOptimal}/${st.debugTotal} màn, đã đối chiếu với cách vét cạn mọi cây.`,
    'Giới hạn: chỉ chắc chắn tối ưu khi có ≤ 16 nhóm lỗi; nhiều hơn thì dùng cách tham lam. Sau mỗi màn bấm "Xem AI kỹ sư đo" để xem từng bước.',
  );
  sec(
    'VẬN HÀNH – ra đề theo điểm yếu',
    'Đếm bạn hay sai cổng nào rồi rút thăm có trọng số (Thompson sampling) để ra thêm câu loại đó; 30% câu vẫn ngẫu nhiên. Tốc độ tự chỉnh để bạn đúng khoảng 75–85%. Khi AI bắt đầu nhắm vào một cổng, game báo ngay trên màn hình.',
    'Giới hạn: chỉ nhớ trong 1 ván. Thử thách 60 giây tắt AI để mọi người cùng một đề, so điểm công bằng.',
  );
  sec(
    'AI trong quá trình làm game',
    'Nhóm dùng trợ lý AI (Claude) để viết code và tài liệu; mọi yêu cầu và phần đã kiểm tra được ghi công khai trong nhật ký AI trên GitHub. Hình vẽ bằng code, âm thanh tổng hợp — không dùng AI tạo ảnh hay âm thanh.',
    'Mọi kết quả AI tạo ra đều được kiểm tra bằng test tự động và người chơi thử.',
  );
  body.append(extLink('repo-link', 'Xem nhật ký AI trên GitHub', AI_LOG_URL));
  const close = action('btn-primary', 'Đã hiểu', onBack);
  card.append(body, close);
  return { card, focus: close };
}

// ---------------- Cài đặt ----------------
export interface SettingsDeps {
  /** đọc / đặt lại giá trị (main.ts tự lưu + áp dụng) */
  sound: { get: () => boolean; set: (on: boolean) => void };
  reducedMotion: { get: () => boolean; set: (on: boolean) => void };
  /** hệ điều hành đang bật "giảm chuyển động" */
  systemReduced: boolean;
  onAiInfo: () => void;
  /** chỉ gọi sau khi bấm lần 2 */
  onReset: () => void;
  onClose: () => void;
}

export function settingsCard(d: SettingsDeps): { card: HTMLDivElement; focus: HTMLButtonElement } {
  const card = el('div', 'card level-card');
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Cài đặt');
  card.append(el('p', 'card-title', 'Cài đặt'));
  const toggle = (label: string, s: { get: () => boolean; set: (v: boolean) => void }): HTMLButtonElement => {
    const b = button('setting', '');
    const sync = (): void => {
      b.textContent = `${label}: ${s.get() ? 'Bật' : 'Tắt'}`;
      b.setAttribute('aria-pressed', String(s.get()));
    };
    b.addEventListener('click', () => {
      s.set(!s.get());
      sync();
    });
    sync();
    return b;
  };
  card.append(toggle('Âm thanh', d.sound), toggle('Giảm chuyển động', d.reducedMotion));
  if (d.systemReduced) card.append(el('p', 'note', 'Máy bạn đang bật "giảm chuyển động" trong cài đặt hệ thống, game luôn tôn trọng cài đặt đó.'));
  const about = el('div', 'about');
  about.append(
    el('p', 'note', 'CHIP RUSH: thiết kế, kiểm thử và vận hành một con chip. Dự thi Phần thi Công nghệ – Road to Predator League 2027.'),
    el('p', 'note', '"AI kỹ sư" là thuật toán tìm kiếm (branch-and-bound, PathFinder, minimax) tính trước và chạy ngay trên máy bạn; game không gửi dữ liệu đi đâu.'),
    action('btn-link', 'AI kỹ sư hoạt động thế nào?', d.onAiInfo),
    extLink('repo-link', 'Mã nguồn trên GitHub', REPO_URL),
    el('p', 'version', versionLabel()),
  );
  card.append(about);
  // xoá tiến độ phải bấm 2 lần (không hoàn tác được)
  let armed = false;
  const reset = button('btn-danger', 'Xoá toàn bộ tiến độ');
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Bấm lần nữa để XOÁ HẾT (không hoàn tác)';
      return;
    }
    d.onReset();
  });
  const close = action('btn-primary', 'Xong', d.onClose);
  card.append(reset, close);
  return { card, focus: close };
}
