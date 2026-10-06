// Lưu trữ an toàn: localStorage có thể NÉM LỖI ngay cả khi đọc (Safari Private Mode cũ,
// iframe khác domain bị chặn/partition, cookie bên thứ ba bị chặn) hoặc khi ghi (đầy bộ nhớ).
// Mọi truy cập đi qua đây; khi hỏng, game vẫn chạy bằng bộ nhớ RAM và báo cho UI một lần.

export interface SafeStorage {
  /** Đọc JSON; trả `fallback` nếu không có, hỏng JSON, hoặc trình duyệt chặn. */
  get<T>(key: string, fallback: T): T;
  /** Ghi JSON. Trả false nếu chỉ lưu được vào RAM (sẽ mất khi tải lại trang). */
  set(key: string, value: unknown): boolean;
  remove(key: string): void;
  /** true nếu đang lưu bền được (localStorage hoạt động). */
  readonly persistent: boolean;
  /** Đăng ký nghe sự kiện mất khả năng lưu bền (gọi tối đa 1 lần). */
  onPersistenceLost(cb: () => void): void;
}

type Backend = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const PROBE_KEY = '__chiprush_probe__';

function defaultBackend(): Backend | null {
  // Chính việc truy cập `localStorage` cũng có thể ném SecurityError.
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function createSafeStorage(getBackend: () => Backend | null | undefined = defaultBackend): SafeStorage {
  const mem = new Map<string, string>();
  const listeners: (() => void)[] = [];
  let backend: Backend | null = null;
  let persistent = false;
  let lostNotified = false;

  // Thử ghi/xóa một khóa để biết localStorage có thật sự dùng được.
  try {
    const b = getBackend() ?? null;
    if (b) {
      b.setItem(PROBE_KEY, '1');
      b.removeItem(PROBE_KEY);
      backend = b;
      persistent = true;
    }
  } catch {
    backend = null;
    persistent = false;
  }

  const markLost = (): void => {
    persistent = false;
    backend = null;
    if (!lostNotified) {
      lostNotified = true;
      for (const cb of listeners) cb();
    }
  };

  return {
    get<T>(key: string, fallback: T): T {
      let raw: string | null = null;
      if (backend) {
        try {
          raw = backend.getItem(key);
        } catch {
          markLost();
        }
      }
      if (raw === null) raw = mem.get(key) ?? null;
      if (raw === null) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback; // dữ liệu hỏng: không làm crash game
      }
    },
    set(key: string, value: unknown): boolean {
      const raw = JSON.stringify(value);
      mem.set(key, raw);
      if (!backend) return false;
      try {
        backend.setItem(key, raw);
        return true;
      } catch {
        markLost(); // đầy bộ nhớ hoặc bị chặn giữa chừng
        return false;
      }
    },
    remove(key: string): void {
      mem.delete(key);
      if (!backend) return;
      try {
        backend.removeItem(key);
      } catch {
        markLost();
      }
    },
    get persistent() {
      return persistent;
    },
    onPersistenceLost(cb: () => void): void {
      if (lostNotified || (!persistent && backend === null)) {
        // Đã mất từ trước (hoặc chưa bao giờ có): báo ngay để UI hiện thông báo.
        lostNotified = true;
        cb();
        return;
      }
      listeners.push(cb);
    },
  };
}
