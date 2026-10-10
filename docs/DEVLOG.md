# Nhật ký phát triển

Mỗi buổi một mục, mới nhất ở trên. Ghi: đã làm, quyết định, vướng mắc, việc tiếp theo.

## 2026-10-19 – Kiểm thử độ bền + checklist nộp bài
**Đã làm**
- `e2e/robustness.spec.ts` (13 test):
  - Chạm/kéo/bấm nút ngẫu nhiên có seed, 120 thao tác ở 5 màn (THIẾT KẾ d12, d09; KIỂM THỬ t09; VẬN HÀNH; Chip hôm nay), bắt mọi exception + `console.error` + màn hình lỗi.
  - localStorage bị chặn hoàn toàn; bộ nhớ đầy giữa chừng.
  - 5 kiểu dữ liệu lưu hỏng.
  - Đổi cỡ màn hình đúng lúc đang giữ ngón tay kéo dây, rồi chuyển tab.
- **Tìm được 1 lỗi thật (B-01):** dữ liệu lưu hỏng ở một màn (vd. `"d01": "x"`) → qua màn đó thì game văng màn hình lỗi. Sửa: `loadSave` kiểm tra và làm sạch từng mục THIẾT KẾ/KIỂM THỬ (bỏ mục hỏng, kẹp số sao 0–3, số âm → 0). Thêm `tests/progress.test.ts`.
- Monkey test chỉ chạy trên Chromium để CI không chậm thêm ~4 phút.
- `docs/SUBMISSION.md`: checklist 12 việc trước khi nộp, ghi rõ ai làm.
- Tổng 388 unit, 34 E2E.

## 2026-10-18 – Đo hiệu năng trên máy ảo chậm + bậc đồ hoạ "min" + làm mới ảnh nộp bài
**Đã làm**
- `tools/perf-bench.mjs`: Chromium giả lập Pixel 7, làm chậm CPU 1/4/6 lần, đo khoảng cách frame ở 4 màn (màn chính, VẬN HÀNH đang chơi, THIẾT KẾ d12, KIỂM THỬ t09). Móc test `__CHIPRUSH__.perf()` đọc chất lượng hiện tại.
- Profiler: JS của game chỉ ~5% thời gian frame; phần lớn là trình duyệt vẽ điểm ảnh bằng CPU. Đổi DPR 2 → 1 tăng từ 23 lên 55 fps (CPU chậm 4×).
- Thêm bậc chất lượng `min` (high → low → min): hạ DPR canvas chính xuống 1,25 khi đã tắt hiệu ứng mà vẫn giật. Bộ điều chất lượng xét mỗi 30 frame (trước: 60) và đo lại đủ 120 frame sau mỗi lần hạ.
- Kết quả (CPU chậm 4×, sau khi tự hạ): 19–25 fps → 35–50 fps. CPU chậm 6× vẫn 14–21 fps → ghi rõ cần số đo máy thật (ADR-0006, TESTING).
- Chạy lại `tools/submission-assets.mjs`: ảnh màn chính mới (Chip hôm nay ngày 26/10, Huy hiệu), KIỂM THỬ 27 sao; mô tả nộp bài thêm huy hiệu; COMPLIANCE cập nhật.
- 1 unit mới (bậc min). Tổng 386 unit, 21 E2E.

**Quyết định**
- Không hạ DPR ngay từ đầu cho mọi máy: máy khoẻ vẫn nét ở DPR 2; chỉ máy đo được là chậm mới hạ.

## 2026-10-17 – Huy hiệu (thành tựu) xuyên 3 chế độ
**Đã làm**
- `src/core/badges.ts`: 12 huy hiệu, mỗi cái một hàm điều kiện thuần trên dữ liệu lưu.
  - THIẾT KẾ: Con chip đầu tiên, Trái tim của CPU (d12), Hơn cả AI (chi phí thấp hơn par), Kỹ sư 3 sao.
  - KIỂM THỬ: Bắt được con bọ, Trưởng ban kiểm phiếu (t09 ≤ par), Thám tử 3 sao.
  - VẬN HÀNH: Tay nhanh (500), Ép xung (2000), Nước rút (60 giây ≥ 300).
  - Chip hôm nay: chuỗi 3 ngày, 7 ngày.
- Trao huy hiệu sau mỗi kết quả (thông báo gộp + âm "mở khoá"); người chơi cũ được trao bù im lặng khi mở game.
- Màn chính có link "Huy hiệu x/12" → bảng huy hiệu (đã đạt: màu cam + ngày đạt; chưa đạt: vẫn hiện cách đạt).
- `save.badges` (id → ngày), đọc dữ liệu lưu bỏ khoá/ngày không hợp lệ; dữ liệu cũ không có trường này vẫn đọc được.
- axe phát hiện danh sách cuộn không focus được bằng bàn phím → thêm `tabindex` + nhãn.
- 7 unit + 2 E2E mới. Tổng 385 unit, 21 E2E; JS 57 KB gzip.

