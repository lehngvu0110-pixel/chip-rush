# Danh sách màn chơi

Cột par/`parOptimal` do `tools/solve-levels` điền; không sửa tay. Ghi chú chơi thử do người test điền.

**Tạm thời (08/10):** chưa có solver, par = PPA của lời giải tham chiếu viết tay trong `src/core/level/design-levels.ts` (in bằng `npx tsx tools/print-par.ts`). Vì là lời giải viết tay nên cột "Tối ưu?" = **Chưa**; người chơi có thể vượt par. Lưới ghi dạng cột × hàng × số lớp.

## THIẾT KẾ
| Màn | Tên | Khái niệm mới | Lưới | Cổng cho phép | Par (A/D/P/C) | Tối ưu? | MVP | Ghi chú chơi thử |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| d01 | Nối điện | Dây dẫn | 5×3×1 | — | 3/0/1/4 | Chưa | Có | |
| d02 | Đi vòng | Routing quanh vật cản | 5×5×1 | — | 7/0/1/8 | Chưa | Có | |
| d03 | Hai đường | Không cắt nhau | 5×5×1 | — | 7/0/3/10 | Chưa | Có | |
| d04 | Đảo | NOT | 5×3×1 | NOT | 3/1/2/8 | Chưa | Có | |
| d05 | Cả hai | AND | 5×5×1 | AND | 5/1/5/13 | Chưa | Có | |
| d06 | Một trong hai | OR | 5×5×1 | OR | 8/1/4/15 | Chưa | Có | |
| d07 | Khác nhau | XOR + bảng chân trị | 5×5×1 | AND, OR, XOR (1 mỗi loại) | 5/1/6/14 | Chưa | Có | |
| d08 | Tự ghép | NAND = AND + NOT | 6×5×1 | AND, NOT | 6/2/7/19 | Chưa | Có | |
| d09 | Cầu vượt | Via | 5×5×2 | — | 14/0/3/17 | Chưa | Nên có | |
| d10 | Chọn kênh | MUX 2:1 | | AND, OR, NOT | | | Nên có | |
| d11 | Cộng nửa | Half adder | 6×7×2 | XOR, AND | 23/1/8/34 | Chưa | Nên có | |
| d12 | Cộng đủ | Full adder | | XOR, AND, OR | | | Nên có | |

## KIỂM THỬ
| Màn | Mô hình lỗi | Số lớp lỗi | Par (lần đo) | Tối ưu? | MVP | Ghi chú chơi thử |
| --- | --- | --- | --- | --- | --- | --- |
| t01 | Cổng đảo đầu ra | | | | Có | |
| t02 | Cổng đảo đầu ra | | | | Có | |
| t03 | Cổng đảo đầu ra | | | | Có | |
| t04 | Stuck-at | | | | Nên có | |
| t05 | Stuck-at | | | | Nên có | |
| t06 | Stuck-at | | | | Nên có | |
