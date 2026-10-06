# CHIP RUSH

Game web về vi mạch, chơi trên điện thoại: **Thiết kế** một con chip bằng cách vẽ dây và đặt cổng logic, **Kiểm thử** để tìm cổng hỏng, và **Vận hành** trong chế độ arcade phản xạ. Mỗi chế độ có một "AI kỹ sư" để bạn so tài.

Dự thi **Phần thi Công nghệ – Road to Predator League 2027**.

> Trạng thái: đang phát triển (v0.1.0). Bản nộp dự kiến 26/10/2026.

## Chơi thử
- Bản mới nhất: _(link GitHub Pages sẽ cập nhật sau khi bật Pages)_

## Ba chế độ
| Chế độ | Kiểu chơi | Khái niệm vi mạch |
| --- | --- | --- |
| VẬN HÀNH | Arcade: chọn cổng AND/OR/XOR/NAND trước khi gói bit chạm đáy | Cổng logic |
| THIẾT KẾ | Giải đố: vẽ dây, đặt cổng, làm LED sáng đúng mọi trường hợp | Routing, bảng chân trị, via, bộ cộng, PPA |
| KIỂM THỬ | Suy luận: đo các điểm trên mạch để tìm cổng hỏng | Probing, stuck-at fault |

Luật chi tiết: [`docs/SPEC.md`](docs/SPEC.md).

## AI trong game và trong quá trình làm game
- **Trong game** (AI cổ điển, chạy ngay trên trình duyệt hoặc tính trước offline, không gọi API):
  - Solver THIẾT KẾ: A* + branch-and-bound tìm lời giải chi phí thấp nhất làm "par".
  - Solver KIỂM THỬ: minimax / information gain tìm số lần đo ít nhất.
  - Độ khó thích nghi: Thompson sampling theo cổng người chơi hay sai.
  - Giới hạn của từng thuật toán và cách kiểm chứng: [`docs/SPEC.md` mục 5](docs/SPEC.md).
- **Trong quá trình phát triển:** dùng trợ lý AI để lên kế hoạch, viết code, viết tài liệu. Toàn bộ được ghi lại ở [`docs/ai-log/`](docs/ai-log/).

## Chạy trên máy
Cần Node.js ≥ 20.
```bash
npm install
npm run dev        # mở http://localhost:5173 ; điện thoại cùng Wi-Fi mở http://<IP-máy>:5173
npm test           # unit test
npm run build      # build ra thư mục dist/
npm run ci         # typecheck + test + build + kiểm tra dung lượng
```

## Tài liệu
| File | Nội dung |
| --- | --- |
| [docs/SPEC.md](docs/SPEC.md) | Luật chơi, công thức điểm, AI |
| [docs/GDD.md](docs/GDD.md) | Thiết kế trải nghiệm, hình ảnh, âm thanh |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Kiến trúc code |
| [docs/adr/](docs/adr/) | Các quyết định kỹ thuật lớn |
| [docs/LEVELS.md](docs/LEVELS.md) | Danh sách màn chơi |
| [docs/TESTING.md](docs/TESTING.md) | Thiết bị, ma trận test, số đo hiệu năng |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | Đối chiếu điều lệ cuộc thi |
| [docs/ASSETS.md](docs/ASSETS.md) | Nguồn gốc và giấy phép mọi tài nguyên |
| [docs/DEVLOG.md](docs/DEVLOG.md) | Nhật ký phát triển |
| [CHANGELOG.md](CHANGELOG.md) | Thay đổi theo phiên bản |

## Quyền riêng tư
Game không thu thập dữ liệu cá nhân, không dùng cookie, không gọi máy chủ nào sau lần tải đầu. Tiến độ chỉ lưu trong trình duyệt của bạn (`localStorage`).

## Tác giả
| Họ tên | MSSV | Trường |
| --- | --- | --- |
| Lê Hoàng Vũ | _(điền)_ | Trường ĐH Bách Khoa – ĐHQG-HCM |

## Giấy phép
Mã nguồn: [MIT](LICENSE). Font Be Vietnam Pro: [SIL Open Font License 1.1](src/assets/fonts/OFL.txt).