**Quyết định**
- Không có huy hiệu "may mắn" (đoán đúng không đo) để không khuyến khích đoán mò ở KIỂM THỬ.
- "Hơn cả AI" chỉ tính khi chi phí THẤP HƠN par, bằng par thì chưa.

## 2026-10-16 – Thêm 3 màn KIỂM THỬ (t07–t09)
**Đã làm**
- t07 "Ngã ba" (cổng đảo, dây rẽ nhánh, 3 khả năng, par 2), t08 "Hai đèn chỉ đường" (dây kẹt, 2 đèn khoanh vùng, par 2), t09 "Bỏ phiếu" (mạch đa số, dây kẹt, 5 khả năng, par 3 — màn khó nhất). AI kỹ sư tự bố trí mạch, minimax tính par; cả 3 đều tối ưu.
- `tools/explore-faults.ts`: với bố trí đã lưu, thử mọi lỗi của mô hình làm "lỗi thật", in số khả năng + par → chọn lỗi hay nhất thay vì đoán.
- Kết quả thăm dò (ghi trong LEVELS.md) khiến mình bỏ 3 ý tưởng: mạch đa số với lỗi cổng đảo (mọi lỗi đều par 0 — nhìn đèn là biết), bộ cộng đủ 7 cổng (AI không bố trí được trên lưới 8×8), bộ chọn kép MUX + XOR (lỗi hay nhất giống hệt t04). Vì vậy chỉ thêm 3 màn, không phải 4 như kế hoạch.
- Mọi test KIỂM THỬ tự chạy cho màn mới (par = vét cạn mọi cây, cây của solver tìm đúng lớp, AI phát lại ≤ par…): 378 unit, 19 E2E xanh.

**Việc tiếp theo**
- Vũ: chơi thử t07–t09 xem độ khó có tăng dần không.

## 2026-10-15 – Dọn code: tách main.ts thành module UI, bật kiểm tra biến thừa
**Đã làm**
- `src/main.ts` từ ~920 dòng còn 541. Phần dựng DOM chuyển sang `src/ui/`, mỗi file chỉ dựng giao diện từ dữ liệu + callback, không giữ trạng thái game:
  - `dom.ts`: el/button/action/extLink, ngôi sao, số chạy, focus không viền.
  - `start-screen.ts`: màn bắt đầu (die chip, Chip hôm nay, CHƠI NGAY, kỷ lục).
  - `result-cards.ts`: thẻ kết quả VẬN HÀNH / THIẾT KẾ / Chip hôm nay / KIỂM THỬ + `designVerdict`.
  - `info-cards.ts`: danh sách màn (dùng chung THIẾT KẾ và KIỂM THỬ), trang AI kỹ sư, Cài đặt.
  - `share-button.ts`: nút chia sẻ (tạo ảnh sẵn).
- `main.ts` còn: khởi động, vòng lặp, HUD/tạm dừng, ghi tiến độ, điều hướng. Thêm 4 hàm gom việc lặp lại: `showCard`, `showPanel`, `enterPlay`, `backToBoard` (trước đây mỗi màn tự ẩn/hiện 5–6 panel).
- `tsconfig`: bật `noUnusedLocals` + `noUnusedParameters`; xoá code chết (3 icon không dùng, `gateArity`, `debugLevelById`).
- Không đổi hành vi: 363 unit + 19 E2E giữ nguyên và đều xanh, chụp lại màn hình so sánh không khác. JS 55 KB gzip.

**Quyết định**
- Chưa làm lưu trữ bền (`navigator.storage.persist`) / xuất-nhập tiến độ vì Vũ nói chưa cần (13/10).
- Refactor trước khi nộp vì BTC chấm qua link GitHub: người đọc code mở `main.ts` đầu tiên.

## 2026-10-14 – Chạy tốt trên máy tính/tablet + accessibility (WCAG AA) + chơi bằng bàn phím
**Đã làm**
- Chụp mọi màn ở 5 cỡ: điện thoại dọc, điện thoại xoay ngang (915×412), tablet (820×1180), laptop thấp (1366×640), máy tính (1440×900). Phát hiện:
  - Laptop: lưới THIẾT KẾ/KIỂM THỬ bị bảng chân trị chiếm phần trên → ô nhỏ.
  - Điện thoại xoay ngang: lưới bị thanh công cụ che, không chơi được.
- `layout.ts`: bố cục rộng (màn ≥ 760 px và ngang hơn dọc) đặt bảng chân trị bên trái lưới; ô ≥ 44 px ở 1366×640, 1440×900, 1180×820 cho cả 12 màn (có test).
- Điện thoại xoay ngang (CSS: landscape + cao ≤ 500 px + màn cảm ứng): màn "Xoay dọc điện thoại để chơi". Game đã tự tạm dừng khi xoay.
- Màn lớn: die chip ở màn chính to hơn (tối đa 440 px).
- axe-core (WCAG 2.1 AA) quét 10 màn, ban đầu có 4 loại lỗi, nay 0:
  - Viewport chặn zoom (`user-scalable=no`): đã bỏ; canvas vẫn `touch-action: none`, `#app` dùng `touch-action: manipulation` để chạm đúp không zoom.
  - Nội dung ngoài landmark: `#app` thành `<main>`, canvas có `role="img"` + nhãn.
  - `aria-label` trên `span` sao không có role: thêm `role="img"`.
  - Ô tiêu đề bảng PPA rỗng: ghi "Chỉ số".
