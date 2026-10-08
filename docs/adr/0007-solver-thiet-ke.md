# ADR-0007: "AI kỹ sư" = tìm kiếm có cận dưới + đi dây PathFinder, chạy offline

- **Ngày:** 2026-10-08
- **Trạng thái:** Đã chấp nhận

## Bối cảnh
Par của màn THIẾT KẾ phải do "AI kỹ sư" đặt (SPEC 5.1) và chỉ được gọi là "tối ưu" khi chứng minh được.
Bản 07/10 dùng lời giải viết tay; nhiều màn chưa tốt (d11: Area 23).

## Quyết định
1. Tách bài toán: mạch logic cố định → chỉ tối ưu bố trí (đặt cổng + đi dây). D, P không đổi theo bố trí nên tối ưu C ⇔ tối ưu Area.
2. Đặt cổng: duyệt hết khi ít tổ hợp, beam search khi nhiều. Branch-and-bound bằng cận dưới (BFS cho net 2 chân, HPWL cho net nhiều chân).
3. Đi dây: Dijkstra đa nguồn dựng cây Steiner xấp xỉ, thử nhiều thứ tự net; bố trí chật dùng PathFinder (thương lượng tắc nghẽn), thuật toán đi dây kinh điển của FPGA.
4. "Tối ưu" chỉ khi duyệt hết cách đặt **và** chạm cận dưới. Không thì ghi "tốt nhất tìm được".
5. Chạy offline (`tools/solve-levels.ts`), kết quả vào `solutions.json` đóng trong bundle (ADR-0005). Solver KHÔNG nằm trong bundle người chơi tải.

## Kết quả (08/10)
| Màn | Lời giải mẫu (C) | AI kỹ sư (C) | Chứng minh tối ưu? |
| --- | --- | --- | --- |
| d05 | 13 | 12 | Có |
| d06 | 15 | 13 | Có |
| d08 | 19 | 18 | Có |
| d09 | 17 | 16 | Chưa (cận dưới A ≥ 10, đạt 13) |
| d11 | 34 | 30 | Chưa (cận dưới A ≥ 13, đạt 19) |
| d10, d12 | — (không có lời giải mẫu) | 41, 68 | Chưa (beam search) |

d01–d04 trùng lời giải mẫu và đều chứng minh được tối ưu.

## Hệ quả
- Tối ưu là **với mạch logic của màn**; người chơi dùng mạch logic khác (nếu màn cho phép) có thể vượt AI — đó là điều thú vị, không phải lỗi.
- Cận dưới cho net nhiều chân còn lỏng (HPWL), nên màn lớn khó chứng minh. Hướng cải thiện: cận dưới Steiner chặt hơn, hoặc ILP cho màn nhỏ.
