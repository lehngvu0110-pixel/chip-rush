// Chia sẻ kết quả, có đường lùi cho mọi trình duyệt:
//  1) Web Share kèm ẢNH (điện thoại hiện bảng chia sẻ: Zalo, Messenger, Instagram...)
//  2) Web Share chỉ chữ + link
//  3) sao chép lời mời vào bộ nhớ tạm
//  4) không gì dùng được → trả 'unavailable' để giao diện hiện chữ cho người chơi tự chép
// Lưu ý iOS: share() phải gọi NGAY trong thao tác chạm, nên ảnh phải tạo SẴN trước khi người chơi bấm.

export interface ShareNav {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboard?: { writeText(text: string): Promise<void> };
}

export type ShareOutcome = 'shared' | 'shared-text' | 'copied' | 'cancelled' | 'unavailable';

export interface ShareInput {
  title: string;
  text: string;
  url: string;
  file?: File | null;
}

const isAbort = (e: unknown): boolean => typeof e === 'object' && e !== null && (e as { name?: string }).name === 'AbortError';

export async function shareResult(p: ShareInput, nav: ShareNav = globalThis.navigator as unknown as ShareNav): Promise<ShareOutcome> {
  if (p.file && nav?.share && nav.canShare?.({ files: [p.file] })) {
    try {
      await nav.share({ title: p.title, text: `${p.text} ${p.url}`, files: [p.file] });
      return 'shared';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
      // trình duyệt từ chối chia sẻ ảnh → thử chỉ chữ
    }
  }
  if (nav?.share) {
    try {
      await nav.share({ title: p.title, text: p.text, url: p.url });
      return 'shared-text';
    } catch (e) {
      if (isAbort(e)) return 'cancelled';
    }
  }
  if (nav?.clipboard?.writeText) {
    try {
      await nav.clipboard.writeText(`${p.text} ${p.url}`);
      return 'copied';
    } catch {
      /* trang không có quyền ghi bộ nhớ tạm */
    }
  }
  return 'unavailable';
}

/** Link chơi game (bỏ ?e2e, ?debug, ?seed... để người nhận mở bản bình thường). */
export function gameUrl(loc: { origin: string; pathname: string } = globalThis.location): string {
  return `${loc.origin}${loc.pathname}`;
}