- Chơi bằng bàn phím (`src/input/grid-keys.ts`): mũi tên di chuyển con trỏ ô, Shift + mũi tên kéo dây/tẩy, Space/Enter chạm. Bàn phím phát lại "chạm giả" qua đúng đường xử lý ngón tay → không có logic thứ hai. Vùng `aria-live` mô tả ô đang đứng cho trình đọc màn hình. Space/Enter khi đang focus nút thì để nút xử lý.
- 6 unit (bố cục rộng, phím) + 5 E2E mới. Tổng 363 unit, 19 E2E; JS 54 KB gzip.

**Quyết định**
- Điện thoại xoay ngang: nhắc xoay dọc thay vì làm bố cục ngang riêng — màn 412 px cao không đủ chỗ cho lưới + thanh công cụ 2 hàng mà vẫn giữ ô ≥ 44 px.
- Bỏ chặn zoom vì WCAG 1.4.4 (và iOS Safari vốn đã bỏ qua `user-scalable=no`).

**Việc tiếp theo**
- Vũ: thử VoiceOver (iPhone) hoặc TalkBack (Android) ở màn chính + một màn THIẾT KẾ, ghi kết quả vào TESTING.

## 2026-10-13 – AI minh bạch: giải thích AI kỹ sư ngay trong game
**Đã làm**
- `src/core/level/ai-info.ts`: câu hiển thị theo SPEC 5.4.
  - Màn đã chứng minh: "AI kỹ sư đã chứng minh: với cách ghép cổng này, không thể tốt hơn C = …".
  - Màn chưa chứng minh: "Par của AI kỹ sư: C = … (bạn có thể vượt!)".
  - KIỂM THỬ: "AI luôn tìm ra lỗi trong tối đa N lần đo, dù lỗi ở đâu".
  - `aiStats()` đếm số màn tối ưu từ dữ liệu thật.
- THIẾT KẾ / Chip hôm nay: dòng PPA ghi "(tối ưu)" khi đã chứng minh. Thẻ kết quả có nhận xét đúng phạm vi; vượt AI ở màn "đã chứng minh" thì giải thích là bạn ghép cổng theo cách khác.
- KIỂM THỬ: nút "Xem AI kỹ sư đo" phát lại từng bước (đổi đầu vào, viền cam dây đo, so mạch chuẩn, còn mấy khả năng) rồi kết luận lỗi. `aiProbeSteps` nằm trong `core/tutorial.ts`, dùng chung huấn luyện viên t01.
- VẬN HÀNH (Vô tận): sự kiện `adapt` → banner "AI: ra thêm câu X vì bạn hay sai cổng này". Mỗi cổng báo 1 lần mỗi ván, ngưỡng sai ≥ 34% sau ≥ 3 lần gặp. 60 giây không bao giờ báo vì đã tắt thích nghi.
- Trang "AI kỹ sư hoạt động thế nào?": vào từ Cài đặt và từ danh sách màn.
  - 3 thuật toán + giới hạn của từng cái.
  - AI trong quá trình làm game, link nhật ký AI.
  - Nói rõ không gửi dữ liệu.
- 12 unit + 3 E2E mới (tổng 357 unit, 14 E2E); JS 54 KB gzip.

**Quyết định**
- Sửa câu 5.4 (ghi trong Lịch sử SPEC): "tối ưu" của solver chỉ chứng minh cho mạch logic của AI. Câu cũ "không thể tốt hơn" nói quá, vì người chơi ghép cổng khác có thể rẻ hơn.

**Vướng mắc / cần Vũ quyết**
- Cân bằng KIỂM THỬ: báo đúng ngay mà không đo lần nào vẫn được 3 sao (0 ≤ par), và luật cho báo sai 1 lần. Màn có 2–4 khả năng thì đoán mò có xác suất 3 sao cao. Gợi ý: chỉ cho 3 sao khi số khả năng còn lại lúc báo = 1 (tức đã đủ thông tin). Đây là đổi luật nên cần Vũ duyệt.

## 2026-10-12 – Daily Chip ("Chip hôm nay")
**Đã làm**
- `tools/gen-daily.ts`: sinh 28 đề THIẾT KẾ có seed cố định.
  - Mạch ngẫu nhiên 1–3 cổng trên 2–3 công tắc; lưới 5–7 ô có vật cản; thử lưới 1 lớp trước, không đi dây được thì cho thêm lớp 2.
  - Loại đề: đèn hằng số, đèn bằng/đảo của một công tắc, 2 đèn giống nhau, cổng thừa (bỏ đi vẫn đúng), trùng bảng chân trị.
  - AI kỹ sư phải giải được mới nhận đề → `src/core/level/daily.json` (2,8 KB gzip). 4/28 đề được chứng minh tối ưu.
