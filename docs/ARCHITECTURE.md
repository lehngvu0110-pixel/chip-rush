# Kiến trúc – CHIP RUSH

## Nguyên tắc
1. **Ba tầng:** `core/` (logic thuần, không import DOM) → `render/`, `ui/`, `input/`, `platform/` (trình duyệt) → `modes/` (luật riêng từng chế độ).
2. **`core/` và `ai/` chạy được trong Node** để test bằng Vitest và để `tools/` tính par offline.
3. **Mọi API trình duyệt có thể hỏng** (lưu trữ, âm thanh, chia sẻ) đều đi qua `platform/` và có đường dự phòng.
4. **Không backend, không gọi mạng sau lần tải đầu** ([ADR-0002](adr/0002-khong-backend.md)).

## Module
| Thư mục | Vai trò | Phụ thuộc được phép |
| --- | --- | --- |
| `src/core/circuit` | Kiểu dữ liệu mạch, cổng, lưới 2 lớp, netlist, mô phỏng | không |
| `src/core/level` | Màn THIẾT KẾ/KIỂM THỬ, Daily Chip (`daily.ts` + `daily.json`), validate, lời giải AI tính sẵn (`solutions.json`, `debug-solutions.json`) | `core/circuit`, `core/debug` |
| `src/core/debug` | Mô hình lỗi, lớp tương đương (KIỂM THỬ) | `core/circuit` |
| `src/core/scoring` | PPA, sao, điểm VẬN HÀNH | `core/circuit` |
| `src/core/progress.ts` | Tiến trình, mở khóa, schema lưu | `core/*` |
| `src/ai` | Solver THIẾT KẾ, solver KIỂM THỬ, độ khó thích nghi | `core/*` |
| `src/platform` | storage, visibility, share, errors | DOM |
| `src/render` | Canvas, theme, vẽ mạch, hiệu ứng, âm thanh | `core/*`, DOM |
| `src/input` | Pointer events → thao tác trên lưới; `grid-keys.ts`: bàn phím → chạm giả | DOM |
| `src/ui` | Dựng DOM thuần từ dữ liệu + callback: `dom.ts` (tiện ích), `start-screen.ts` (màn bắt đầu), `result-cards.ts` (thẻ kết quả 4 chế độ), `info-cards.ts` (danh sách màn, Cài đặt, trang AI), `share-button.ts`, `icons.ts` | `core/*`, `platform`, `render` (không giữ trạng thái game) |
| `src/main.ts` | Điểm vào: canvas + vòng lặp, giữ trạng thái chung (tiến độ, âm thanh, scene), điều hướng giữa các màn, móc test `?e2e` | mọi tầng |
| `src/modes/*` | Scene từng chế độ | mọi tầng dưới |
| `tools/` | Script Node: giải màn (`solve-levels.ts`), sinh + giải đề Daily (`gen-daily.ts`), ảnh nộp bài, kiểm tra dung lượng, subset font | `core/*`, `ai/*` |

## Vòng lặp game
- Một `requestAnimationFrame` duy nhất trong `main.ts` gọi `scene.update(dt)` rồi `scene.render()`.
- `dt` tính bằng giây, giới hạn tối đa 0,1 s (tránh nhảy cóc sau khi tab ẩn).
- Logic chỉ dùng `dt`, không đếm frame → đúng tốc độ ở 60 Hz và 120 Hz.
- `visibilitychange` / `blur` → `scene.pause()`; vòng lặp dừng khi tab ẩn.

## Dữ liệu màn chơi (dự thảo, chốt ngày 14/10)
```jsonc
{
  "id": "d05",
  "mode": "design",
  "grid": { "cols": 6, "rows": 8, "layers": 1 },
  "inputs":  [{ "id": "A", "cell": [0, 2] }, { "id": "B", "cell": [0, 5] }],
  "outputs": [{ "id": "Y", "cell": [5, 3] }],
  "blocked": [[2, 4]],
  "gatesAllowed": { "AND": 1 },
  "truthTable": [[0,0,0],[0,1,0],[1,0,0],[1,1,1]],   // A, B → Y
  "par": { "A": 9, "D": 1, "P": 5, "C": 17 },
  "parOptimal": true,
  "parSource": "solver"
}
```
Dữ liệu màn được `import` vào bundle (có hash) thay vì `fetch`, để không bao giờ lệch phiên bản với code ([ADR-0005](adr/0005-par-tinh-offline.md)).

## Mô phỏng
- Lưới → netlist: mỗi net là tập ô dây liên thông (cùng lớp, hoặc nối qua via); cổng là đỉnh có chân vào/ra.
- Kiểm tra trước khi mô phỏng: đoản mạch (2 nguồn khác nhau chung một net), dây hở, vòng lặp tổ hợp.
- Mô phỏng tổ hợp theo thứ tự topo, chạy mọi tổ hợp đầu vào (≤ 3 đầu vào → ≤ 8 hàng).
- Power: duyệt các hàng theo mã Gray, đếm số net đổi giá trị giữa hai hàng liên tiếp.

## AI
Xem [SPEC.md mục 5](SPEC.md#5-ai--solver) cho mô hình, giới hạn và kiểm chứng.
