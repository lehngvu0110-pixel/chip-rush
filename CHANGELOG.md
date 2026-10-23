# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]
### Thêm
- Góc học tập (màn chính): sơ đồ tư duy điện - điện tử 6 nhánh / 29 ý có liên kết sang linh kiện 3D và màn chơi; trắc nghiệm 10 câu (32 câu lý thuyết + 7 dạng câu tính toán đổi số mỗi lượt) có lời giải, xem lại câu sai, lưu kỷ lục (`learn` trong dữ liệu lưu). Thư viện linh kiện chuyển vào Góc học tập.
- Phím Esc quay lại ở các bảng; hover trên máy có chuột; bảng giữa hiện mờ dần.
- Chế độ thứ tư LẮP RÁP: 11 màn cắm linh kiện lên bo mạch (LED + điện trở, đọc vạch màu, nút bấm, cổng AND/OR, diode, BJT, cổng NOT, tụ giữ điện, MOSFET + điện trở kéo xuống, mạch nháy 555). Bộ mô phỏng mạch điện tự viết, bộ chấm tự động, sao theo số lần cấp nguồn, lưu tiến độ `assembly` (dữ liệu cũ vẫn đọc được).
- Màn chính: die chip 4 khối chạy vòng THIẾT KẾ → KIỂM THỬ → LẮP RÁP → VẬN HÀNH.
- Thư viện "Linh kiện điện tử" (link ở màn chính): 11 linh kiện, mỗi cái có mô hình 3D xoay 360° và phóng to (kéo, chụm 2 ngón, lăn chuột, bàn phím), ký hiệu sơ đồ, thông số mẫu, cách nhận biết chân, liên hệ với thiết kế vi mạch. Bộ vẽ 3D tự viết trên Canvas 2D (`src/render/mesh3d.ts`), không thêm thư viện.
- Video demo 45 s (`docs/submission/demo.mp4`) và GIF cho README, quay tự động bằng `tools/demo-video.mjs`.
- Bậc đồ hoạ "min": máy chậm tự vẽ ở độ phân giải thấp hơn (CPU chậm 4×: ~23 → ~47 fps trên máy ảo); công cụ `tools/perf-bench.mjs`.
- 12 huy hiệu xuyên 3 chế độ + bảng Huy hiệu ở màn chính; trao bù cho người chơi cũ.
- 3 màn KIỂM THỬ mới: t07 Ngã ba, t08 Hai đèn chỉ đường, t09 Bỏ phiếu (5 khả năng, par 3); công cụ `tools/explore-faults.ts` chọn lỗi cho màn.
- Chơi bằng bàn phím (mũi tên, Shift + mũi tên kéo dây, Space/Enter); bố cục rộng cho máy tính/tablet (bảng chân trị bên trái lưới); nhắc xoay dọc khi điện thoại xoay ngang.
- Minh bạch AI: trang "AI kỹ sư hoạt động thế nào?", câu "đã chứng minh tối ưu / bạn có thể vượt" theo dữ liệu solver, nút "Xem AI kỹ sư đo" ở KIỂM THỬ, banner khi độ khó thích nghi nhắm vào cổng bạn hay sai.
- Chip hôm nay (Daily Chip): 28 đề THIẾT KẾ sinh + giải trước, đổi đề 00:00 giờ Việt Nam, chuỗi ngày, chia sẻ.
- Hướng dẫn lần đầu, không trừ sao: d01 (đường chấm + ngón tay ảo + 3 bước), t01 (AI chỉ dây nên đo và giải thích kết quả đo).
- Ảnh nộp bài: logo PNG, 4 ảnh in-game, ảnh bìa (`docs/submission/`, công cụ `tools/submission-assets.mjs`).
- Chia sẻ kết quả ở cả 3 chế độ: ảnh 1080×1350 + lời mời kèm link (Web Share, dự phòng sao chép).
- Âm thanh riêng cho đặt cổng, đo dây, thắng, thua, mở khoá cổng.
- Bảng Cài đặt: âm thanh, giảm chuyển động, giới thiệu, xoá tiến độ (bấm 2 lần).
- Màn hình chính dạng die chip với 3 khối THIẾT KẾ / KIỂM THỬ / VẬN HÀNH (tiến độ, khoá, xung dữ liệu).
- Gợi ý ở THIẾT KẾ (bước kế tiếp của lời giải AI, tối đa 2 sao).
- Chế độ KIỂM THỬ: 6 màn t01–t06 (đảo cổng, dây kẹt), đo dây, báo lỗi, luật thua, sao theo số lần đo; AI kỹ sư tính số lần đo tối ưu bằng minimax.
- AI kỹ sư: solver đặt cổng + đi dây (branch-and-bound, cận dưới, PathFinder) tính par; chứng minh tối ưu 7/12 màn; nút xem lời giải AI.
- Màn d10 (MUX 2:1) và d12 (cộng đủ).
- Đồ hoạ THIẾT KẾ: dòng điện chạy trên dây, quầng sáng, cổng sáng; sao bật và điểm chạy số ở thẻ kết quả; thẻ chế độ ở màn bắt đầu.
- Chế độ THIẾT KẾ chơi được: 10 màn (d01–d09, d11), vẽ dây bằng kéo ngón tay, cổng, via, 2 lớp, hoàn tác, mô phỏng trực tiếp, bảng chân trị, chấm PPA và sao so với AI kỹ sư, lưu tiến độ.
- Đồ hoạ "bo mạch neon": nền PCB có xung điện, con chip cắm vào ổ cắm cổng, ký hiệu cổng logic chuẩn trên nút, hạt sáng/vòng sóng khi đúng, rung + viền đỏ khi sai, LED mạng, thanh chuỗi đúng, logo mới, màn bắt đầu/kết quả dạng thẻ.
- Lõi lưới 2 lớp cho THIẾT KẾ: đi dây, via, đặt/xoay cổng, chuyển sang netlist, báo lỗi theo ô (chập, dây hở, đèn chưa nối, sai số chân, vòng lặp), tính Area.
- Chế độ VẬN HÀNH: Vô tận (3 mạng, độ khó thích nghi) và Thử thách 60 giây (cùng chuỗi gói theo ngày), màn kết quả, lưu kỷ lục.
- Test tự động đầu-cuối bằng Playwright.
- Nền tảng runtime: vòng lặp theo thời gian thực, canvas nét theo DPR (tối đa 2x), cảm ứng, âm thanh tổng hợp mở khóa bằng lần chạm đầu, tạm dừng khi ẩn tab/xoay màn hình, lưu trữ an toàn có dự phòng, màn hình lỗi có mã lỗi.
- Overlay đo hiệu năng `?debug=1` và màn thử nghiệm kỹ thuật (thay tạm cho nút CHƠI NGAY).
### Đổi
- Viết lại README: mục lục, ảnh trong game (`docs/screenshots/`), bảng tính năng, phím tắt, kỹ thuật, kiểm thử.
- LẮP RÁP trên màn rộng: khay linh kiện và thông báo gom vào giữa.
- Giao diện: danh sách màn rộng hết thẻ, số màn trong ô tròn (màn đã qua tô sáng, màn khoá có ổ khoá); link Huy hiệu / Linh kiện dạng viên có biểu tượng; vạch sáng ở mép trên thẻ.
- Tách `main.ts` thành các module giao diện trong `src/ui/`; bật `noUnusedLocals`/`noUnusedParameters`, xoá code chết.
### Sửa
- Thử thách 60 giây: bấm liên tục một đáp án không còn lên điểm (trước: đạt 84% điểm người chơi thật, nay khoảng 3%). Sinh gói công bằng (mỗi cổng đúng ≤ 50%), sai trừ đúng số điểm lẽ ra được cộng, bấm sai bị "chập mạch" khoá nút 0,8 s có thanh đếm ngược; trình đọc màn hình không còn báo "còn 3 mạng" ở chế độ 60 giây.
- Rà soát code 21/10 (B-02 → B-09): phím tắt không còn tác động lên lưới khi thẻ kết quả/tạm dừng đang mở; bấm KIỂM TRA 2 lần không ghi 2 kết quả; ngón tay thứ hai không cắt nét vẽ; 2 tab không ghi đè tiến độ của nhau; dữ liệu lưu hỏng không còn tạo chi phí 0 giả; `?date=` chỉ nhận ngày có thật; VẬN HÀNH bỏ qua lặp phím và tổ hợp Ctrl/Cmd; bộ đệm quầng sáng có giới hạn.
- VẬN HÀNH đọc được bằng trình đọc màn hình (vùng `aria-live`); thẻ kết quả/tạm dừng là hộp thoại `aria-modal`.
- Dữ liệu lưu hỏng ở một màn làm game văng lỗi khi qua màn đó; nay mục hỏng bị bỏ khi đọc (B-01).
- Accessibility (axe, WCAG 2.1 AA = 0 lỗi): cho phép zoom, landmark `<main>`, nhãn canvas, role cho ngôi sao, tiêu đề bảng PPA.
- CI: E2E chờ server mãi vì `vite preview` nghe ở IPv6; nay bind 127.0.0.1.
- Nút "Đo hiệu năng" chỉ hiện khi URL có `?debug=1`.
- Gọi `requestAnimationFrame` sai ngữ cảnh làm game không chạy và màn hình lỗi không hiện.
- Chữ tiếng Việt trong font mono hệ thống bị đặt dấu sai.
- Lõi mô phỏng mạch: 7 loại cổng, kiểm tra đoản mạch / dây hở / vòng lặp, bảng chân trị, Delay, Power (toggle theo mã Gray), mô hình lỗi stuck-at và gate-invert.

## [0.1.0] – 2026-10-06
### Thêm
- Khung dự án: Vite + TypeScript + Vitest, CI GitHub Actions, deploy GitHub Pages.
- Font Be Vietnam Pro đã subset (Latin + tiếng Việt), trang kiểm tra dấu `font-test.html` (chỉ ở bản dev).
- Kiểm tra ngân sách tải `tools/check-size.mjs`.
- Bộ tài liệu: SPEC (đã duyệt), GDD, ARCHITECTURE, ADR 0001–0005, ai-log.