- `src/core/level/daily.ts`: ngày theo giờ VN (UTC+7), đề quay vòng (26/10 = đề 1), chuỗi ngày, lịch sử 40 ngày. `registerSolved` trong `validate.ts` để par/Gợi ý/lời giải AI dùng chung cho đề Daily.
- Màn chính: nút "CHIP HÔM NAY · dd/mm" (trạng thái: chưa làm / giữ chuỗi N ngày / đã xong ★). Thẻ kết quả: sao, điểm, chuỗi ngày, chia sẻ (ảnh + chữ có ★).
- Màn thấp (≤ 740 px): ẩn dòng giải thích, panel cuộn được thay vì bị cắt; tiêu đề nhỏ lại ở màn ≤ 340 px.
- 64 unit test mới (mọi đề hợp lệ, AI 3 sao, Gợi ý từ lưới trống qua màn, lịch đổi đúng 00:00 VN, chuỗi ngày, đọc dữ liệu lưu cũ) + 1 E2E (chuỗi 1 → 2 → mất khi bỏ 1 ngày). Tổng 345 unit, 11 E2E; JS 51 KB gzip.

**Quyết định**
- Làm Daily sớm (SPEC ghi "sau khi nộp") vì không cần máy chủ và giúp người vote có lý do quay lại; trước 26/10 đề vẫn quay vòng.
- Dữ liệu lưu thêm `daily.history` nhưng vẫn `version: 1` (trường mới có giá trị mặc định, dữ liệu cũ đọc được — có test).
- Bộ sinh: tầng 2 công tắc chỉ có 5 bảng 1 cổng và 10 bảng 2 cổng khác nhau → dùng hết thì tự chuyển sang tầng 3 công tắc, 3 cổng.

**Việc tiếp theo**
- Vũ: chơi thử vài đề Daily, báo đề nào quá dễ/khó; duyệt mục "làm rõ 12/10" trong SPEC 4.

## 2026-10-11 – Hướng dẫn lần đầu (d01, t01) + ảnh/logo/mô tả nộp bài
**Đã làm**
- `src/core/tutorial.ts` (logic thuần, test được):
  - `designGuide` = các bước còn thiếu so với lời giải AI, theo đúng thứ tự Gợi ý; `guidePolyline` = chuỗi ô cho "ngón tay ảo".
  - `debugCoach` = lọc các lớp lỗi còn khớp với những gì người chơi ĐÃ đo, rồi chạy lại minimax để chọn phép đo tiếp theo tối ưu.
- d01 (lần đầu, tới khi qua màn): đường chấm cam chạy từ A tới Y + ngón tay ảo; chữ đổi theo 3 bước; nút KIỂM TRA nhấp nháy khi nối xong. Không trừ sao. Bật "Giảm chuyển động" thì không có ngón tay chạy.
- t01 (lần đầu): viền cam ở dây nên đo và ở cột đầu vào cần đặt. Sau mỗi lần đo có giải thích "khớp mạch chuẩn → lỗi phía sau / lệch → lỗi phía trước". Khi còn 1 khả năng thì nút Báo lỗi nhấp nháy; AI không nói thẳng đáp án.
- Ảnh nộp bài trong `docs/submission/`:
  - 4 ảnh chơi thật (khung Pixel 7).
  - Logo PNG 512/1024 và bản nền trong suốt.
  - Ảnh bìa 1920×1080.
  - Tạo lại được bằng `tools/submission-assets.mjs`.
- `docs/SUBMISSION.md`: mô tả dài + bản rút gọn ~500 ký tự, link GitHub/Pages.
- README cập nhật trạng thái 3 chế độ và mô tả AI đúng với code: branch-and-bound + cận dưới + PathFinder, minimax, Thompson sampling.
- 22 unit test hướng dẫn, trong đó:
  - Làm hết bước hướng dẫn ở cả 12 màn THIẾT KẾ thì qua màn 3 sao.
  - Làm theo huấn luyện viên ở cả 6 màn KIỂM THỬ thì báo đúng lỗi với số lần đo ≤ par.
- 2 E2E hướng dẫn. Tổng 281 unit, 10 E2E xanh; JS 46,5 KB gzip.

**Quyết định**
- "Lần đầu" = chưa có kết quả qua màn trong tiến độ (không thêm trường lưu mới). Xoá tiến độ thì hướng dẫn hiện lại.
- Huấn luyện viên t01 tính lại minimax theo lượt đo THẬT của người chơi chứ không đi theo cây cố định, nên người chơi đo "lệch kịch bản" vẫn được chỉ tiếp đúng.
- Bỏ câu về mục tiêu nhân lực bán dẫn quốc gia khỏi mô tả nộp bài, để tránh mọi nội dung có thể bị coi là chính trị (điều IV.3).

**Việc tiếp theo**
- Vũ:
  - Điền MSSV vào README và SUBMISSION.
  - Xem lại câu chữ mô tả dài.
  - Đo hiệu năng trên 3 máy thật.
  - Duyệt các mục "chờ duyệt" trong SPEC.

