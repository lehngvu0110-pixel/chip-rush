# Kiểm thử

Kế hoạch đầy đủ nằm trong tài liệu kế hoạch dự án; file này ghi **kết quả**.

## Thiết bị
| Vai trò | Model | Hệ điều hành | Trình duyệt + phiên bản | Ghi chú |
| --- | --- | --- | --- | --- |
| Android yếu (sàn hiệu năng) | Redmi Note 8 | _(điền)_ | Chrome _(điền)_ | Kiểm tra còn cập nhật được Chrome mới |
| iPhone chuẩn | iPhone 11 | iOS _(điền)_ | Safari | |
| iPhone 120 Hz | iPhone 14 Pro Max | iOS _(điền)_ | Safari | Chỉ kiểm tra tốc độ game, không đo ngưỡng |

## Ngưỡng
| Chỉ số | Redmi Note 8 | iPhone 11 | iPhone 14 Pro Max |
| --- | --- | --- | --- |
| Tải trên 4G thật (trung vị 3 lần) | ≤ 3,0 s | ≤ 3,0 s | — |
| Frame time trung vị / p95 | ≤ 16,7 / ≤ 33 ms | ≤ 16,7 / ≤ 25 ms | — |
| Độ trễ chạm p95 | ≤ 50 ms | ≤ 50 ms | — |
| Chênh tốc độ so với 60 Hz | — | — | ≤ 2% |

## Cách đo trên điện thoại
1. Trên Mac: `npm run dev` (máy và điện thoại cùng Wi-Fi), xem IP của Mac.
2. Điện thoại mở `http://<IP-Mac>:5173/?debug=1` (hoặc link GitHub Pages + `?debug=1`) → bấm **Đo hiệu năng** (nút này chỉ hiện khi có `?debug=1`). Sau đó đo thêm một lượt **ngay trong màn chơi** (CHƠI NGAY) vì từ 07/10 màn chơi có nền bo mạch, xung điện và hạt sáng.
3. Bấm **Đo 60 s**. Trong 30 s đầu: chạm và kéo liên tục trên lưới. 30 s sau: bật **Tải nặng** và tiếp tục chạm.
4. Hết giờ → **Sao chép** → dán JSON vào bảng dưới (cột Kết quả), ghi thêm "Chu kỳ chấm chạy" hiển thị trên màn.
5. iPhone 14 Pro Max: chỉ cần ghi "Chu kỳ chấm chạy" (phải ≈ 3,00 s như iPhone 11).

Lưu ý: dev server chưa nén/tối ưu như bản build; số đo khung hình vẫn dùng được, còn thời gian tải phải đo trên bản GitHub Pages.

## Kết quả đo
| Ngày | Bản (hash) | Thiết bị | Chỉ số | Kết quả | Đạt? |
| --- | --- | --- | --- | --- | --- |
| 07/10 | 47836a2+ | Chromium headless giả lập Pixel 7 (không phải máy thật, chỉ để so sánh) | frame trung vị / p95; trễ chạm p95; chu kỳ chấm | 16,7 / 16,7 ms; 36,7 ms; 3,00 s | Tham khảo |

## Kiểm tra dấu tiếng Việt (`font-test.html`)
| Thiết bị | Ngày | Kết quả |
| --- | --- | --- |
| Redmi Note 8 | | |
| iPhone 11 | | |
| iPhone 14 Pro Max | | |
| Desktop | | |

## Lỗi đã biết
| Mã | Mức | Mô tả | Cách né | Trạng thái |
| --- | --- | --- | --- | --- |

## Khả năng truy cập (accessibility)
- `e2e/access.spec.ts` chạy **axe-core** (devDependency, không vào bản build) với bộ luật WCAG 2.0/2.1 A + AA + best-practice trên màn chính, Cài đặt, trang AI, danh sách màn, màn THIẾT KẾ, thẻ kết quả → 0 lỗi (14/10).
- Giới hạn: axe chỉ kiểm phần DOM. Nội dung vẽ trên canvas (lưới, bảng chân trị) không đọc được bằng trình đọc màn hình; bù lại bằng vùng `aria-live` mô tả ô con trỏ bàn phím đang đứng, và mọi thao tác có phím tương ứng. Chưa thử với VoiceOver/TalkBack thật.

## E2E hiện có
- `e2e/access.spec.ts`: axe (WCAG AA); chơi d01 và đo t01 chỉ bằng bàn phím; điện thoại xoay ngang → nhắc xoay dọc; laptop 1366×640 → bảng chân trị bên trái, ô ≥ 44 px.
- `e2e/play-now.spec.ts`: VẬN HÀNH (Vô tận, 60 giây, tạm dừng, kỷ lục).
- `e2e/design.spec.ts`: THIẾT KẾ d01 (báo lỗi đèn chưa nối → kéo dây → qua màn 3 sao → lưu và mở d02), hoàn tác.
- `e2e/debug.spec.ts`: KIỂM THỬ t01 (đo 1 dây, đo lại không tính → báo đúng cổng → 3 sao), báo sai 2 lần → thua và hiện lỗi thật.
- `e2e/settings.spec.ts`: Cài đặt (tắt âm thanh được lưu, xoá tiến độ phải bấm 2 lần, giữ cài đặt); chia sẻ khi trình duyệt không có Web Share → sao chép lời mời kèm link.
- `e2e/ai.spec.ts`: trang AI kỹ sư (số liệu thật, link nhật ký AI, quay lại Cài đặt); câu "đã chứng minh" ở thẻ kết quả d01; "Xem AI kỹ sư đo" ở t01 phát lại 2 bước rồi kết luận.
- `e2e/daily.spec.ts`: Chip hôm nay (giả ngày bằng `?e2e&date=`): qua đề → chuỗi 1; hôm sau → chuỗi 2, đề khác; bỏ 1 ngày → chuỗi 0.
- `e2e/tutorial.spec.ts`: hướng dẫn d01 (3 bước chữ, KIỂM TRA nhấp nháy, 3 sao, lần sau không hiện); hướng dẫn t01 (làm theo dây AI chỉ → còn 1 khả năng → báo đúng, ≤ par lần đo).
