# ADR-0003: Font Be Vietnam Pro, subset, đặt trong src/

- **Ngày:** 2026-10-06
- **Trạng thái:** Chấp nhận (Vũ duyệt 06/10)

## Bối cảnh
Nhiều font OFL (nhất là font pixel/display) thiếu dấu tiếng Việt. Font đầy đủ nặng ~130 KB/độ đậm.

## Quyết định
- Dùng **Be Vietnam Pro** (SIL OFL 1.1, thiết kế cho tiếng Việt), 2 độ đậm 400 và 700.
- Subset bằng `tools/subset-font.sh` (fontTools `pyftsubset`) theo dải Latin + tiếng Việt, xuất woff2: Regular 26,3 KB + Bold 28,3 KB = 53,3 KB (ngân sách 60 KB).
- Đặt ở `src/assets/fonts/` (không phải `public/`) để Vite gắn hash vào tên file, tránh người chơi dính bản cache cũ.

## Hệ quả (đã kiểm tra 06/10)
- Đủ glyph cho toàn bộ chữ tiếng Việt trong chuỗi test.
- **Không có tính năng `tnum`** (số đều độ rộng) → số trong bảng điểm dùng font mono hệ thống.
- **Thiếu ✓ ✕ ↔** → các ký hiệu này vẽ bằng Canvas/SVG, không dùng ký tự.
- **Font mono hệ thống đặt dấu tiếng Việt sai** (thấy khi chạy thử 08/10: "trễ" hiện thành "trê˜") → font mono chỉ dùng cho chữ số và ký tự ASCII; mọi chữ có dấu dùng Be Vietnam Pro.
- Còn phải xem dấu hiển thị đúng trên máy thật bằng `font-test.html`.