## 2026-10-10 – Chia sẻ kết quả, âm thanh từng chế độ, Cài đặt
**Đã làm**
- `src/render/share-card.ts`: ảnh chia sẻ 1080×1350 (logo, chế độ, màn, sao, điểm lớn, PPA, link game) vẽ bằng Canvas, tạo sẵn khi thẻ kết quả mở để không mất "user gesture" trên iOS.
- `src/platform/share.ts`: chia sẻ theo bậc — Web Share kèm ảnh → Web Share chỉ chữ → sao chép lời mời vào clipboard → hộp thoại hiện chữ để tự chép. Nút "Chia sẻ kết quả" có ở cả 3 thẻ kết quả (THIẾT KẾ chỉ khi kết quả được tính, tức không xem lời giải AI).
- Âm thanh tổng hợp (Web Audio, không dùng file): đặt cổng, đo dây, thắng, thua, mở khoá cổng mới.
- Bảng Cài đặt (nút bánh răng ở màn chính): Âm thanh, Giảm chuyển động (mặc định theo hệ điều hành), giới thiệu + link mã nguồn, "Xoá toàn bộ tiến độ" phải bấm 2 lần và giữ lại cài đặt.
- 7 unit test chia sẻ (đủ các nhánh dự phòng, huỷ chia sẻ không báo lỗi) + 2 E2E (Cài đặt, chia sẻ khi không có Web Share). Tổng 259 unit, 8 E2E xanh; JS 44 KB gzip.

**Quyết định**
- Ảnh chia sẻ chỉ chứa điểm + link, không chứa tên người chơi hay dữ liệu cá nhân.
- Người dùng bấm "Huỷ" ở bảng chia sẻ hệ thống thì im lặng, không coi là lỗi.

**Việc tiếp theo**
- Hướng dẫn lần đầu (d01, t01), ảnh/logo nộp bài, README.

## 2026-10-09 – Màn hình chính "die chip" + Gợi ý THIẾT KẾ
**Đã làm**
- `src/modes/hub/hub-scene.ts`: màn hình chính là một die chip nhìn từ trên xuống, 3 khối THIẾT KẾ / KIỂM THỬ / VẬN HÀNH (hoạ tiết riêng: hàng ô chuẩn, lưới điểm đo, làn bit), thanh tiến độ, khoá, xung dữ liệu chạy trên bus giữa các khối. Nút DOM trong suốt đè đúng vị trí khối (trình đọc màn hình + test bấm được).
- `src/core/level/hint.ts`: Gợi ý = bước kế tiếp của lời giải AI (cổng trước, rồi dây/via lan từ công tắc). Bấm lần 1 chỉ cảnh báo "tối đa 2 sao", lần 2 hiện bóng mờ cam + tự chọn công cụ phù hợp. Ghi `hinted` vào tiến độ.
- 15 test gợi ý: làm theo gợi ý liên tục từ lưới trống luôn qua màn ở cả 12 màn (tổng 252 unit).
- Sửa: nút khối die bị nền `.btn` che mờ (CSS specificity).

**Việc tiếp theo**
- Vũ: duyệt các mục "chờ duyệt" (lưới THIẾT KẾ, KIỂM THỬ, mở khoá KIỂM THỬ sau d05).
- Chia sẻ kết quả (Web Share + dự phòng sao chép), âm thanh từng chế độ, đo hiệu năng lại trên 3 máy.

## 2026-10-08 (3) – Chế độ KIỂM THỬ chơi được (t01–t06) + solver minimax
**Đã làm**
- Tách `src/modes/design/board.ts` (lưới + mô phỏng có cài lỗi + vẽ) dùng chung cho THIẾT KẾ và KIỂM THỬ.
- `src/core/debug/faults.ts`: liệt kê lỗi (đảo cổng, kẹt 0/1), chữ ký đầu ra, lớp tương đương theo dây quan sát được.
- `src/ai/debug-solver.ts`: cây quyết định minimax (tối ưu ≤ 16 lớp), tham lam khi nhiều hơn; `runTree` để kiểm chứng.
- 6 màn t01–t06: AI kỹ sư tự bố trí mạch lên lưới, minimax tính par (0–3 lần đo, đều tối ưu).
- `src/modes/debug/debug-scene.ts`: đo dây (nhãn giá trị trên dây), bảng chân trị chuẩn vs thật (tô ô lệch), báo lỗi (cổng hoặc dây kẹt 0/1), báo sai 2 lần / đo quá giới hạn thì thua và hiện lỗi thật (cả lớp tương đương).
- Thẻ chế độ KIỂM THỬ, danh sách màn, thẻ kết quả, lưu `save.debug`.
- 23 unit test (gồm đối chiếu vét cạn mọi cây quyết định) + 2 E2E (tổng 237 unit, 6 E2E).

**Quyết định**
- ADR-0008: đèn xem miễn phí; lớp tương đương theo dây đo được; giới hạn đo max(2·par, 3).

