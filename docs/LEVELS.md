# Danh sách màn chơi

Cột par/`parOptimal` do `tools/solve-levels` điền; không sửa tay. Ghi chú chơi thử do người test điền.

## THIẾT KẾ
| Màn | Tên | Khái niệm mới | Lưới | Cổng cho phép | Par (A/D/P/C) | Tối ưu? | MVP | Ghi chú chơi thử |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| d01 | Nối điện | Dây dẫn | | — | | | Có | |
| d02 | Đi vòng | Routing quanh vật cản | | — | | | Có | |
| d03 | Hai đường | Không cắt nhau | | — | | | Có | |
| d04 | Đảo | NOT | | NOT | | | Có | |
| d05 | Cả hai | AND | | AND | | | Có | |
| d06 | Một trong hai | OR | | OR | | | Có | |
| d07 | Khác nhau | XOR + bảng chân trị | | XOR | | | Có | |
| d08 | Tự ghép | NAND = AND + NOT | | AND, NOT | | | Có | |
| d09 | Cầu vượt | Via | | — | | | Nên có | |
| d10 | Chọn kênh | MUX 2:1 | | AND, OR, NOT | | | Nên có | |
| d11 | Cộng nửa | Half adder | | XOR, AND | | | Nên có | |
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
