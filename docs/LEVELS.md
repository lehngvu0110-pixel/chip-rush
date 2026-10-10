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
| t07 | Ngã ba | Cổng đảo đầu ra | 3 | 2 | Có | Thêm 16/10 | Dây A rẽ nhánh nuôi AND và OR |
| t08 | Hai đèn chỉ đường | Kẹt (stuck-at) | 3 | 2 | Có | Thêm 16/10 | Cộng nửa 6 cổng; đèn C đúng → lỗi ở nhánh S |
| t09 | Bỏ phiếu | Kẹt (stuck-at) | 5 | 3 | Có | Thêm 16/10 | Mạch đa số; 5 khả năng là màn khó nhất |

Lỗi của t07–t09 được chọn bằng `tools/explore-faults.ts`: thử mọi lỗi của mô hình trên bố trí đã lưu, bỏ lỗi par 0 (nhìn đèn là đủ biết) và chọn lỗi có nhiều khả năng nhất. Đã thử và bỏ: mạch đa số với lỗi cổng đảo (mọi lỗi đều par 0), bộ cộng đủ 7 cổng (AI không bố trí được trên lưới 8×8), bộ chọn kép MUX + XOR (giống hệt t04).

## Daily Chip (CHIP HÔM NAY)
Sinh + giải trước bằng `npx tsx tools/gen-daily.ts` (seed cố định) → `src/core/level/daily.json`. Ngày 26/10/2026 là đề 1, quay vòng 28 ngày (trước 26/10 cũng quay vòng theo công thức đó).

| Đề | Ngày (vòng đầu) | Lưới | Cổng được dùng | Bảng chân trị | Par A/D/P/C | Tối ưu? |
| --- | --- | --- | --- | --- | --- | --- |
| daily-01 | 26/10 | 6×6×1, 2 vật cản | AND | Y=0001 | 6/1/5/14 | Có |
| daily-02 | 27/10 | 6×6×1, 1 vật cản | OR + XOR | Y=0100 | 7/2/6/19 | Chưa |
| daily-03 | 28/10 | 5×7×1, 1 vật cản | AND + NAND | Y=11111110 | 7/2/11/24 | Chưa |
| daily-04 | 29/10 | 7×5×2, 3 vật cản | XOR + NAND | Y=0110, X=1110 | 18/1/8/29 | Chưa |
| daily-05 | 30/10 | 6×5×1, 2 vật cản | NAND | Y=1110 | 7/1/5/15 | Chưa |
| daily-06 | 31/10 | 7×6×1, 3 vật cản | XOR + NAND | Y=1011 | 8/2/8/22 | Chưa |
| daily-07 | 01/11 | 5×7×1, 3 vật cản | OR + AND | Y=00010101 | 7/2/12/25 | Chưa |
| daily-08 | 02/11 | 6×5×2 | OR + XOR | Y=0111, X=0100 | 15/2/6/27 | Chưa |
| daily-09 | 03/11 | 6×6×1 | OR | Y=0111 | 6/1/4/13 | Có |
| daily-10 | 04/11 | 6×6×1 | NOR + OR | Y=1101 | 7/2/5/18 | Chưa |
| daily-11 | 05/11 | 6×7×2, 1 vật cản | XOR + OR | Y=01111011 | 12/2/15/33 | Chưa |
| daily-12 | 06/11 | 6×6×2, 3 vật cản | AND + XOR | Y=0001, X=0010 | 19/2/6/31 | Chưa |
| daily-13 | 07/11 | 6×6×1, 3 vật cản | XOR | Y=0110 | 6/1/6/15 | Có |
| daily-14 | 08/11 | 6×5×1 | NAND + AND | Y=0010 | 6/2/6/18 | Chưa |
| daily-15 | 09/11 | 6×7×1 | 2 AND | Y=00000001 | 8/2/11/25 | Chưa |
| daily-16 | 10/11 | 5×6×2, 1 vật cản | XOR + AND | Y=0110, X=0010 | 14/2/7/27 | Chưa |
| daily-17 | 11/11 | 5×6×1 | NOR | Y=1000 | 5/1/4/12 | Có |
| daily-18 | 12/11 | 5×5×1, 2 vật cản | XOR + NOT | Y=1001 | 6/2/9/21 | Chưa |
| daily-19 | 13/11 | 5×7×2 | 2 XOR | Y=01101001 | 11/2/19/36 | Chưa |
| daily-20 | 14/11 | 7×5×2, 1 vật cản | OR + NOR | Y=0111, X=1000 | 18/1/5/26 | Chưa |
| daily-21 | 15/11 | 5×7×2 | NAND + 2 AND | Y=00000100 | 14/2/13/33 | Chưa |
| daily-22 | 16/11 | 5×7×1 | NOR + AND + NOT | Y=11110111 | 7/3/11/27 | Chưa |
| daily-23 | 17/11 | 7×7×2, 1 vật cản | AND + OR | Y=00110111 | 13/2/11/30 | Chưa |
| daily-24 | 18/11 | 5×6×1, 2 vật cản | XOR + NOT | Y=0110, X=1001 | 7/2/9/22 | Chưa |
| daily-25 | 19/11 | 7×7×1, 2 vật cản | 3 NOR | Y=10000000 | 10/3/12/31 | Chưa |
| daily-26 | 20/11 | 6×7×1, 2 vật cản | NOT + XOR + NAND | Y=11110110 | 9/3/20/38 | Chưa |
| daily-27 | 21/11 | 6×7×2, 1 vật cản | OR + AND | Y=00010011 | 12/2/14/32 | Chưa |
| daily-28 | 22/11 | 6×6×2 | AND + OR | Y=0001, X=0111 | 17/1/6/26 | Chưa |
