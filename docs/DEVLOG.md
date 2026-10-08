# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-10 – Chia sẻ kết quả, âm thanh từng chế độ, Cài đặt
**Đã làm**
- `src/render/share-card.ts`: ảnh chia sẻ 1080×1350 (logo, chế độ, màn, sao, điểm lớn, PPA, link game) vẽ bằng Canvas, tạo sẵn khi thẻ kết quả mở để không mất "user gesture" trên iOS.
- `src/platform/share.ts`: chia sẻ theo bậc — Web Share kèm ảnh → Web Share chỉ chữ → sao chép lời mời vào clipboard → hộp thoại hiện chữ để tự chép. Nút "Chia sẻ kết quả" có ở cả 3 thẻ kết quả (THIẾT KẾ chỉ khi kết quả được tính, tức không xem lời giải AI).
- Âm thanh tổng hợp (Web Audio, không dùng file): đặt cổng, đo dây, thắng, thua, mở khoá cổng mới.
- Bảng Cài đặt (nút bánh răng ở màn chính): Âm thanh, Giảm chuyển động (mặc định theo hệ điều hành), giới thiệu + link mã nguồn, "Xoá toàn bộ tiến độ" phải bấm 2 lần và giữ lại cài đặt.
- 7 unit test chia sẻ (đủ các nhánh dự phòng, huỷ chia sẻ không báo lỗi) + 2 E2E (Cài đặt, chia sẻ khi không có Web Share). Tổng 259 unit, 8 E2E xanh; JS 44 KB gzip.

**Quyết định**
- Ảnh chia sẻ chỉ chứa điểm + link, không chứa tên người chơi hay dữ liệu cá nhân.
- Người dùng bấm "Huỷ" ở bảng chia sẻ hệ thống thì im lặng, không coi là lỗi.

**Việc tiếp theo**
- Hướng dẫn lần đầu (d01, t01), ảnh/logo nộp bài, README.

## 2026-10-09 – Màn hình chính "die chip" + Gợi ý THIẾT KẾ
**Đã làm**
- `src/modes/hub/hub-scene.ts`: màn hình chính là một die chip nhìn từ trên xuống, 3 khối THIẾT KẾ / KIỂM THỬ / VẬN HÀNH (hoạ tiết riêng: hàng ô chuẩn, lưới điểm đo, làn bit), thanh tiến độ, khoá, xung dữ liệu chạy trên bus giữa các khối. Nút DOM trong suốt đè đúng vị trí khối (trình đọc màn hình + test bấm được).
- `src/core/level/hint.ts`: Gợi ý = bước kế tiếp của lời giải AI (cổng trước, rồi dây/via lan từ công tắc). Bấm lần 1 chỉ cảnh báo "tối đa 2 sao", lần 2 hiện bóng mờ cam + tự chọn công cụ phù hợp. Ghi `hinted` vào tiến độ.
- 15 test gợi ý: làm theo gợi ý liên tục từ lưới trống luôn qua màn ở cả 12 màn (tổng 252 unit).
- Sửa: nút khối die bị nền `.btn` che mờ (CSS specificity).

**Việc tiếp theo**
- Vũ: duyệt các mục "chờ duyệt" (lưới THIẾT KẾ, KIỂM THỬ, mở khoá KIỂM THỬ sau d05).
- Chia sẻ kết quả (Web Share + dự phòng sao chép), âm thanh từng chế độ, đo hiệu năng lại trên 3 máy.

## 2026-10-08 (3) – Chế độ KIỂM THỬ chơi được (t01–t06) + solver minimax
**Đã làm**
- Tách `src/modes/design/board.ts` (lưới + mô phỏng có cài lỗi + vẽ) dùng chung cho THIẾT KẾ và KIỂM THỬ.
- `src/core/debug/faults.ts`: liệt kê lỗi (đảo cổng, kẹt 0/1), chữ ký đầu ra, lớp tương đương theo dây quan sát được.
- `src/ai/debug-solver.ts`: cây quyết định minimax (tối ưu ≤ 16 lớp), tham lam khi nhiều hơn; `runTree` để kiểm chứng.
- 6 màn t01–t06: AI kỹ sư tự bố trí mạch lên lưới, minimax tính par (0–3 lần đo, đều tối ưu).
- `src/modes/debug/debug-scene.ts`: đo dây (nhãn giá trị trên dây), bảng chân trị chuẩn vs thật (tô ô lệch), báo lỗi (cổng hoặc dây kẹt 0/1), báo sai 2 lần / đo quá giới hạn thì thua và hiện lỗi thật (cả lớp tương đương).
- Thẻ chế độ KIỂM THỬ, danh sách màn, thẻ kết quả, lưu `save.debug`.
- 23 unit test (gồm đối chiếu vét cạn mọi cây quyết định) + 2 E2E (tổng 237 unit, 6 E2E).

