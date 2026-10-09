// Nút "Chia sẻ kết quả": ảnh thẻ được tạo SẴN ngay khi hiện thẻ kết quả (iOS chỉ cho share() trong
// thao tác chạm, không chờ được việc vẽ ảnh). Chưa kịp có ảnh thì vẫn chia sẻ chữ + link.
import { gameUrl, shareResult } from '../platform/share';
import { makeShareFile, type ShareCardData } from '../render/share-card';
import { button } from './dom';

export type ShareData = Omit<ShareCardData, 'url'>;
export type MakeShare = (data: ShareData, text: string) => HTMLButtonElement;

export function createShareButtonFactory(toast: (msg: string) => void): MakeShare {
  return (data, text) => {
    const b = button('btn-share', 'Chia sẻ kết quả');
    let file: File | null = null;
    void makeShareFile({ ...data, url: gameUrl() }).then((f) => (file = f));
    b.addEventListener('click', () => {
      void shareResult({ title: 'CHIP RUSH', text, url: gameUrl(), file }).then((out) => {
        if (out === 'copied') toast('Đã sao chép lời mời kèm link — dán vào Zalo/Messenger nhé!');
        else if (out === 'unavailable') window.prompt('Sao chép lời mời này để gửi bạn bè:', `${text} ${gameUrl()}`);
      });
    });
    return b;
  };
}