**Việc tiếp theo**
- Vũ: duyệt các làm rõ KIỂM THỬ (SPEC mục 3) — đặc biệt quy tắc mở khoá sau d05.
- Hub "die chip" (22/10 theo kế hoạch), gợi ý THIẾT KẾ, Daily Chip.

## 2026-10-08 (2) – AI kỹ sư (solver) + d10, d12 + đồ hoạ THIẾT KẾ
**Đã làm**
- `src/ai/design-solver.ts`: đặt cổng (duyệt hết / beam search), branch-and-bound với cận dưới, đi dây Dijkstra + PathFinder. `tools/solve-levels.ts` → `solutions.json`.
- AI thắng lời giải viết tay ở d05, d06, d08, d09, d11 (d11: C 34 → 30); chứng minh tối ưu 7/12 màn (d01–d06, d08).
- Màn mới d10 (MUX 2:1) và d12 (cộng đủ, 5 cổng) — chỉ khai báo mạch logic, AI tự bố trí.
- Đồ hoạ: "dòng điện" chạy dọc dây mang bit 1 đúng chiều tín hiệu, quầng sáng dây, cổng sáng khi ra 1; sao bật lần lượt, điểm chạy số; thẻ chế độ ở màn bắt đầu (biểu tượng + tiến độ); nút "Xem cách AI kỹ sư làm".
- 9 test solver + kiểm tra mọi màn bằng lời giải AI (tổng 214).

**Quyết định**
- ADR-0007. "Tối ưu" chỉ khi duyệt hết **và** chạm cận dưới (chặt hơn SPEC cũ "duyệt hết" — vì đi dây là heuristic).
- Xem lời giải AI → lần qua màn đó không tính kết quả.

**Việc tiếp theo**
- Vũ: chơi d10–d12; xem lời giải AI có dễ hiểu không.
- Chế độ KIỂM THỬ (t01–t03) + solver minimax (SPEC 5.2).

## 2026-10-08 – Chế độ THIẾT KẾ chơi được (việc 12–14/10 làm sớm)
**Đã làm**
- `src/core/level/`: định dạng màn, 10 màn d01–d09 + d11 (d10, d12 chờ solver), kiểm tra dữ liệu màn, chấm bài (mạch hợp lệ → đúng bảng chân trị → PPA, sao, điểm).
- `src/core/scoring/design.ts`: C = A + 3D + P, sao, điểm chia sẻ 1000 × C_par / C.
- `src/modes/design/`: scene THIẾT KẾ — kéo ngón tay vẽ dây (tự chèn ô khi lướt nhanh), đặt/xoay cổng, via, tẩy, đổi lớp, hoàn tác (Ctrl+Z), xoá hết; mô phỏng trực tiếp (dây sáng theo bit, kể cả khi đang vẽ dở); bảng chân trị ngang có dấu đúng/sai từng cột, chạm cột để đặt công tắc; tô đỏ ô lỗi; dòng PPA trực tiếp so với AI kỹ sư.
- Danh sách màn (khoá/mở, sao), thẻ kết quả (bảng Bạn vs AI kỹ sư), lưu tiến độ `save.design`.
- 35 unit test mới (tổng 179) + 2 E2E mới (qua d01 bằng kéo thật, hoàn tác).

**Quyết định**
- Par tạm = PPA lời giải viết tay (ghi rõ trong SPEC, LEVELS: "Tối ưu? = Chưa") cho tới khi có solver.
- Thanh công cụ 2 hàng + 1 dải gợi ý/thông báo để lưới đủ lớn: test bảo đảm ô ≥ 44 px trên Redmi Note 8 và iPhone 11.

**Việc tiếp theo**
- Vũ: chơi thử d01–d11 trên điện thoại, ghi chỗ khó hiểu vào cột "Ghi chú chơi thử" của LEVELS.md; duyệt mô hình lưới (SPEC mục 2).
- Solver AI kỹ sư (SPEC 5.1) → par thật + d10, d12.

## 2026-10-07 (4) – Đồ hoạ bo mạch neon + lưới 2 lớp (việc 10–11/10 làm sớm)
**Đã làm**
- Sửa CI: `vite preview` bind `127.0.0.1` (trên runner, `localhost` có thể ra IPv6 nên Playwright chờ mãi). CI xanh, GitHub Pages chạy.
- Đồ hoạ (Vũ chọn phong cách "bo mạch neon"): nền PCB sinh từ seed + xung điện; con chip có chân cắm vào ổ; nút có ký hiệu cổng IEEE; hạt sáng, vòng sóng, rung, viền đỏ khi sai; điểm đếm số; thanh chuỗi đúng 5 vạch; mạng là LED; logo SVG; màn bắt đầu/kết quả/tạm dừng dạng thẻ. Nút "Đo hiệu năng" chỉ hiện với `?debug=1`.
- `src/core/circuit/grid.ts`: lưới 2 lớp (dây theo cạnh, via, cổng 1 ô có chân theo phía, lưu/nạp/hoàn tác).
- `src/core/circuit/netlist.ts`: lưới → netlist (union-find), `diagnose` dịch lỗi mạch sang ô lưới để tô đỏ, `areaOf`.
- 49 test mới (14 lưới, 25 netlist, 10 đồ hoạ thuần): dây cắt nhau, chập, dây hở, cầu vượt, cổng xoay, vòng lặp, half adder trên lưới khớp mạch mẫu (Delay 1, Power 8).

