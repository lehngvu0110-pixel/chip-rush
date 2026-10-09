// Chơi bằng bàn phím trên lưới (THIẾT KẾ, KIỂM THỬ): con trỏ ô di chuyển bằng phím mũi tên,
// Shift + mũi tên = kéo dây sang ô bên cạnh, Space/Enter = chạm vào ô. Logic thuần để test được;
// scene đổi hành động thành "chạm/kéo" giả rồi dùng lại đúng đường xử lý chạm → hành vi như ngón tay.

export type GridKeyAction = { kind: 'move'; dc: number; dr: number; draw: boolean } | { kind: 'tap' } | null;

const DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export interface KeyLike {
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

/**
 * @param focusOnControl true nếu đang focus một nút/ô nhập DOM: khi đó Space/Enter thuộc về nút đó,
 *   không được coi là chạm vào lưới.
 */
export function gridKeyAction(e: KeyLike, focusOnControl: boolean): GridKeyAction {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const d = DIRS[e.key];
  if (d) return { kind: 'move', dc: d[0], dr: d[1], draw: e.shiftKey };
  if ((e.key === ' ' || e.key === 'Enter') && !focusOnControl) return { kind: 'tap' };
  return null;
}

/** Di chuyển con trỏ, kẹp trong lưới. */
export function moveCursor(cur: [number, number], dc: number, dr: number, cols: number, rows: number): [number, number] {
  return [Math.min(cols - 1, Math.max(0, cur[0] + dc)), Math.min(rows - 1, Math.max(0, cur[1] + dr))];
}

/** Focus đang ở một điều khiển DOM (nút, link, ô nhập)? */
export function isControlFocused(doc: Document): boolean {
  const a = doc.activeElement;
  return !!a && a !== doc.body && /^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(a.tagName);
}

export const KEYBOARD_HELP = 'Bàn phím: mũi tên để di chuyển ô viền trắng, Space/Enter để chạm';
