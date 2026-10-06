# ADR-0005: Par của AI tính offline và đóng gói vào bản build

- **Ngày:** 2026-10-06
- **Trạng thái:** Chấp nhận

## Bối cảnh
Solver THIẾT KẾ có thể cần tới 60 s/màn, solver KIỂM THỬ dùng minimax có ghi nhớ — quá chậm để chạy lúc người chơi chờ, nhất là trên máy yếu.

## Quyết định
`tools/solve-levels` chạy solver trong Node, ghi `par`, `parOptimal`, `parSource` vào JSON màn chơi; JSON được `import` vào bundle. Trong game chỉ đọc par (và chạy mô phỏng để chấm điểm người chơi).

## Hệ quả
- Không có thời gian chờ trong game; par có thể kiểm chứng trước bằng CI (`audit-solver`, `check-levels`).
- Daily Chip phải sinh trước (28 đề) thay vì sinh ngẫu nhiên lúc chơi.
