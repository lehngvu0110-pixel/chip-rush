# Nội dung nộp bài (Portal BTC)

**Hạn nộp: 15/11/2026.** Hoàn thiện mọi mục trước 14/11 rồi dán nguyên vào form. Ảnh nằm ở [`docs/submission/`](submission/), tạo lại bằng `node tools/submission-assets.mjs`; video bằng `node tools/demo-video.mjs` (xem đầu mỗi file). Bản này cập nhật ngày 26/10: đủ 4 chế độ (thêm LẮP RÁP) và Góc học tập.

| Trường | Nội dung |
| --- | --- |
| Tên trò chơi | CHIP RUSH |
| Link GitHub | https://github.com/lehngvu0110-pixel/chip-rush |
| Link chơi thử | https://lehngvu0110-pixel.github.io/chip-rush/ |
| Mô tả ngắn | Thiết kế, kiểm thử, lắp ráp và vận hành một con chip ngay trên điện thoại, thử thắng "AI kỹ sư" và học điện tử qua sơ đồ tư duy, trắc nghiệm. |
| Mô tả dài | Xem mục bên dưới (khoảng 380 chữ; form giới hạn ký tự thì dùng bản rút gọn) |
| Hướng dẫn chơi | Xem mục "Hướng dẫn chơi" bên dưới |
| Ảnh logo | `submission/logo-1024.png` (nền tối), `logo-512.png`, `logo-trong-suot-1024.png` (nền trong suốt) |
| Video demo | `submission/demo.mp4` (khoảng 1 phút, dọc 720×1600, 4,1 MB): đủ 4 công đoạn và Góc học tập, quay từ chính game bằng `tools/demo-video.mjs`; nếu Portal có ô video thì tải lên |
| Ảnh trong game | `1-man-chinh.png`, `2-thiet-ke.png`, `3-kiem-thu.png`, `4-van-hanh.png`, `5-lap-rap.png`, `6-goc-hoc-tap.png` (ảnh chụp thật trên khung Pixel 7, 1082×2202); ảnh bìa `anh-bia-1920x1080.png` |
| Tác giả | Lê Hoàng Vũ, MSSV 2611042, Trường ĐH Bách Khoa, ĐHQG-HCM |
| Xác nhận đáp ứng điều lệ | Đối chiếu `COMPLIANCE.md` trước khi tick |

> Chưa biết Portal nhận ảnh cỡ/định dạng nào (câu hỏi số 4 gửi BTC). Khi có trả lời thì cắt/nén lại từ ảnh gốc ở trên.

## Mô tả dài

**CHIP RUSH** đưa bạn đi trọn vòng đời của một con chip qua bốn công đoạn, chơi ngay trên trình duyệt điện thoại, không cần cài đặt.

- **THIẾT KẾ** (12 màn): kéo ngón tay vẽ dây trên lưới 2 lớp, đặt cổng logic và via để đèn sáng đúng bảng chân trị, từ nối một sợi dây tới bộ cộng đủ. Mạch được chấm theo **PPA** (diện tích, độ trễ, công suất) như kỹ sư thiết kế vi mạch thật.
- **KIỂM THỬ** (9 màn): con chip có đúng một lỗi ẩn. Đo từng sợi dây, suy luận và chỉ ra cổng hỏng hoặc dây bị kẹt 0/1 với càng ít lần đo càng tốt.
- **LẮP RÁP** (11 màn): cắm điện trở, LED, tụ, transistor, MOSFET, IC 555 từ khay lên bo mạch, xoay đúng chiều rồi cấp nguồn. Mạch chạy bằng bộ mô phỏng điện thật viết riêng cho game: LED cắm ngược thì không sáng, thiếu điện trở thì LED cháy, IC 555 làm đèn nháy đúng tần số tính bằng công thức.
- **VẬN HÀNH**: arcade phản xạ, chọn cổng AND/OR/XOR/NAND trước khi gói bit rơi xuống ổ cắm; có Vô tận và Thử thách 60 giây cùng đề mỗi ngày để so điểm (bấm bừa bị "chập mạch" khoá nút và trừ điểm nên không có lợi).

Ở ba công đoạn bạn so tài với **"AI kỹ sư"**, AI cổ điển chạy ngay trong game, không gọi API: tìm kiếm nhánh-cận (branch-and-bound) kèm cận dưới và đi dây PathFinder để tìm mạch rẻ nhất (chứng minh tối ưu ở 7/12 màn); cây quyết định minimax để biết số lần đo ít nhất (tối ưu ở cả 9 màn); Thompson sampling để VẬN HÀNH ra thêm câu về cổng bạn hay sai. AI được giải thích ngay trong game: trang "AI kỹ sư hoạt động thế nào?", nút "Xem AI kỹ sư đo" phát lại từng bước suy luận.

**Góc học tập** giúp người mới: sơ đồ tư duy điện - điện tử (6 nhánh, 29 ý, mỗi ý dẫn tới màn chơi hoặc linh kiện liên quan), trắc nghiệm 10 câu có lời giải (câu tính toán đổi số mỗi lượt) và thư viện 11 linh kiện 3D xoay 360°.

Mỗi ngày còn có **Chip hôm nay**: một đề thiết kế mới giống nhau cho mọi người, giữ chuỗi ngày; cùng 12 huy hiệu như "Hơn cả AI". Toàn bộ hình ảnh vẽ bằng code, âm thanh tổng hợp trong trình duyệt, không thu thập dữ liệu cá nhân. Quá trình dùng AI để phát triển được ghi lại công khai trong repo (`docs/ai-log/`).

