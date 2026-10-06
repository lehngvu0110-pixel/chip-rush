# ADR-0004: Không dùng service worker ở v1

- **Ngày:** 2026-10-06
- **Trạng thái:** Chấp nhận

## Bối cảnh
Service worker cho phép chơi offline nhưng là nguyên nhân phổ biến khiến người dùng kẹt bản cũ sau khi deploy bản sửa lỗi — rủi ro lớn trong giai đoạn bình chọn khi cần hotfix nhanh. Game không gọi mạng sau lần tải đầu nên mất mạng giữa chừng vẫn chơi tiếp được.

## Quyết định
Không đăng ký service worker. Chống cache cũ bằng tên file có hash (Vite) và hiện phiên bản ở Cài đặt.

## Hệ quả
- Phải có mạng để mở game lần đầu.
- Hotfix đến người chơi ngay khi HTML hết hạn cache (GitHub Pages: vài phút).
