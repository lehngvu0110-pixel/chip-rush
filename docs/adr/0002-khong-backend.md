# ADR-0002: Không có backend

- **Ngày:** 2026-10-06
- **Trạng thái:** Chấp nhận

## Bối cảnh
Game chạy trong Portal của BTC (có thể là iframe); chưa biết Portal có chặn request ra ngoài không. Backend thêm chi phí vận hành, rủi ro bảo mật, rủi ro lộ khóa API trong repo public, và dữ liệu cá nhân.

## Quyết định
Toàn bộ game là file tĩnh. AI chạy trên trình duyệt hoặc tính sẵn offline. Tiến độ lưu `localStorage`.

## Hệ quả
- Không có bảng xếp hạng chung, không đo được hành vi người chơi thật (chỉ đo bằng chơi thử).
- Không có rủi ro lộ secret; quyền riêng tư đơn giản.
- Xem lại nếu BTC cho phép gọi mạng và cần bộ đếm truy cập không cookie.
