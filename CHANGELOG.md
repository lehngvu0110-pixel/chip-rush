# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/), phiên bản theo [SemVer](https://semver.org/lang/vi/).

## [Chưa phát hành]
### Thêm
- Chế độ VẬN HÀNH: Vô tận (3 mạng, độ khó thích nghi) và Thử thách 60 giây (cùng chuỗi gói theo ngày), màn kết quả, lưu kỷ lục.
- Test tự động đầu-cuối bằng Playwright.
- Nền tảng runtime: vòng lặp theo thời gian thực, canvas nét theo DPR (tối đa 2x), cảm ứng, âm thanh tổng hợp mở khóa bằng lần chạm đầu, tạm dừng khi ẩn tab/xoay màn hình, lưu trữ an toàn có dự phòng, màn hình lỗi có mã lỗi.
- Overlay đo hiệu năng `?debug=1` và màn thử nghiệm kỹ thuật (thay tạm cho nút CHƠI NGAY).
### Sửa
- Gọi `requestAnimationFrame` sai ngữ cảnh làm game không chạy và màn hình lỗi không hiện.
- Chữ tiếng Việt trong font mono hệ thống bị đặt dấu sai.
- Lõi mô phỏng mạch: 7 loại cổng, kiểm tra đoản mạch / dây hở / vòng lặp, bảng chân trị, Delay, Power (toggle theo mã Gray), mô hình lỗi stuck-at và gate-invert.

## [0.1.0] – 2026-10-06
### Thêm
- Khung dự án: Vite + TypeScript + Vitest, CI GitHub Actions, deploy GitHub Pages.
- Font Be Vietnam Pro đã subset (Latin + tiếng Việt), trang kiểm tra dấu `font-test.html` (chỉ ở bản dev).
- Kiểm tra ngân sách tải `tools/check-size.mjs`.
- Bộ tài liệu: SPEC (đã duyệt), GDD, ARCHITECTURE, ADR 0001–0005, ai-log.
