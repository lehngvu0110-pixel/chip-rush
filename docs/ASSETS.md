# Nguồn gốc tài nguyên

Mọi file không phải mã nguồn tự viết đều phải có một dòng ở đây trước khi commit.

| File | Loại | Nguồn | Tác giả | Giấy phép | Ghi chú / prompt AI |
| --- | --- | --- | --- | --- | --- |
| `src/assets/fonts/BeVietnamPro-Regular.subset.woff2` | Font | [google/fonts – ofl/bevietnampro](https://github.com/google/fonts/tree/main/ofl/bevietnampro) | Be Vietnam Pro Project Authors | SIL OFL 1.1 (`src/assets/fonts/OFL.txt`) | Đã subset bằng `tools/subset-font.sh` |
| `src/assets/fonts/BeVietnamPro-Bold.subset.woff2` | Font | như trên | như trên | SIL OFL 1.1 | như trên |
| `public/favicon.svg` | Icon | Tự vẽ bằng SVG trong repo | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Hình con chip đơn giản |
| `src/ui/icons.ts` (logo, nút dừng/âm thanh, ngôi sao) | SVG nội tuyến | Viết tay bằng mã SVG trong repo | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Logo = vỏ chip + tia chớp; không dùng công cụ tạo ảnh AI |

Âm thanh: tổng hợp bằng Web Audio trong code, không dùng file âm thanh.
Hình ảnh trong game: vẽ bằng Canvas trong code, không dùng file ảnh (kể cả die chip ở màn hình chính, `src/modes/hub/hub-scene.ts`; dòng chữ "CR-2027 · 7nm" trên die là trang trí, không phải sản phẩm thật). Nền bo mạch (`src/render/pcb-layout.ts`) sinh bằng thuật toán từ seed; ký hiệu cổng logic vẽ theo hình dạng chuẩn ANSI/IEEE Std 91 (ký hiệu kỹ thuật phổ thông, không có bản quyền hình ảnh).
