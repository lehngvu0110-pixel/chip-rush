# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-06
**Đã làm**
- Đọc điều lệ Phần thi Công nghệ; chọn ý tưởng CHIP RUSH (3 chế độ theo vòng đời con chip).
- Lập kế hoạch dự án, nhận góp ý từ người ngoài và bổ sung: MVP + thứ tự cắt, đặc tả gameplay, phạm vi AI, yêu cầu phi chức năng, kế hoạch kiểm thử.
- Vũ duyệt luật chơi → chép vào `docs/SPEC.md`.
- Dựng repo: Vite 8 + TypeScript 7 + Vitest 5, CI GitHub Actions, kiểm tra dung lượng.
- Font Be Vietnam Pro: subset còn 53,3 KB; phát hiện thiếu `tnum` và ký hiệu ✓ ✕ ↔ (ghi trong ADR-0003).

**Quyết định**
- Canvas thuần thay Phaser (ADR-0001), không backend (ADR-0002), không service worker (ADR-0004), par tính offline (ADR-0005).
- Font đặt trong `src/assets/fonts` để có hash (thay vì `public/fonts` như kế hoạch ban đầu).
- Thiết bị test: Redmi Note 8 (Android yếu), iPhone 11 (chuẩn iOS), iPhone 14 Pro Max (120 Hz).

**Việc tiếp theo**
- Vũ: gửi BTC 7 câu hỏi; mở `font-test.html` trên 3 điện thoại; tạo repo GitHub và bật Pages.
- 07/10: `gates.ts`, `simulate.ts` + test.