**Quyết định**
- ADR-0008: đèn xem miễn phí; lớp tương đương theo dây đo được; giới hạn đo max(2·par, 3).

**Việc tiếp theo**
- Vũ: duyệt các làm rõ KIỂM THỬ (SPEC mục 3) — đặc biệt quy tắc mở khoá sau d05.
- Hub "die chip" (22/10 theo kế hoạch), gợi ý THIẾT KẾ, Daily Chip.

## 2026-10-08 (2) – AI kỹ sư (solver) + d10, d12 + đồ hoạ THIẾT KẾ
**Đã làm**
- `src/ai/design-solver.ts`: đặt cổng (duyệt hết / beam search), branch-and-bound với cận dưới, đi dây Dijkstra + PathFinder. `tools/solve-levels.ts` → `solutions.json`.
- AI thắng lời giải viết tay ở d05, d06, d08, d09, d11 (d11: C 34 → 30); chứng minh tối ưu 7/12 màn (d01–d06, d08).
- Màn mới d10 (MUX 2:1) và d12 (cộng đủ, 5 cổng) — chỉ khai báo mạch logic, AI tự bố trí.
- Đồ hoạ: "dòng điện" chạy dọc dây mang bit 1 đúng chiều tín hiệu, quầng sáng dây, cổng sáng khi ra 1; sao bật lần lượt, điểm chạy số; thẻ chế độ ở màn bắt đầu (biểu tượng + tiến độ); nút "Xem cách AI kỹ sư làm".
- 9 test solver + kiểm tra mọi màn bằng lời giải AI (tổng 214).

**Quyết định**
- ADR-0007. "Tối ưu" chỉ khi duyệt hết **và** chạm cận dưới (chặt hơn SPEC cũ "duyệt hết" — vì đi dây là heuristic).
- Xem lời giải AI → lần qua màn đó không tính kết quả.

**Việc tiếp theo**
- Vũ: chơi d10–d12; xem lời giải AI có dễ hiểu không.
- Chế độ KIỂM THỬ (t01–t03) + solver minimax (SPEC 5.2).

## 2026-10-08 – Chế độ THIẾT KẾ chơi được (việc 12–14/10 làm sớm)
**Đã làm**
- `src/core/level/`: định dạng màn, 10 màn d01–d09 + d11 (d10, d12 chờ solver), kiểm tra dữ liệu màn, chấm bài (mạch hợp lệ → đúng bảng chân trị → PPA, sao, điểm).
- `src/core/scoring/design.ts`: C = A + 3D + P, sao, điểm chia sẻ 1000 × C_par / C.
- `src/modes/design/`: scene THIẾT KẾ — kéo ngón tay vẽ dây (tự chèn ô khi lướt nhanh), đặt/xoay cổng, via, tẩy, đổi lớp, hoàn tác (Ctrl+Z), xoá hết; mô phỏng trực tiếp (dây sáng theo bit, kể cả khi đang vẽ dở); bảng chân trị ngang có dấu đúng/sai từng cột, chạm cột để đặt công tắc; tô đỏ ô lỗi; dòng PPA trực tiếp so với AI kỹ sư.
- Danh sách màn (khoá/mở, sao), thẻ kết quả (bảng Bạn vs AI kỹ sư), lưu tiến độ `save.design`.
- 35 unit test mới (tổng 179) + 2 E2E mới (qua d01 bằng kéo thật, hoàn tác).

**Quyết định**
- Par tạm = PPA lời giải viết tay (ghi rõ trong SPEC, LEVELS: "Tối ưu? = Chưa") cho tới khi có solver.
- Thanh công cụ 2 hàng + 1 dải gợi ý/thông báo để lưới đủ lớn: test bảo đảm ô ≥ 44 px trên Redmi Note 8 và iPhone 11.

**Việc tiếp theo**
- Vũ: chơi thử d01–d11 trên điện thoại, ghi chỗ khó hiểu vào cột "Ghi chú chơi thử" của LEVELS.md; duyệt mô hình lưới (SPEC mục 2).
- Solver AI kỹ sư (SPEC 5.1) → par thật + d10, d12.

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