### Bản rút gọn (khoảng 500 ký tự)
CHIP RUSH: vòng đời một con chip trong 4 công đoạn trên điện thoại. THIẾT KẾ: vẽ dây, đặt cổng logic, tối ưu PPA. KIỂM THỬ: đo dây, tìm lỗi ẩn. LẮP RÁP: cắm linh kiện lên bo, cấp nguồn cho mạch chạy (mô phỏng điện thật). VẬN HÀNH: arcade phản xạ cổng logic. So tài "AI kỹ sư" (branch-and-bound, minimax, Thompson sampling) chạy ngay trong game. Góc học tập: sơ đồ tư duy, trắc nghiệm, linh kiện 3D. Không thu thập dữ liệu.

## Hướng dẫn chơi
1. Mở link chơi thử trên điện thoại, cầm dọc (máy tính dùng chuột hoặc bàn phím cũng được).
2. Màn chính là một con chip chia 4 khối. Chạm một khối để chọn công đoạn; nút **CHƠI NGAY** vào thẳng VẬN HÀNH.
3. **THIẾT KẾ:** kéo ngón tay từ ô này sang ô bên cạnh để nối dây; chọn công cụ Cổng rồi chạm ô trống để đặt cổng; bấm **KIỂM TRA**. Chi phí càng thấp càng nhiều sao. Bí thì bấm **Gợi ý**.
4. **KIỂM THỬ:** chạm công tắc đầu vào để đổi 0/1, chạm sợi dây để đo; đoán ra lỗi thì bấm **Báo lỗi** và chọn cổng hoặc dây hỏng. Càng ít lần đo càng nhiều sao.
5. **LẮP RÁP:** chạm một linh kiện trong khay, rồi chạm chỗ cắm sáng viền cam trên bo. Kiểm tra chiều (dấu +, vạch, mặt phẳng, vết khuyết); sai chiều thì chọn linh kiện và bấm **Xoay 180°**. Bấm **CẤP NGUỒN**; khi có điện, ấn giữ nút nhấn ngay trên bo để thử. Đúng ngay lần cấp nguồn đầu được 3 sao.
6. **VẬN HÀNH:** đọc A, B và bit "CẦN RA", chạm cổng cho ra đúng bit trước khi gói chạm ổ cắm (máy tính: phím 1-4). Vô tận có 3 mạng; Thử thách 60 giây bấm sai bị khoá 0,8 giây.
7. **Góc học tập** (nút ở cuối màn chính): sơ đồ tư duy, trắc nghiệm 10 câu, thư viện linh kiện 3D.
8. Màn đầu của THIẾT KẾ và KIỂM THỬ có hướng dẫn tận tay (không trừ sao); màn đầu LẮP RÁP có hướng dẫn từng bước bằng chữ; nút Gợi ý không trừ sao ở LẮP RÁP. Phím Esc quay lại ở các bảng.

## Checklist trước khi nộp (làm xong trước 14/11)
| # | Việc | Ai | Xong? |
| --- | --- | --- | --- |
| 1 | Điền MSSV vào bảng trên và `README.md` | Vũ | ☑ (20/10) |
| 2 | Duyệt các mục "chờ duyệt" trong `SPEC.md` (lưới, KIỂM THỬ, mở khoá, Chip hôm nay, huy hiệu) và luật 3 sao KIỂM THỬ | Vũ | ☐ |
| 3 | Đo hiệu năng trên 3 điện thoại thật bằng `?debug=1`, ghi vào `TESTING.md` | Vũ | ☐ |
| 4 | Mở `font-test.html` trên 3 máy, kiểm tra dấu tiếng Việt | Vũ | ☐ |
| 5 | Chơi hết 1 lượt mỗi chế độ trên iPhone (Safari) và Android (Chrome) qua link GitHub Pages | Vũ | ☐ |
| 6 | `git push` → CI xanh cả Chromium và WebKit; GitHub Pages đã cập nhật bản mới | Vũ | ☐ |
| 7 | Repo GitHub để **public** (BTC xem mã nguồn); hỏi lại BTC câu 7 trong `COMPLIANCE.md` | Vũ | ☐ |
| 8 | Đối chiếu lại toàn bộ `COMPLIANCE.md` (đặc biệt IV.1–IV.3: bản quyền, AI phái sinh, nội dung) | Vũ + Claude | ☐ |
| 9 | Đổi phiên bản `0.1.0` → `1.0.0` trong `package.json`, chuyển mục "Chưa phát hành" của CHANGELOG thành `[1.0.0]` kèm ngày nộp, tạo tag `v1.0.0` | Claude (khi Vũ bảo) | ☐ |
| 10 | Chụp lại ảnh nộp bài và quay lại video nếu giao diện đổi sau 26/10 (`node tools/submission-assets.mjs`, `node tools/demo-video.mjs`) | Claude | ☑ (26/10: thêm LẮP RÁP, Góc học tập) |
| 11 | Nhật ký AI (`docs/ai-log/`) đủ mọi ngày, có phần "Kiểm tra" của người | Vũ + Claude | ☐ |
| 12 | Trước hạn 15/11: dán nội dung bảng trên vào Portal, tải logo + ảnh trong game + video | Vũ | ☐ |
