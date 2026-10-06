# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-07
**Đã làm**
- `src/core/circuit/types.ts`: kiểu Netlist, lỗi mạch, mô hình lỗi KIỂM THỬ (`gate-invert`, `stuck-at`).
- `src/core/circuit/gates.ts`: 7 loại cổng (NOT, AND, OR, XOR, NAND, NOR, XNOR) bằng phép toán bit.
- `src/core/circuit/simulate.ts`: kiểm tra mạch (đoản mạch, dây hở, vòng lặp tổ hợp, sai số chân, trùng id) → sắp topo → mô phỏng, bảng chân trị, so bảng chân trị, Delay (độ sâu logic), Power (đếm toggle theo mã Gray), cài lỗi.
- 39 test, trong đó 1 test đối chiếu 500 mạch ngẫu nhiên với bộ đánh giá tham chiếu viết kiểu khác (đệ quy theo net).
- Kiểm tra đột biến thủ công: cố tình làm sai XOR, bỏ bước đầu của đếm toggle, bỏ stuck-at → test đều đỏ, nghĩa là test bắt được lỗi thật.

**Quyết định**
- Mô phỏng ở mức netlist; lưới vẽ (grid.ts) sẽ chuyển sang netlist sau. Nhờ vậy solver và chế độ KIỂM THỬ dùng chung bộ mô phỏng.
- Báo **mọi** lỗi mạch một lần thay vì dừng ở lỗi đầu, để UI tô đỏ tất cả chỗ sai.
- Lỗi vòng lặp chỉ báo cổng thực sự nằm trong vòng, không báo cổng phía sau.
- Power đếm cả net đầu vào và không tính bước quay vòng về hàng đầu (đã ghi trong code, cần ghi thêm vào SPEC nếu Vũ đồng ý).

**Việc tiếp theo**
- 08/10: canvas, pointer, audio, theme, platform/ (storage, visibility, errors), overlay đo hiệu năng.

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
