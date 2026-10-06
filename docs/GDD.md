# Game Design Document – CHIP RUSH

Luật và số liệu nằm ở [SPEC.md](SPEC.md); file này mô tả **trải nghiệm** muốn tạo ra.

## Ý tưởng một câu
Bạn là kỹ sư mới vào một công ty chip: thiết kế mạch, tìm lỗi mạch, và giữ cho chip chạy — rồi so tài với "AI kỹ sư".

## Câu chuyện khung
Màn hình chính là một **die chip** nhìn từ trên xuống, chia 3 khối ứng với 3 phòng ban = 3 công đoạn thật của ngành bán dẫn:
1. **THIẾT KẾ** (Design) – vẽ mạch.
2. **KIỂM THỬ** (Test/Debug) – chip làm ra bị lỗi, tìm lỗi.
3. **VẬN HÀNH** (Runtime) – chip chạy, xử lý dòng bit thật nhanh.

## Người chơi mục tiêu
- Chính: sinh viên được bạn bè gửi link để vote, mở trên điện thoại, chưa chắc biết cổng logic.
- Phụ: sinh viên kỹ thuật (Điện – Điện tử, Máy tính) muốn thử thách tối ưu.

## Trải nghiệm theo thời gian
| Thời điểm | Người chơi cần cảm thấy |
| --- | --- |
| 10 giây đầu | "À, hiểu rồi" — nút CHƠI NGAY vào thẳng VẬN HÀNH, không cần đọc hướng dẫn |
| 3 phút đầu | "Mình vừa học được AND/OR là gì" |
| Màn d11–d12 | "Mình vừa tự ráp mạch cộng như trong CPU" — khoảnh khắc muốn chia sẻ |
| Sau mỗi màn | Muốn thử lại để đạt 3 sao / vượt AI kỹ sư |

## Phong cách hình ảnh
- Nền tím than (#0b1020) như die silicon dưới kính hiển vi; dây phát sáng cyan (#38e8ff) khi mang bit 1, tối khi bit 0; điểm nhấn cam (#ffb020).
- Toàn bộ vẽ bằng code (Canvas 2D), không dùng ảnh ngoài.
- Bit luôn có **nhãn chữ "0"/"1"** ngoài màu sắc.
- Hiệu ứng: glow, hạt sáng khi LED bật, rung nhẹ khi sai. Tất cả tắt được (giảm chuyển động) và tự giảm trên máy yếu.

## Âm thanh
- Tổng hợp bằng Web Audio: "tách" khi đặt dây, "ting" khi LED sáng, âm trầm khi sai.
- Không có nhạc nền có bản quyền. Âm thanh không bao giờ là kênh thông tin duy nhất.

## Accessibility tối thiểu
- Không truyền thông tin chỉ bằng màu; tránh cặp đỏ-lục.
- Vùng chạm ≥ 44 × 44 CSS px; chữ ≥ 14 px; tương phản ≥ 4,5:1.
- Nút tắt tiếng luôn hiện; tôn trọng `prefers-reduced-motion`; không nhấp nháy quá 3 lần/giây.

## Nội dung tránh (theo điều lệ)
Không bạo lực, máu me, chính trị, tôn giáo, bản đồ, quốc kỳ, cơ chế giống cờ bạc (quay thưởng, loot box).
