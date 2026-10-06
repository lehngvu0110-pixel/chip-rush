# ADR-0001: Dùng Canvas 2D thuần thay cho Phaser

- **Ngày:** 2026-10-06
- **Trạng thái:** Chấp nhận

## Bối cảnh
Game chỉ vẽ lưới, đường thẳng, khối chữ nhật và hiệu ứng phát sáng; không cần vật lý, sprite sheet hay tilemap. Ngân sách JS lần tải đầu là 120 KB gzip. Phaser 3 bản đầy đủ khoảng vài trăm KB gzip (chưa đo chính xác cho phiên bản hiện tại).

## Quyết định
Dùng Canvas 2D API trực tiếp cho bàn chơi, DOM + CSS cho menu/HUD.

## Hệ quả
- Bundle nhỏ, tải nhanh trên 4G và máy yếu (Redmi Note 8).
- Phải tự viết: vòng lặp, scale theo devicePixelRatio, hit-test trên lưới, tween đơn giản.
- Xem lại nếu cần vật lý hoặc animation phức tạp.
