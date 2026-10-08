# Danh sách màn chơi

Cột par/`parOptimal` do `tools/solve-levels` điền; không sửa tay. Ghi chú chơi thử do người test điền.

Par do **AI kỹ sư** (`src/ai/design-solver.ts`) tính offline: `npx tsx tools/solve-levels.ts` → `src/core/level/solutions.json` (ADR-0007). Cột "Tối ưu?": **Có** = đã chứng minh Area nhỏ nhất cho mạch logic của màn (duyệt hết cách đặt cổng và chạm cận dưới); **Chưa** = tốt nhất solver tìm được, người chơi có thể vượt. Lưới ghi dạng cột × hàng × số lớp.

## THIẾT KẾ
| Màn | Tên | Khái niệm mới | Lưới | Cổng cho phép | Par (A/D/P/C) | Tối ưu? | MVP | Ghi chú chơi thử |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| d01 | Nối điện | Dây dẫn | 5×3×1 | — | 3/0/1/4 | Có | Có | |
| d02 | Đi vòng | Routing quanh vật cản | 5×5×1 | — | 7/0/1/8 | Có | Có | |
| d03 | Hai đường | Không cắt nhau | 5×5×1 | — | 7/0/3/10 | Có | Có | |
| d04 | Đảo | NOT | 5×3×1 | NOT | 3/1/2/8 | Có | Có | |
| d05 | Cả hai | AND | 5×5×1 | AND | 4/1/5/12 | Có | Có | |
| d06 | Một trong hai | OR | 5×5×1 | OR | 6/1/4/13 | Có | Có | |
| d07 | Khác nhau | XOR + bảng chân trị | 5×5×1 | AND, OR, XOR (1 mỗi loại) | 5/1/6/14 | Chưa | Có | |
| d08 | Tự ghép | NAND = AND + NOT | 6×5×1 | AND, NOT | 5/2/7/18 | Có | Có | |
| d09 | Cầu vượt | Via | 5×5×2 | — | 13/0/3/16 | Chưa | Nên có | |
| d10 | Chọn kênh | MUX 2:1 | 6×7×2 | AND ×2, OR, NOT | 9/3/23/41 | Chưa | Nên có | |
| d11 | Cộng nửa | Half adder | 6×7×2 | XOR, AND | 19/1/8/30 | Chưa | Nên có | |
| d12 | Cộng đủ | Full adder | 7×7×2 | XOR ×2, AND ×2, OR | 32/3/27/68 | Chưa | Nên có | |

## KIỂM THỬ
Bố trí mạch do AI kỹ sư đặt; par = số lần đo ít nhất trong trường hợp xấu nhất (minimax, `src/ai/debug-solver.ts`), ghi trong `src/core/level/debug-solutions.json`.

| Màn | Tên | Mô hình lỗi | Số lớp lỗi nghi ngờ | Par (lần đo) | Tối ưu? | MVP | Ghi chú chơi thử |
| --- | --- | --- | --- | --- | --- | --- | --- |
| t01 | Chuỗi đảo | Cổng đảo đầu ra | 3 | 2 | Có | Có | |
| t02 | Đọc bệnh án | Cổng đảo đầu ra | 1 | 0 | Có | Có | |
| t03 | Chẵn lẻ | Cổng đảo đầu ra | 3 | 2 | Có | Có | |
| t04 | Dây kẹt | Kẹt (stuck-at) | 2 | 1 | Có | Nên có | |
| t05 | Bốn nghi phạm | Kẹt (stuck-at) | 4 | 3 | Có | Nên có | |
| t06 | Cộng đủ bị ốm | Kẹt (stuck-at) | 3 | 2 | Có | Nên có | |
