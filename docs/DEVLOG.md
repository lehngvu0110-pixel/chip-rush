# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-07 (task ngày 08/10, làm sớm)
**Đã làm**
- `src/platform/`: `storage.ts` (localStorage bọc try/catch, RAM dự phòng, báo mất lưu đúng 1 lần), `visibility.ts` (ẩn tab / blur / xoay → tạm dừng), `errors.ts` (bắt lỗi toàn cục, mã lỗi ổn định dạng E-XXXXXX, màn hình "Có lỗi xảy ra").
- `src/loop.ts` (dt theo thời gian thực, kẹp 0,1 s), `src/scene.ts`, `render/canvas.ts` (DPR kẹp tối đa 2), `render/theme.ts`, `render/audio.ts` (Web Audio tổng hợp, mở khóa bằng lần chạm đầu, tắt tiếng), `input/pointer.ts`.
- `debug/stats.ts` + `debug/perf-overlay.ts` (`?debug=1`: frame time trung vị/p95, độ trễ chạm, nút "Đo 60 s", sao chép kết quả JSON), tự tắt glow khi p95 > 33,4 ms.
- `debug/sandbox-scene.ts`: màn thử nghiệm kỹ thuật (lưới chạm/kéo, chấm chạy chu kỳ 3,00 s để kiểm tra màn 120 Hz, nút "Tải nặng").
- 72 unit test. Chạy thử bản build trên Chromium (giả lập Pixel 7) bằng Playwright: luồng chính, tạm dừng/tiếp tục, xoay ngang, localStorage bị chặn, nhúng iframe khác origin, lỗi runtime, font bị chặn.

**Lỗi tìm được khi chạy thử trên trình duyệt (unit test không bắt được)**
1. Vòng lặp gọi `requestAnimationFrame` tách khỏi `window` → "Illegal invocation": game không chạy, và màn hình lỗi cũng không hiện vì bộ xử lý lỗi gọi `cancelAnimationFrame` cũng hỏng. Đã sửa + thêm test hồi quy (test đỏ với code cũ, xanh với code mới); bộ xử lý lỗi giờ vẫn hiện màn hình lỗi kể cả khi dừng vòng lặp thất bại.
2. Font mono hệ thống đặt dấu tiếng Việt sai ("trễ" → "trê˜"). Đã chuyển chữ có dấu sang Be Vietnam Pro; font mono chỉ dùng cho chữ số (ghi vào ADR-0003).

**Việc tiếp theo**
- Vũ: chạy `npm run dev`, mở `http://<IP-Mac>:5173/?debug=1` trên 3 điện thoại, bấm CHƠI NGAY → "Đo 60 s" (vừa chạm/kéo vừa bật "Tải nặng" 30 s cuối) → dán kết quả vào `docs/TESTING.md`.
- 09/10: chế độ VẬN HÀNH + Playwright E2E kịch bản 1.

## 2026-10-07 (task ngày 07/10)
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
