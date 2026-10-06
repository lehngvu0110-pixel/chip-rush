# CHIP RUSH – Đặc tả gameplay (SPEC)

> Nguồn sự thật duy nhất cho luật chơi và công thức điểm. Code đọc tham số từ `src/config.ts`, và mọi tham số ở đó phải khớp file này.
> **Trạng thái:** luật chơi đã được Lê Hoàng Vũ duyệt ngày 06/10/2026. Từ nay chỉ chỉnh **tham số** (ghi lý do + ngày ở mục Lịch sử thay đổi), không đổi luật.

## 1. VẬN HÀNH (arcade)

| Thành phần | Quy tắc |
| --- | --- |
| Gói bit | 2 bit đầu vào A, B + 1 bit mục tiêu, rơi từ trên xuống cổng ở đáy |
| Thao tác | Chạm 1 trong 4 nút AND / OR / XOR / NAND trước khi gói chạm đáy; cổng nào cho đầu ra đúng đều tính đúng |
| Mở khóa cổng | Bắt đầu AND, OR; XOR từ 100 điểm; NAND từ 250 điểm |
| Sinh gói | ≥ 60% số gói chỉ có đúng 1 cổng (trong các cổng đã mở) cho kết quả đúng |
| Tốc độ | Thời gian rơi bắt đầu 3,0 s; cứ 5 câu đúng nhân 0,96; tối thiểu 0,9 s |
| Điểm | Đúng = 10 × hệ số; hệ số = 1 + floor(combo / 5), tối đa 4; sai thì combo về 0 |
| Vô tận | 3 mạng; sai mất 1 mạng; hết mạng là thua; bật độ khó thích nghi (mục 5.3) |
| Thử thách 60 giây | Không tính mạng; sai trừ 5 điểm; chuỗi gói cố định theo seed; **tắt** thích nghi để điểm so sánh công bằng |
| Kết quả | Điểm, độ chính xác, combo dài nhất, cổng hay sai nhất |

Logic thời gian tính theo thời gian thực (`deltaTime`), không theo số frame: chạy giống nhau ở 60 Hz và 120 Hz.

## 2. THIẾT KẾ (giải đố)

**Qua màn** khi: đúng 100% số hàng bảng chân trị, không đoản mạch, mọi đầu ra đều được nối. Đúng một phần chỉ hiện phản hồi ("3/4 hàng đúng"). Không có thua; kiểm tra, hoàn tác, làm lại không giới hạn.

**Chỉ số PPA** (số nguyên, càng nhỏ càng tốt):

- **Area (A)**: số ô lưới bị chiếm (dây + cổng + via).
- **Delay (D)**: độ sâu logic — số cổng nhiều nhất trên một đường từ đầu vào đến đầu ra.
- **Power (P)**: tổng số lần đổi trạng thái 0↔1 trên mọi net khi duyệt hết bảng chân trị theo thứ tự mã Gray (đại lượng thay thế cho công suất động, vốn tỉ lệ với switching activity).

**Chi phí:** `C = A + w_D·D + w_P·P`, với `w_D = 3`, `w_P = 1` (chỉnh sau khi chơi thử d01–d06).

**Par** = (A, D, P, C) của **một** lời giải tham chiếu có C nhỏ nhất do solver tìm (mục 5.1) → 3 sao luôn đạt được.

**Sao:** mỗi chỉ số ≤ par tương ứng được 1 sao (0–3 sao). **Điểm chia sẻ** = `round(1000 × C_par / C_người_chơi)`; 1000 = ngang AI kỹ sư. Dùng **Gợi ý** (hiện dây tiếp theo của lời giải tham chiếu) thì màn đó tối đa 2 sao.

| Màn | Tên | Khái niệm mới | MVP |
| --- | --- | --- | --- |
| d01 | Nối điện | Dây dẫn: nguồn → LED | Có |
| d02 | Đi vòng | Routing quanh vật cản | Có |
| d03 | Hai đường | Dây không được cắt nhau (đoản mạch) | Có |
| d04 | Đảo | NOT | Có |
| d05 | Cả hai | AND | Có |
| d06 | Một trong hai | OR | Có |
| d07 | Khác nhau | XOR + đọc bảng chân trị | Có |
| d08 | Tự ghép | NAND = AND + NOT | Có |
| d09 | Cầu vượt | Via, lớp kim loại 2 | Nên có |
| d10 | Chọn kênh | MUX 2:1 | Nên có |
| d11 | Cộng nửa | Half adder, 2 đầu ra | Nên có |
| d12 | Cộng đủ | Full adder | Nên có |

Lưới tối đa 8 cột × 10 hàng để ô ≥ 44 px trên màn rộng 360 px.

## 3. KIỂM THỬ (suy luận)

| Thành phần | Quy tắc |
| --- | --- |
| Màn chơi | Mạch có sẵn + bảng chân trị chuẩn + đúng 1 lỗi ẩn |
| Mô hình lỗi | t01–t03: 1 cổng cho đầu ra đảo ngược; t04–t06: 1 net stuck-at-0 hoặc stuck-at-1 |
| Đo | Đổi công tắc đầu vào miễn phí; đọc giá trị 1 net với đầu vào hiện tại = 1 lần đo |
| Trả lời | Chọn cổng/net nghi hỏng; đúng nếu cùng lớp tương đương với lỗi thật |
| Thua | Trả lời sai 2 lần, hoặc số lần đo vượt 2 × par |
| Sao | 3 sao: đo ≤ par; 2 sao: ≤ par + 2; 1 sao: qua màn |

