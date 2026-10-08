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

Làm rõ khi cài đặt (07/10, không đổi luật):
- Chạm một nút = **trả lời ngay** cho gói đang rơi; gói mới xuất hiện ngay sau đó. Gói chạm khe mà chưa trả lời = **trượt** (tính như sai).
- Mỗi lúc chỉ có 1 gói trên màn hình.
- Cổng đã mở theo **điểm cao nhất từng đạt** trong ván, nên bị trừ điểm (60 giây) không làm khóa lại cổng.
- Thử thách 60 giây dùng seed theo ngày giờ Việt Nam (YYYYMMDD): cùng ngày, mọi người gặp cùng chuỗi gói.

## 2. THIẾT KẾ (giải đố)

**Qua màn** khi: đúng 100% số hàng bảng chân trị, không đoản mạch, mọi đầu ra đều được nối. Đúng một phần chỉ hiện phản hồi ("3/4 hàng đúng"). Không có thua; kiểm tra, hoàn tác, làm lại không giới hạn.

**Chỉ số PPA** (số nguyên, càng nhỏ càng tốt):

- **Area (A)**: số ô lưới bị chiếm (dây + cổng + via).
- **Delay (D)**: độ sâu logic — số cổng nhiều nhất trên một đường từ đầu vào đến đầu ra.
- **Power (P)**: tổng số lần đổi trạng thái 0↔1 trên mọi net khi duyệt hết bảng chân trị theo thứ tự mã Gray (đại lượng thay thế cho công suất động, vốn tỉ lệ với switching activity). Tính cả net đầu vào; không tính bước quay vòng từ hàng cuối về hàng đầu. Ví dụ half adder: P = 8.

**Chi phí:** `C = A + w_D·D + w_P·P`, với `w_D = 3`, `w_P = 1` (chỉnh sau khi chơi thử d01–d06).

**Par** = (A, D, P, C) của lời giải tốt nhất do AI kỹ sư tìm (mục 5.1; không bao giờ tệ hơn lời giải mẫu) → 3 sao luôn đạt được. Xem lời giải AI (sau khi qua màn) thì lần qua màn đó không tính kết quả.

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

Làm rõ khi cài đặt lưới (07/10, **chờ Vũ duyệt**, không đổi luật đã duyệt):
- **Dây = cạnh nối tâm 2 ô kề nhau** (ngang/dọc) trên một lớp. Hai dây song song sát nhau không dính nhau.
- Mọi dây cùng lớp chạm vào cùng một ô thường thì **nối với nhau** tại ô đó → hai dây **cắt nhau cùng lớp = chập** (d03). Muốn vượt qua phải lên lớp 2 bằng via (d09).
- **Cổng chiếm 1 ô** ở lớp 1. Mỗi phía của ô cổng là một chân riêng: phía chân ra (mặc định bên phải, xoay được) và 3 phía còn lại là chân vào. Mọi cổng 2 đầu vào trong game đều giao hoán nên không cần phân biệt chân 1/chân 2. Cổng 2 đầu vào phải có đúng 2 dây vào; NOT đúng 1.
- Lớp 2 đi được phía trên cổng và chân mà không nối vào; chỉ nối xuống lớp 1 qua via đặt ở ô thường.
- **Area** = số ô có dây ở lớp 1 + số ô có dây ở lớp 2 + số cổng + số via; **không** tính ô chân vào/đèn (cố định của màn). Ví dụ: dây thẳng qua 4 ô giữa = 4; đi cầu vượt tốn thêm ô lớp 2 và 2 via.

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
Cài đặt: `src/ai/design-solver.ts`, chạy offline bằng `tools/solve-levels.ts` (ADR-0007).
- **Bài toán:** mạch logic cố định (lấy từ lời giải mẫu hoặc trường `logic` của màn) → tìm vị trí + hướng từng cổng và đường đi mọi net trên lưới 2 lớp. Delay và Power chỉ phụ thuộc mạch logic nên tối ưu C ⇔ tối ưu Area.
- **Đặt cổng:** duyệt hết mọi cách đặt khi ≤ 60 000 tổ hợp (màn ≤ 2 cổng); nhiều hơn thì beam search theo tổng HPWL, loại sớm cách đặt chắc chắn hỏng.
- **Branch-and-bound:** mỗi cách đặt có cận dưới Area = số cổng + Σ cận dưới từng net (net 2 chân: đường ngắn nhất BFS có vật cản; net nhiều chân: HPWL + 1 nút, vì cây Steiner chữ nhật ≥ HPWL). Cận ≥ kết quả tốt nhất → bỏ.
- **Đi dây:** cây Steiner xấp xỉ bằng Dijkstra đa nguồn (chi phí = ô mới + via), thử nhiều thứ tự net; bố trí chật dùng đi dây thương lượng tắc nghẽn PathFinder (McMurchie & Ebeling, 1995).
- **"Tối ưu" (`proven`)** chỉ khi đã duyệt hết cách đặt **và** Area tìm được = cận dưới nhỏ nhất trên mọi cách đặt → không cách nào tốt hơn *với mạch logic này*. Không chứng minh được thì ghi "tốt nhất tìm được".
- **Kết quả ghi vào** `solutions.json`: `par`, lời giải (`state`), `source` (`solver` | `reference`), `proven`, `lowerBound`. Game tính lại par từ lời giải (không tin số ghi sẵn).
- **Kiểm chứng (test):** lời giải AI qua màn với 3 sao; par không tệ hơn lời giải mẫu; số ghi sẵn khớp khi tính lại; cận dưới ≤ Area thật trên mọi cách đặt ở d05; 5 màn nhỏ được chứng minh tối ưu với giá trị biết trước.
- Phạm vi hiện tại: lưới ≤ 8 × 10, ≤ 5 cổng (d12), mỗi màn < 5 s.

