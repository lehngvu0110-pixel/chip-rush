import './ui/styles.css';
import { versionLabel } from './config';

// Điểm vào của game. Hiện mới là màn hình giữ chỗ; Hub thật làm ngày 22/10 (xem kế hoạch).
function boot(root: HTMLElement): void {
  root.innerHTML = `
    <h1 class="title">CHIP RUSH</h1>
    <p class="subtitle">Thiết kế · Kiểm thử · Vận hành</p>
    <button class="btn" type="button" disabled>CHƠI NGAY</button>
    <p class="version">Đang xây dựng · ${versionLabel()}</p>
  `;
}

const root = document.getElementById('app');
if (root) boot(root);
