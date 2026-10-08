# ADR-0008: KIỂM THỬ — quan sát miễn phí ở đèn, lớp lỗi theo dây đo được, par bằng minimax

- **Ngày:** 2026-10-08
- **Trạng thái:** Đã chấp nhận (các làm rõ trong SPEC mục 3 chờ Vũ duyệt)

## Bối cảnh
SPEC mục 3 nói "đọc 1 net = 1 lần đo" nhưng chưa nói đèn có xem miễn phí không, và "lớp tương đương" so trên cái gì.
Hai lựa chọn này quyết định độ khó và tính đúng của par.

## Quyết định
1. **Đèn và công tắc miễn phí** — giống kiểm thử chip thật: chân ra luôn quan sát được, dây bên trong mới phải dùng que đo.
   Hệ quả: lỗi nghi ngờ = lỗi cùng "chữ ký đầu ra" với lỗi thật. Có màn par 0 (t02): suy luận thuần từ bảng chân trị.
2. **Lớp tương đương theo dây đo được** (không phải mọi net): dây không có ô để chạm thì không đo được, nên lỗi chỉ khác ở đó là không phân biệt nổi → gộp lớp, báo lỗi nào trong lớp cũng đúng. Bố trí mạch cấm nối thẳng cổng–cổng để hạn chế trường hợp này.
3. **Par = minimax có ghi nhớ** trên bitmask lớp (≤ 16 lớp) → tối ưu. Kiểm chứng bằng vét cạn mọi cây quyết định cài độc lập.
4. **Giới hạn đo = max(2·par, 3)** thay vì 2·par.

## Hệ quả
- 6 màn t01–t06, tất cả par tối ưu (2–4 lớp, par 0–3).
- Chế độ KIỂM THỬ và THIẾT KẾ dùng chung `Board` (lưới + mô phỏng + vẽ); KIỂM THỬ chỉ thêm lỗi cài vào mô phỏng và nhãn đo.
