# Nội dung nộp bài (Portal BTC)

Điền đủ trước 25/10; dán nguyên vào form ngày 26/10. Ảnh nằm ở [`docs/submission/`](submission/), tạo lại bằng `node tools/submission-assets.mjs` (xem đầu file).

| Trường | Nội dung |
| --- | --- |
| Tên trò chơi | CHIP RUSH |
| Link GitHub | https://github.com/lehngvu0110-pixel/chip-rush |
| Link chơi thử | https://lehngvu0110-pixel.github.io/chip-rush/ |
| Mô tả ngắn | Thiết kế, kiểm thử và vận hành một con chip ngay trên điện thoại — và thử thắng "AI kỹ sư". |
| Mô tả dài | Xem mục bên dưới (≈ 300 chữ; nếu form giới hạn ký tự thì dùng bản rút gọn) |
| Ảnh logo | `submission/logo-1024.png` (nền tối), `logo-512.png`, `logo-trong-suot-1024.png` (nền trong suốt) |
| Ảnh in-game | `1-man-chinh.png`, `2-thiet-ke.png`, `3-kiem-thu.png`, `4-van-hanh.png` (ảnh chụp thật trên khung Pixel 7, 1082×2202); ảnh bìa `anh-bia-1920x1080.png` |
| Tác giả | Lê Hoàng Vũ – MSSV _(điền)_ – Trường ĐH Bách Khoa, ĐHQG-HCM |
| Xác nhận đáp ứng điều lệ | Đối chiếu `COMPLIANCE.md` trước khi tick |

> Chưa biết Portal nhận ảnh cỡ/định dạng nào (câu hỏi số 4 gửi BTC). Khi có trả lời thì cắt/nén lại từ ảnh gốc ở trên.

## Mô tả dài

**CHIP RUSH** đưa bạn đi trọn vòng đời của một con chip qua ba chế độ chơi ngắn, chơi ngay trên trình duyệt điện thoại, không cần cài đặt.

- **THIẾT KẾ** (12 màn): kéo ngón tay vẽ dây trên lưới 2 lớp, đặt cổng logic và via để đèn sáng đúng theo bảng chân trị — từ nối một sợi dây tới bộ cộng đủ. Mạch được chấm theo **PPA** (diện tích, độ trễ, công suất) như kỹ sư thiết kế vi mạch thật.
- **KIỂM THỬ** (9 màn): con chip có đúng một lỗi ẩn. Đo từng sợi dây, suy luận và chỉ ra cổng hỏng hoặc dây bị kẹt 0/1 với càng ít lần đo càng tốt.
- **VẬN HÀNH**: chế độ arcade — chọn cổng AND/OR/XOR/NAND trước khi gói bit rơi xuống ổ cắm; có Vô tận và Thử thách 60 giây cùng đề mỗi ngày để so điểm với bạn bè.

Ở mỗi chế độ bạn so tài với **"AI kỹ sư"** — AI cổ điển chạy ngay trong game, không gọi API: tìm kiếm nhánh-cận (branch-and-bound) kèm cận dưới và đi dây PathFinder để tìm mạch rẻ nhất (chứng minh được tối ưu ở 7/12 màn); cây quyết định minimax để biết số lần đo ít nhất trong trường hợp xấu nhất (tối ưu ở cả 9 màn); Thompson sampling để chế độ VẬN HÀNH ra nhiều gói ở loại cổng bạn hay sai. Bạn ngang AI thì được 1000 điểm, vượt AI ở màn chưa được chứng minh tối ưu là có thật. AI được giải thích ngay trong game: trang "AI kỹ sư hoạt động thế nào?" nói rõ thuật toán và giới hạn, nút "Xem AI kỹ sư đo" phát lại từng bước suy luận, và chế độ VẬN HÀNH báo khi AI bắt đầu nhắm vào điểm yếu của bạn.

Mỗi ngày còn có **Chip hôm nay**: một đề thiết kế mới giống nhau cho mọi người, giữ chuỗi ngày và so điểm với bạn bè.

Màn đầu của THIẾT KẾ và KIỂM THỬ có hướng dẫn tận tay (không trừ sao); nút Gợi ý luôn sẵn khi bí. Toàn bộ hình ảnh vẽ bằng code, âm thanh tổng hợp trong trình duyệt, không thu thập dữ liệu cá nhân. Quá trình dùng AI để phát triển được ghi lại công khai trong repo (`docs/ai-log/`).

### Bản rút gọn (≈ 500 ký tự)
CHIP RUSH: vòng đời một con chip trong 3 chế độ chơi trên điện thoại. THIẾT KẾ – vẽ dây, đặt cổng logic, tối ưu diện tích/độ trễ/công suất. KIỂM THỬ – đo dây, suy luận tìm lỗi ẩn. VẬN HÀNH – arcade phản xạ cổng logic. Mỗi chế độ có "AI kỹ sư" (branch-and-bound, minimax, Thompson sampling) chạy ngay trong game để bạn so tài. Hình vẽ bằng code, không thu thập dữ liệu.
