// Bắt mọi lỗi runtime chưa xử lý → hiện màn hình "Có lỗi xảy ra" thay vì màn trắng.
// Game nộp xong khó hotfix nhanh, nên lỗi phải lộ ra rõ ràng và có mã để người chơi gửi lại.

export interface ErrorReport {
  /** Mã ngắn, ổn định cho cùng một lỗi, ví dụ "E-3F9A2C". */
  code: string;
  message: string;
  version: string;
  time: string;
}

/** Băm FNV-1a 32 bit → 6 ký tự hex. Cùng thông điệp + dòng đầu stack → cùng mã. */
export function makeErrorCode(message: string, stack = ''): string {
  const firstFrame = stack.split('\n').find((l) => l.includes('at ') || l.includes('@')) ?? '';
  const s = `${message}|${firstFrame.trim()}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `E-${(h >>> 8).toString(16).toUpperCase().padStart(6, '0')}`;
}

export function toReport(err: unknown, version: string, now: Date = new Date()): ErrorReport {
  const e = err instanceof Error ? err : new Error(String(err));
  return { code: makeErrorCode(e.message, e.stack), message: e.message, version, time: now.toISOString() };
}

interface ErrorSource {
  addEventListener(type: 'error' | 'unhandledrejection', cb: (ev: Event) => void): void;
  removeEventListener(type: 'error' | 'unhandledrejection', cb: (ev: Event) => void): void;
}

/** Cài bộ bắt lỗi toàn cục. Chỉ báo lỗi ĐẦU TIÊN (lỗi sau thường là hệ quả). Trả về hàm gỡ. */
export function installGlobalErrorHandlers(win: ErrorSource, version: string, onFatal: (r: ErrorReport) => void): () => void {
  let reported = false;
  const report = (err: unknown): void => {
    if (reported) return;
    reported = true;
    onFatal(toReport(err, version));
  };
  const onError = (ev: Event): void => {
    const e = ev as ErrorEvent;
    // Lỗi tải tài nguyên (ảnh/font) cũng bắn 'error' nhưng không có `error` — không coi là lỗi chết.
    if (e.error === undefined && !e.message) return;
    report(e.error ?? new Error(e.message));
  };
  const onRejection = (ev: Event): void => report((ev as PromiseRejectionEvent).reason);
  win.addEventListener('error', onError);
  win.addEventListener('unhandledrejection', onRejection);
  return () => {
    win.removeEventListener('error', onError);
    win.removeEventListener('unhandledrejection', onRejection);
  };
}

/** Màn hình lỗi (DOM). Không dùng innerHTML với nội dung lỗi để tránh chèn mã. */
export function showErrorScreen(root: HTMLElement, r: ErrorReport): void {
  const box = document.createElement('div');
  box.className = 'error-screen';
  box.setAttribute('role', 'alertdialog');
  box.setAttribute('aria-live', 'assertive');

  const h = document.createElement('h2');
  h.textContent = 'Có lỗi xảy ra';
  const p = document.createElement('p');
  p.textContent = 'Game gặp lỗi và phải dừng. Tải lại thường sẽ khắc phục được. Nếu lỗi lặp lại, gửi mã lỗi dưới đây cho nhóm phát triển.';
  const code = document.createElement('code');
  code.textContent = `${r.code} · ${r.version}`;

  const reload = document.createElement('button');
  reload.className = 'btn';
  reload.type = 'button';
  reload.textContent = 'Tải lại';
  reload.addEventListener('click', () => location.reload());

  const copy = document.createElement('button');
  copy.className = 'btn btn-secondary';
  copy.type = 'button';
  copy.textContent = 'Sao chép mã lỗi';
  copy.addEventListener('click', () => {
    const text = `${r.code} | ${r.version} | ${r.time} | ${r.message}`;
    navigator.clipboard?.writeText(text).then(
      () => (copy.textContent = 'Đã sao chép'),
      () => (copy.textContent = text), // không có clipboard: hiện để người chơi tự chép
    );
  });

  box.append(h, p, code, reload, copy);
  root.replaceChildren(box);
}