### 5.2 Solver KIỂM THỬ
- Giả thuyết = lớp lỗi sau khi gộp lỗi tương đương (fault collapsing).
- Par = số lần đo ít nhất trong **trường hợp xấu nhất** để còn 1 lớp: minimax có ghi nhớ khi ≤ 16 lớp và ≤ 64 phép đo; quá ngưỡng hoặc > 60 s → greedy theo information gain, `parOptimal: false`. (Tìm cây quyết định tối ưu tổng quát là NP-đầy đủ — Hyafil & Rivest, 1976.)
- Validator loại màn có lớp > 3 phần tử.
- Kiểm chứng: với mọi lỗi, cây quyết định của solver tìm đúng lớp trong ≤ par lần đo; t01 được vét cạn mọi cây để đối chiếu.

### 5.3 Độ khó thích nghi (VẬN HÀNH – Vô tận)
- Mục tiêu: tỉ lệ đúng 75–85% trên 20 gói gần nhất.
- Tốc độ: > 85% → thời gian rơi × 0,95; < 75% → × 1,05; luôn trong 0,9–3,0 s (thay đường tăng tốc cố định ở chế độ này).
- Loại gói: mỗi ô (cổng đáp án, cặp A-B) có Beta(sai + 1, đúng + 1); Thompson sampling ưu tiên ô hay sai; trộn 30% gói ngẫu nhiên đều.
- Điều tốc chỉ xét sau mỗi 5 câu trả lời và cần ≥ 10 câu trong cửa sổ, để tốc độ không nhảy liên tục.
- Kiểm chứng (sửa 07/10): người chơi giả lập có xác suất đúng **phụ thuộc tốc độ** (kỹ năng theo cổng × fall/(fall + 0,3)) được giữ ở tỉ lệ đúng trung bình 75–85% (đo được 81%; cùng mô hình với đường tăng tốc cố định chỉ đạt 74%). Bản cũ của câu này giả định xác suất đúng cố định — khi đó điều tốc không thể ảnh hưởng tỉ lệ đúng, nên phép kiểm chứng đó vô nghĩa. Cùng seed → cùng chuỗi gói.

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
| 07/10/2026 | VẬN HÀNH | Làm rõ, không đổi luật | Chạm = trả lời ngay; trượt khi chạm khe; mở khóa theo điểm cao nhất; nhịp điều tốc 5 câu; sửa phép kiểm chứng độ khó thích nghi |
| 07/10/2026 | Định nghĩa P | Làm rõ, không đổi luật | Ghi rõ cách đếm net đầu vào và bước quay vòng khi viết `simulate.ts` |
| 08/10/2026 | Solver THIẾT KẾ | Cài đặt | Thêm cận dưới + PathFinder; định nghĩa "tối ưu" chặt hơn bản đầu (phải chạm cận dưới, không chỉ duyệt hết cách đặt) |
| 07/10/2026 | Lưới THIẾT KẾ | Làm rõ, chờ duyệt | Dây theo cạnh, cắt nhau cùng lớp = chập, cổng 1 ô có chân theo phía, cách tính Area |