**Quyết định**
- ADR-0006: ánh sáng bằng sprite thay `shadowBlur`, nền vẽ 1 lần.
- Mô hình lưới (chờ Vũ duyệt, ghi trong SPEC mục 2): dây theo cạnh; cắt nhau cùng lớp = chập; cổng 1 ô.

**Việc tiếp theo**
- Vũ: đo lại hiệu năng 3 máy với `?debug=1` ngay trong màn chơi; duyệt mô hình lưới.
- 12–13/10: scene THIẾT KẾ (vẽ dây bằng kéo ngón tay, đặt cổng, kiểm tra, hoàn tác) dùng `grid.ts` + `gate-symbol.ts`.

## 2026-10-07 (task ngày 09/10, làm sớm)
**Đã làm**
- Chế độ **VẬN HÀNH** chơi trọn vòng: CHƠI NGAY → Vô tận (3 mạng, độ khó thích nghi) hoặc Thử thách 60 giây (seed theo ngày) → màn kết quả → Chơi lại / Về màn chính; kỷ lục lưu lại sau khi tải trang.
- Logic thuần (test được): `core/util/rng.ts`, `core/scoring/runtime.ts`, `ai/adaptive.ts` (Thompson sampling + điều tốc), `modes/runtime/spawner.ts`, `modes/runtime/game.ts`, `core/progress.ts`.
- Màn chơi: `modes/runtime/runtime-scene.ts` — gói bit rơi, 4 nút cổng 2×2 (cao 72 px) có gợi ý ý nghĩa cổng, phím tắt 1–4, nút Dừng, hiệu ứng đúng/sai, thông báo mở khóa cổng.
- Màn kết quả giải thích độ khó thích nghi ("Bạn hay sai cổng XOR nên game đã ra thêm câu XOR").
- 95 unit test; Playwright E2E kịch bản 1 (2 test) xanh trên Chromium giả lập Pixel 7; CI thêm bước E2E (Chromium + WebKit).

**Phát hiện khi viết test**
- Phép kiểm chứng độ khó thích nghi trong SPEC sai: với người chơi có xác suất đúng cố định, điều tốc không thể kéo tỉ lệ đúng về 75–85%. Đã đổi sang mô hình "càng nhanh càng dễ sai": có thích nghi đạt 81%, đường cố định chỉ 74% (ngoài vùng mục tiêu).

**Phát hiện khi xem ảnh chụp màn hình**
- Trả lời nhanh liên tiếp làm chữ "+20 ×2" chồng lên nhau → chỉ giữ 1 chữ nổi.
- "Đúng là: XOR" hiện khi gói mới đã ra → dễ hiểu nhầm là đáp án gói mới; đổi thành "Gói vừa rồi cần: XOR".
- Viền focus màu cam hiện sẵn trên nút khi mở trang bằng điện thoại → bỏ tự focus ở màn bắt đầu.

**Chưa kiểm chứng**
- Dự án WebKit (giả lập iPhone SE) của Playwright chưa chạy được ở máy làm việc (không tải được trình duyệt); sẽ chạy lần đầu trên GitHub Actions sau khi push.

**Việc tiếp theo**
- Vũ: chơi thử trên 3 điện thoại; đo hiệu năng bằng `?debug=1` (giờ đo được ngay khi đang chơi VẬN HÀNH).
- 10–11/10: `grid.ts` (lưới 2 lớp) + `netlist.ts` cho chế độ THIẾT KẾ.

## 2026-10-07 (task ngày 08/10, làm sớm)
**Đã làm**
- `src/platform/`: `storage.ts` (localStorage bọc try/catch, RAM dự phòng, báo mất lưu đúng 1 lần), `visibility.ts` (ẩn tab / blur / xoay → tạm dừng), `errors.ts` (bắt lỗi toàn cục, mã lỗi ổn định dạng E-XXXXXX, màn hình "Có lỗi xảy ra").
- `src/loop.ts` (dt theo thời gian thực, kẹp 0,1 s), `src/scene.ts`, `render/canvas.ts` (DPR kẹp tối đa 2), `render/theme.ts`, `render/audio.ts` (Web Audio tổng hợp, mở khóa bằng lần chạm đầu, tắt tiếng), `input/pointer.ts`.
- `debug/stats.ts` + `debug/perf-overlay.ts` (`?debug=1`: frame time trung vị/p95, độ trễ chạm, nút "Đo 60 s", sao chép kết quả JSON), tự tắt glow khi p95 > 33,4 ms.
- `debug/sandbox-scene.ts`: màn thử nghiệm kỹ thuật (lưới chạm/kéo, chấm chạy chu kỳ 3,00 s để kiểm tra màn 120 Hz, nút "Tải nặng").
- 72 unit test. Chạy thử bản build trên Chromium (giả lập Pixel 7) bằng Playwright: luồng chính, tạm dừng/tiếp tục, xoay ngang, localStorage bị chặn, nhúng iframe khác origin, lỗi runtime, font bị chặn.

