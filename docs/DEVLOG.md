# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-07 (4) – Đồ hoạ bo mạch neon + lưới 2 lớp (việc 10–11/10 làm sớm)
**Đã làm**
- Sửa CI: `vite preview` bind `127.0.0.1` (trên runner, `localhost` có thể ra IPv6 nên Playwright chờ mãi). CI xanh, GitHub Pages chạy.
- Đồ hoạ (Vũ chọn phong cách "bo mạch neon"): nền PCB sinh từ seed + xung điện; con chip có chân cắm vào ổ; nút có ký hiệu cổng IEEE; hạt sáng, vòng sóng, rung, viền đỏ khi sai; điểm đếm số; thanh chuỗi đúng 5 vạch; mạng là LED; logo SVG; màn bắt đầu/kết quả/tạm dừng dạng thẻ. Nút "Đo hiệu năng" chỉ hiện với `?debug=1`.
- `src/core/circuit/grid.ts`: lưới 2 lớp (dây theo cạnh, via, cổng 1 ô có chân theo phía, lưu/nạp/hoàn tác).
- `src/core/circuit/netlist.ts`: lưới → netlist (union-find), `diagnose` dịch lỗi mạch sang ô lưới để tô đỏ, `areaOf`.
- 49 test mới (14 lưới, 25 netlist, 10 đồ hoạ thuần): dây cắt nhau, chập, dây hở, cầu vượt, cổng xoay, vòng lặp, half adder trên lưới khớp mạch mẫu (Delay 1, Power 8).

**Quyết định**
- ADR-0006: ánh sáng bằng sprite thay `shadowBlur`, nền vẽ 1 lần.
- Mô hình lưới (chờ Vũ duyệt, ghi trong SPEC mục 2): dây theo cạnh; cắt nhau cùng lớp = chập; cổng 1 ô.

**Việc tiếp theo**
- Vũ: đo lại hiệu năng 3 máy với `?debug=1` ngay trong màn chơi; duyệt mô hình lưới.
- 12–13/10: scene THIẾT KẾ (vẽ dây bằng kéo ngón tay, đặt cổng, kiểm tra, hoàn tác) dùng `grid.ts` + `gate-symbol.ts`.

## 2026-10-07 (task ngày 09/10, làm sớm)
**Đã làm**
- Chế độ **VẬN HÀNH** chơi trọn vòng: CHƠI NGAY → Vô tận (3 mạng, độ khó thích nghi) hoặc Thử thách 60 giây (seed theo ngày) → màn kết quả → Chơi lại / Về màn chính; kỷ lục lưu lại sau khi tải trang.
- Logic thuần (test được): `core/util/rng.ts`, `core/scoring/runtime.ts`, `ai/adaptive.ts` (Thompson sampling + điều tốc), `modes/runtime/spawner.ts`, `modes/runtime/game.ts`, `core/progress.ts`.
- Màn chơi: `modes/runtime/runtime-scene.ts` — gói bit rơi, 4 nút cổng 2×2 (cao 72 px) có gợi ý ý nghĩa cổng, phím tắt 1–4, nút Dừng, hiệu ứng đúng/sai, thông báo mở khóa cổng.
- Màn kết quả giải thích độ khó thích nghi ("Bạn hay sai cổng XOR nên game đã ra thêm câu XOR").
- 95 unit test; Playwright E2E kịch bản 1 (2 test) xanh trên Chromium giả lập Pixel 7; CI thêm bước E2E (Chromium + WebKit).

**Phát hiện khi viết test**
- Phép kiểm chứng độ khó thích nghi trong SPEC sai: với người chơi có xác suất đúng cố định, điều tốc không thể kéo tỉ lệ đúng về 75–85%. Đã đổi sang mô hình "càng nhanh càng dễ sai": có thích nghi đạt 81%, đường cố định chỉ 74% (ngoài vùng mục tiêu).

**Phát hiện khi xem ảnh chụp màn hình**
- Trả lời nhanh liên tiếp làm chữ "+20 ×2" chồng lên nhau → chỉ giữ 1 chữ nổi.
- "Đúng là: XOR" hiện khi gói mới đã ra → dễ hiểu nhầm là đáp án gói mới; đổi thành "Gói vừa rồi cần: XOR".
- Viền focus màu cam hiện sẵn trên nút khi mở trang bằng điện thoại → bỏ tự focus ở màn bắt đầu.

**Chưa kiểm chứng**
- Dự án WebKit (giả lập iPhone SE) của Playwright chưa chạy được ở máy làm việc (không tải được trình duyệt); sẽ chạy lần đầu trên GitHub Actions sau khi push.

**Việc tiếp theo**
- Vũ: chơi thử trên 3 điện thoại; đo hiệu năng bằng `?debug=1` (giờ đo được ngay khi đang chơi VẬN HÀNH).
- 10–11/10: `grid.ts` (lưới 2 lớp) + `netlist.ts` cho chế độ THIẾT KẾ.

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
