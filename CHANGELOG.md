# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]
### Thêm
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
### Sửa
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
