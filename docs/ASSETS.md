# Nguồn gốc tài nguyên

Mọi file không phải mã nguồn tự viết đều phải có một dòng ở đây trước khi commit.

| File | Loại | Nguồn | Tác giả | Giấy phép | Ghi chú / prompt AI |
| --- | --- | --- | --- | --- | --- |
| `src/assets/fonts/BeVietnamPro-Regular.subset.woff2` | Font | [google/fonts – ofl/bevietnampro](https://github.com/google/fonts/tree/main/ofl/bevietnampro) | Be Vietnam Pro Project Authors | SIL OFL 1.1 (`src/assets/fonts/OFL.txt`) | Đã subset bằng `tools/subset-font.sh` |
| `src/assets/fonts/BeVietnamPro-Bold.subset.woff2` | Font | như trên | như trên | SIL OFL 1.1 | như trên |
| `public/favicon.svg` | Icon | Tự vẽ bằng SVG trong repo | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Hình con chip đơn giản |
| `src/ui/icons.ts` (logo, nút dừng/âm thanh, ngôi sao) | SVG nội tuyến | Viết tay bằng mã SVG trong repo | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Logo = vỏ chip + tia chớp; không dùng công cụ tạo ảnh AI |
| `docs/submission/demo.mp4`, `docs/demo.gif` | Video/ảnh động demo | Quay từ chính game bằng `tools/demo-video.mjs` (Playwright + ffmpeg); chữ chú thích chèn bằng HTML lúc quay | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Không dùng AI tạo hình/âm thanh; video không có tiếng |
| `docs/screenshots/*.png` | Ảnh trong game cho README | Chụp từ chính game bằng Playwright, thu nhỏ còn 360 px | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Không dùng công cụ tạo ảnh AI |
| `docs/submission/*.png` (logo PNG, ảnh in-game, ảnh bìa) | Ảnh nộp bài | Chụp/kết xuất từ chính game bằng `tools/submission-assets.mjs` (Playwright) | Nhóm CHIP RUSH (với trợ lý AI) | MIT | Logo PNG = `LOGO_SVG` kết xuất; ảnh bìa ghép từ ảnh chụp game thật; không dùng công cụ tạo ảnh AI |

Âm thanh: tổng hợp bằng Web Audio trong code, không dùng file âm thanh.
Mô hình 3D linh kiện (`src/render/part-models.ts`): dựng bằng code từ khối cơ bản theo kích thước vỏ chuẩn trong datasheet (TO-92, TO-220, DIP-8, HC-49/US...), không dùng ảnh chụp hay file 3D ngoài; ký hiệu sơ đồ (`src/ui/part-symbols.ts`) vẽ tay bằng SVG theo kiểu IEC. Mã linh kiện in trên vỏ (NE555, IRF540N...) là tên mã kỹ thuật phổ thông để người chơi nhận biết, không phải logo hãng.
Hình ảnh trong game: vẽ bằng Canvas trong code, không dùng file ảnh (kể cả die chip ở màn hình chính, `src/modes/hub/hub-scene.ts`; dòng chữ "CR-2027 · 7nm" trên die là trang trí, không phải sản phẩm thật). Nền bo mạch (`src/render/pcb-layout.ts`) sinh bằng thuật toán từ seed; ký hiệu cổng logic vẽ theo hình dạng chuẩn ANSI/IEEE Std 91 (ký hiệu kỹ thuật phổ thông, không có bản quyền hình ảnh).
