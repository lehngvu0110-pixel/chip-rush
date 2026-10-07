# ADR-0006: Đồ hoạ "bo mạch neon" vẽ bằng code, ánh sáng bằng sprite thay cho shadowBlur

- **Ngày:** 2026-10-07
- **Trạng thái:** Đã chấp nhận (Vũ chọn phong cách "Bo mạch neon" trong 3 phương án)

## Bối cảnh
Bản 09/10 dễ đọc nhưng quá đơn giản ("nhìn không có hứng thú"). Cần đẹp hơn mà vẫn:
giữ 60 fps trên Redmi Note 8, không thêm file ảnh (ngân sách tải 200 KB, ảnh 5 KB), không dùng ảnh AI (rủi ro bản quyền theo điều lệ).

## Quyết định
1. **Phong cách bo mạch neon** (Vũ chọn, so với "die shot silicon" và "arcade pixel"): nền PCB xanh đen, đường mạch 45°, via, chip trang trí; xung điện chạy dọc đường mạch; con chip (gói bit) có chân cắm xuống **ổ cắm cổng**; nút có **ký hiệu cổng chuẩn ANSI/IEEE**.
2. **Nền tĩnh vẽ 1 lần** vào canvas phụ (chỉ vẽ lại khi đổi cỡ màn hình); mỗi frame chỉ `drawImage`.
3. **Ánh sáng = sprite**: đốm sáng radial gradient vẽ sẵn, mỗi frame `drawImage` với `globalCompositeOperation = 'lighter'`. Không dùng `shadowBlur` cho vật chuyển động (rất tốn GPU trên máy Android yếu).
4. **Giới hạn cứng**: tối đa 70 hạt, 10 xung nền (màn chơi) / 16 (màn bắt đầu); "giảm chuyển động" tắt xung, hạt, rung.
5. **Hai lớp canvas**: nền tĩnh ở canvas riêng nằm dưới (chỉ vẽ lại khi đổi cỡ), canvas chính trong suốt. Nút và thân chip được vẽ sẵn (cache) theo trạng thái → mỗi frame chỉ `drawImage`.
6. **Tự hạ chất lượng**: khi p95 > 33,4 ms, chuyển `low`: tắt glow, xung, và **ẩn lớp nền bo mạch** (về nền một màu như bản cũ).
7. Bố cục bo mạch **sinh bằng thuật toán từ seed** (`pcb-layout.ts`, thuần, có test): cùng seed → cùng hình, tránh vùng chữ/làn chơi.

## Hệ quả
- JS tăng ~18 KB (29,6 → ~47 KB chưa nén, ~18 KB gzip), vẫn dưới ngân sách 120 KB.
- `gate-symbol.ts` dùng lại cho THIẾT KẾ và KIỂM THỬ.
- Cần đo lại hiệu năng trên 3 máy thật **trong màn chơi** (không chỉ màn đo hiệu năng).

## Số đo trên máy ảo (chỉ để so sánh, KHÔNG thay máy thật)
Chromium headless giả lập Pixel 7, **vẽ bằng CPU** (không GPU), làm chậm CPU 6 lần:

| Bản | Frame trung vị / p95 |
| --- | --- |
| 09/10 (đồ hoạ cũ) | 16,7 / 33,4 ms |
| 07/10 bản đầu (1 canvas, chép nền mỗi frame) | 33,3 / 66,7 ms |
| 07/10 sau tối ưu (2 lớp + cache nút/chip) | 33,3 / 50,0 ms |
| 07/10, ẩn lớp nền | 16,7 / 33,4 ms |

Thí nghiệm ẩn từng lớp cho thấy phần đắt là **ghép 2 lớp toàn màn hình bằng CPU**, không phải lệnh vẽ của game.
Điện thoại thật ghép lớp bằng GPU nên chi phí này thường rất nhỏ, nhưng chưa được kiểm chứng: Vũ đo trên Redmi Note 8 với `?debug=1`.
Nếu máy không theo kịp, cơ chế tự hạ chất lượng (mục 6) đưa game về mức tải gần như bản cũ.