## 4. Tiến trình, lưu trữ, Daily Chip

- VẬN HÀNH luôn mở. THIẾT KẾ mở d01, qua màn nào mở màn kế. KIỂM THỬ mở sau khi qua d05; màn t mở tuần tự.
- Hub hiện tổng sao và kỷ lục VẬN HÀNH.
- Lưu `localStorage`, khóa `chiprush.v1`:
  ```ts
  { version: 1,
    design: { [id]: { stars, best: { A, D, P }, hinted } },
    debug:  { [id]: { stars, probes } },
    runtime: { bestEndless, best60 },
    daily: { lastDate, streak },
    settings: { muted, reducedMotion } }
  ```
  Sai `version` → thử chuyển đổi; không được → reset và báo người chơi. Lưu trữ lỗi → chạy bằng bộ nhớ RAM, báo "Tiến độ không lưu được trên trình duyệt này".
- **Daily Chip** (sau khi nộp): 1 màn THIẾT KẾ/ngày theo giờ Việt Nam (UTC+7), đổi đề 00:00. 28 đề cho 26/10–22/11 sinh + giải trước bằng `tools/`, đóng vào build. Phần thưởng: streak + lưới kết quả để chia sẻ.

## 5. AI & solver

Chỉ nói "tối ưu"/"tối thiểu" khi thuật toán đã duyệt hết không gian. Cả ba đều là AI cổ điển (tìm kiếm, thống kê trực tuyến), không phải LLM.

### 5.1 Solver THIẾT KẾ ("AI kỹ sư")
- Duyệt cách đặt cổng; với mỗi cách, đi dây từng net bằng A* trên lưới 2 lớp; branch-and-bound theo C.
- Phạm vi: lưới ≤ 8 × 10, ≤ 4 cổng; chạy offline (`tools/solve-levels`), ≤ 60 s/màn.
- Ghi vào JSON: `par: {A, D, P, C}`, `parOptimal` (true nếu duyệt hết), `parSource` (`"solver"` | `"human"`).
- Không tìm ra lời giải → CI đỏ, màn không vào build (tạm dùng lời giải mẫu, `parSource: "human"`).
- Kiểm chứng: lời giải qua `verify`; par không tệ hơn lời giải mẫu; vét cạn (`tools/audit-solver`) trên màn ≤ 5 × 5, ≤ 2 cổng phải ra cùng C_par; bản dev cảnh báo khi người chơi đạt C < C_par ở màn `parOptimal: true`.

### 5.2 Solver KIỂM THỬ
- Giả thuyết = lớp lỗi sau khi gộp lỗi tương đương (fault collapsing).
- Par = số lần đo ít nhất trong **trường hợp xấu nhất** để còn 1 lớp: minimax có ghi nhớ khi ≤ 16 lớp và ≤ 64 phép đo; quá ngưỡng hoặc > 60 s → greedy theo information gain, `parOptimal: false`. (Tìm cây quyết định tối ưu tổng quát là NP-đầy đủ — Hyafil & Rivest, 1976.)
- Validator loại màn có lớp > 3 phần tử.
- Kiểm chứng: với mọi lỗi, cây quyết định của solver tìm đúng lớp trong ≤ par lần đo; t01 được vét cạn mọi cây để đối chiếu.

### 5.3 Độ khó thích nghi (VẬN HÀNH – Vô tận)
- Mục tiêu: tỉ lệ đúng 75–85% trên 20 gói gần nhất.
- Tốc độ: > 85% → thời gian rơi × 0,95; < 75% → × 1,05; luôn trong 0,9–3,0 s (thay đường tăng tốc cố định ở chế độ này).
- Loại gói: mỗi ô (cổng đáp án, cặp A-B) có Beta(sai + 1, đúng + 1); Thompson sampling ưu tiên ô hay sai; trộn 30% gói ngẫu nhiên đều.
- Kiểm chứng: người chơi giả lập với xác suất đúng cố định theo cổng hội tụ về 75–85% sau 60 gói; cùng seed → cùng chuỗi gói.

### 5.4 Câu hiển thị cho người chơi
| Tình huống | Câu |
| --- | --- |
| `parOptimal: true` | "AI kỹ sư đã chứng minh: không thể tốt hơn C = …" |
| `parOptimal: false` | "Par của AI kỹ sư: C = … (bạn có thể vượt!)" |
| KIỂM THỬ, par chính xác | "AI luôn tìm ra lỗi trong tối đa N lần đo, dù lỗi ở đâu" |
| Thích nghi | "Game đang ra nhiều câu XOR vì bạn hay sai cổng này" |

## Lịch sử thay đổi tham số
| Ngày | Tham số | Cũ → Mới | Lý do |
| --- | --- | --- | --- |
| 06/10/2026 | — | Khởi tạo | Duyệt luật |