**Lỗi tìm được khi chạy thử trên trình duyệt (unit test không bắt được)**
1. Vòng lặp gọi `requestAnimationFrame` tách khỏi `window` → "Illegal invocation": game không chạy, và màn hình lỗi cũng không hiện vì bộ xử lý lỗi gọi `cancelAnimationFrame` cũng hỏng. Đã sửa + thêm test hồi quy (test đỏ với code cũ, xanh với code mới); bộ xử lý lỗi giờ vẫn hiện màn hình lỗi kể cả khi dừng vòng lặp thất bại.
2. Font mono hệ thống đặt dấu tiếng Việt sai ("trễ" → "trê˜"). Đã chuyển chữ có dấu sang Be Vietnam Pro; font mono chỉ dùng cho chữ số (ghi vào ADR-0003).

**Việc tiếp theo**
- Vũ: chạy `npm run dev`, mở `http://<IP-Mac>:5173/?debug=1` trên 3 điện thoại, bấm CHƠI NGAY → "Đo 60 s" (vừa chạm/kéo vừa bật "Tải nặng" 30 s cuối) → dán kết quả vào `docs/TESTING.md`.
- 09/10: chế độ VẬN HÀNH + Playwright E2E kịch bản 1.

## 2026-10-07 (task ngày 07/10)
**Đã làm**
- `src/core/circuit/types.ts`: kiểu Netlist, lỗi mạch, mô hình lỗi KIỂM THỬ (`gate-invert`, `stuck-at`).
- `src/core/circuit/gates.ts`: 7 loại cổng (NOT, AND, OR, XOR, NAND, NOR, XNOR) bằng phép toán bit.
- `src/core/circuit/simulate.ts`: kiểm tra mạch (đoản mạch, dây hở, vòng lặp tổ hợp, sai số chân, trùng id) → sắp topo → mô phỏng, bảng chân trị, so bảng chân trị, Delay (độ sâu logic), Power (đếm toggle theo mã Gray), cài lỗi.
- 39 test, trong đó 1 test đối chiếu 500 mạch ngẫu nhiên với bộ đánh giá tham chiếu viết kiểu khác (đệ quy theo net).
- Kiểm tra đột biến thủ công: cố tình làm sai XOR, bỏ bước đầu của đếm toggle, bỏ stuck-at → test đều đỏ, nghĩa là test bắt được lỗi thật.

**Quyết định**
- Mô phỏng ở mức netlist; lưới vẽ (grid.ts) sẽ chuyển sang netlist sau. Nhờ vậy solver và chế độ KIỂM THỬ dùng chung bộ mô phỏng.
- Báo **mọi** lỗi mạch một lần thay vì dừng ở lỗi đầu, để UI tô đỏ tất cả chỗ sai.
- Lỗi vòng lặp chỉ báo cổng thực sự nằm trong vòng, không báo cổng phía sau.
- Power đếm cả net đầu vào và không tính bước quay vòng về hàng đầu (đã ghi trong code, cần ghi thêm vào SPEC nếu Vũ đồng ý).

**Việc tiếp theo**
- 08/10: canvas, pointer, audio, theme, platform/ (storage, visibility, errors), overlay đo hiệu năng.

## 2026-10-06
**Đã làm**
- Đọc điều lệ Phần thi Công nghệ; chọn ý tưởng CHIP RUSH (3 chế độ theo vòng đời con chip).
- Lập kế hoạch dự án, nhận góp ý từ người ngoài và bổ sung: MVP + thứ tự cắt, đặc tả gameplay, phạm vi AI, yêu cầu phi chức năng, kế hoạch kiểm thử.
- Vũ duyệt luật chơi → chép vào `docs/SPEC.md`.
- Dựng repo: Vite 8 + TypeScript 7 + Vitest 5, CI GitHub Actions, kiểm tra dung lượng.
- Font Be Vietnam Pro: subset còn 53,3 KB; phát hiện thiếu `tnum` và ký hiệu ✓ ✕ ↔ (ghi trong ADR-0003).

**Quyết định**
- Canvas thuần thay Phaser (ADR-0001), không backend (ADR-0002), không service worker (ADR-0004), par tính offline (ADR-0005).
- Font đặt trong `src/assets/fonts` để có hash (thay vì `public/fonts` như kế hoạch ban đầu).
- Thiết bị test: Redmi Note 8 (Android yếu), iPhone 11 (chuẩn iOS), iPhone 14 Pro Max (120 Hz).

**Việc tiếp theo**
- Vũ: gửi BTC 7 câu hỏi; mở `font-test.html` trên 3 điện thoại; tạo repo GitHub và bật Pages.
- 07/10: `gates.ts`, `simulate.ts` + test.
