// Thẻ kết quả của 4 chế độ (VẬN HÀNH, THIẾT KẾ, Chip hôm nay, KIỂM THỬ).
// Chỉ dựng DOM từ dữ liệu + callback; ghi tiến độ, âm thanh, chuyển màn do main.ts làm.
import { debugClaim, designClaim } from '../core/level/ai-info';
import { shortDate } from '../core/level/daily';
import type { DebugLevel, DesignLevel } from '../core/level/types';
import type { PPA } from '../core/scoring/design';
import type { DebugResult } from '../modes/debug/debug-scene';
import type { RuntimeResult } from '../modes/runtime/game';
import { GATE_HINT } from '../modes/runtime/runtime-scene';
import { action, countUp, el, starsEl } from './dom';
import type { MakeShare } from './share-button';

export interface Card {
  card: HTMLDivElement;
  /** nút nhận focus khi thẻ hiện */
  focus: HTMLButtonElement | null;
}

export interface PassResult {
  ppa: PPA;
  par: PPA;
  stars: number;
  score: number;
}

/** Nhận xét kết quả THIẾT KẾ so với AI kỹ sư, nói đúng phạm vi của chữ "tối ưu" (SPEC 5.4). */
export function designVerdict(lv: DesignLevel, score: number): string {
  const c = designClaim(lv);
  if (score > 1000) return c.proven ? 'Bạn tìm ra cách ghép cổng khác tốt hơn — AI chỉ chứng minh tối ưu cho cách ghép của nó!' : 'Bạn thiết kế tốt hơn AI kỹ sư!';
  if (score === 1000) return c.proven ? `Ngang AI kỹ sư. ${c.text}` : `Ngang AI kỹ sư. AI chưa chứng minh được C = ${c.C} là tốt nhất — thử vượt xem!`;
  return `${c.text} Thử tối ưu tiếp?`;
}

function bigScore(value: number, label: string, reducedMotion: boolean, animate = true): HTMLParagraphElement {
  const p = el('p', 'result-score', String(value));
  p.setAttribute('aria-label', label);
  if (animate) countUp(p, value, reducedMotion);
  return p;
}

// ---------------- VẬN HÀNH ----------------
export function runtimeResultCard(
  r: RuntimeResult,
  o: { isRecord: boolean; best: number; share: MakeShare; onAgain: () => void; onHome: () => void },
): Card {
  const card = el('div', 'card');
  const record = o.isRecord && r.score > 0;
  card.append(el('h2', 'result-title', r.mode === 'endless' ? 'Hết mạng!' : 'Hết giờ!'));
  card.append(bigScore(r.score, `Điểm ${r.score}`, true, false));
  card.append(el('p', record ? 'result-record' : 'subtitle', record ? 'Kỷ lục mới!' : `Kỷ lục: ${o.best}`));
  const statsList = el('ul', 'result-stats');
  const li = (k: string, v: string): void => {
    const item = el('li', '');
    item.append(el('span', '', k), el('strong', '', v));
    statsList.append(item);
  };
  li('Độ chính xác', `${Math.round(r.accuracy * 100)}% (${r.correct}/${r.answered})`);
  li('Chuỗi đúng dài nhất', String(r.bestCombo));
  card.append(statsList);
  if (r.weakest) {
    // Giải thích độ khó thích nghi (SPEC 5.4): người chơi biết vì sao game ra nhiều câu loại đó
    card.append(el('p', 'note', `Bạn hay sai cổng ${r.weakest.gate} (${GATE_HINT[r.weakest.gate] ?? ''}) nên game đã ra thêm câu ${r.weakest.gate} để bạn luyện.`));
  }
  const again = action('btn-primary', 'Chơi lại', o.onAgain);
  const modeName = r.mode === 'endless' ? 'Vô tận' : 'Thử thách 60 giây';
  const share = o.share(
    { mode: 'VẬN HÀNH', title: modeName, big: String(r.score), bigLabel: 'điểm', lines: [`Độ chính xác ${Math.round(r.accuracy * 100)}%`, `Chuỗi đúng dài nhất ${r.bestCombo}`], badge: record ? 'Kỷ lục mới!' : undefined },
    `Mình đạt ${r.score} điểm ở chế độ VẬN HÀNH (${modeName}) của CHIP RUSH — game về vi mạch. Ai vượt được không?`,
  );
  card.append(again, share, action('btn-secondary', 'Về màn chính', o.onHome));
  return { card, focus: again };
}

// ---------------- THIẾT KẾ ----------------
function ppaTable(r: PassResult): HTMLTableElement {
  const tbl = el('table', 'ppa-table');
  const tr = (cells: string[], th = false): void => {
    const row = el('tr', '');
    for (const c of cells) row.append(el(th ? 'th' : 'td', '', c));
    tbl.append(row);
  };
  tr(['Chỉ số', 'Bạn', 'AI kỹ sư'], true);
  tr(['Area (ô)', String(r.ppa.A), String(r.par.A)]);
  tr(['Delay (tầng cổng)', String(r.ppa.D), String(r.par.D)]);
  tr(['Power (lần đổi bit)', String(r.ppa.P), String(r.par.P)]);
  tr(['Chi phí C', String(r.ppa.C), String(r.par.C)]);
  return tbl;
}

export function designResultCard(
  lv: DesignLevel,
  r: PassResult,
  o: {
    /** false = đã xem lời giải AI → lần này không tính */
    counted: boolean;
    improved: boolean;
    hinted: boolean;
    reducedMotion: boolean;
    share: MakeShare;
    onNext?: () => void;
    onTune: () => void;
    onShowAi: () => void;
    onList: () => void;
  },
): Card {
  const card = el('div', 'card');
  card.append(el('h2', 'result-title', 'Qua màn!'), starsEl(r.stars, `${r.stars} trên 3 sao`));
  card.append(bigScore(r.score, `Điểm ${r.score}`, o.reducedMotion), el('p', 'note', designVerdict(lv, r.score)), ppaTable(r));
  if (o.improved) card.append(el('p', 'result-record', 'Kết quả tốt nhất của bạn!'));
  if (o.counted && o.hinted) card.append(el('p', 'note', 'Đã dùng gợi ý nên màn này tối đa 2 sao. Chơi lại không gợi ý để lấy đủ 3 sao!'));
  if (!o.counted) card.append(el('p', 'note', 'Bạn đã xem lời giải của AI kỹ sư nên lần này không tính vào kết quả. Tự vẽ lại để ghi sao nhé!'));
  const next = o.onNext ? action('btn-primary', 'Màn tiếp', o.onNext) : null;
  if (next) card.append(next);
  if (o.counted) {
    card.append(
      o.share(
        {
          mode: 'THIẾT KẾ',
          title: `${lv.id.toUpperCase()} · ${lv.name}`,
          big: String(r.score),
          bigLabel: 'điểm (1000 = ngang AI kỹ sư)',
          stars: r.stars,
          lines: [`Chi phí ${r.ppa.C} · AI kỹ sư ${r.par.C}`, `Area ${r.ppa.A} · Delay ${r.ppa.D} · Power ${r.ppa.P}`],
          badge: r.score > 1000 ? 'Vượt AI kỹ sư!' : undefined,
        },
        `Mình thiết kế mạch "${lv.name}" (${lv.id.toUpperCase()}) đạt ${r.score} điểm, ${r.stars} sao trong CHIP RUSH${r.score > 1000 ? ' — vượt cả AI kỹ sư!' : ''}. Bạn thử vượt mình xem:`,
      ),
    );
  }
  card.append(action('', 'Tối ưu tiếp', o.onTune), action('', 'Xem cách AI kỹ sư làm', o.onShowAi), action('btn-secondary', 'Danh sách màn', o.onList));
  return { card, focus: next };
}

// ---------------- Chip hôm nay ----------------
export function dailyResultCard(
  key: string,
  lv: DesignLevel,
  r: PassResult,
  o: {
    counted: boolean;
    /** kết quả ghi chuỗi (null khi không tính) */
    rec: { firstToday: boolean; improved: boolean } | null;
    streak: number;
    hinted: boolean;
    reducedMotion: boolean;
    share: MakeShare;
    onHome: () => void;
    onTune: () => void;
    onShowAi: () => void;
  },
): Card {
  const card = el('div', 'card');
  card.append(el('h2', 'result-title', `Chip ngày ${shortDate(key)} xong!`), starsEl(r.stars, `${r.stars} trên 3 sao`));
  card.append(
    bigScore(r.score, `Điểm ${r.score}`, o.reducedMotion),
    el('p', 'note', `Chi phí ${r.ppa.C} · AI kỹ sư ${r.par.C} (1000 điểm = ngang AI)`),
    el('p', 'note', designVerdict(lv, r.score)),
  );
  if (o.streak > 0) {
    const st = el('p', 'streak', `Chuỗi ${o.streak} ngày`);
    st.setAttribute('aria-label', `Chuỗi ${o.streak} ngày liên tiếp`);
    card.append(st);
  }
  if (o.rec?.firstToday) card.append(el('p', 'note', 'Đề mới lúc 0 giờ (giờ Việt Nam). Quay lại ngày mai để giữ chuỗi!'));
  else if (o.rec?.improved) card.append(el('p', 'result-record', 'Kết quả tốt nhất hôm nay!'));
  if (o.counted && o.hinted) card.append(el('p', 'note', 'Đã dùng gợi ý nên tối đa 2 sao.'));
  if (!o.counted) card.append(el('p', 'note', 'Bạn đã xem lời giải của AI kỹ sư nên lần này không tính.'));
  if (o.counted) {
    const starTxt = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
    card.append(
      o.share(
        { mode: 'CHIP HÔM NAY', title: `Ngày ${shortDate(key)} · ${lv.concept}`, big: String(r.score), bigLabel: 'điểm (1000 = ngang AI kỹ sư)', stars: r.stars, lines: [`Chi phí ${r.ppa.C} · AI kỹ sư ${r.par.C}`, o.streak > 1 ? `Chuỗi ${o.streak} ngày liên tiếp` : 'Mỗi ngày một con chip mới'], badge: r.score > 1000 ? 'Vượt AI kỹ sư!' : undefined },
        `CHIP RUSH · Chip ngày ${shortDate(key)}: ${starTxt} ${r.score} điểm${o.streak > 1 ? ` · chuỗi ${o.streak} ngày` : ''}. Đề hôm nay giống nhau cho mọi người — bạn được bao nhiêu?`,
      ),
    );
  }
  const home = action('btn-primary', 'Về màn chính', o.onHome);
  card.append(home, action('', 'Tối ưu tiếp', o.onTune), action('', 'Xem cách AI kỹ sư làm', o.onShowAi));
  return { card, focus: home };
}

// ---------------- KIỂM THỬ ----------------
export function debugResultCard(
  lv: DebugLevel,
  r: DebugResult,
  o: { improved: boolean; share: MakeShare; onNext?: () => void; onAgain: () => void; onWatchAi: () => void; onList: () => void },
): Card {
  const card = el('div', 'card');
  card.append(el('h2', 'result-title', r.win ? 'Tìm ra lỗi!' : 'Chưa tìm ra lỗi'));
  if (r.win) {
    card.append(starsEl(r.stars, `${r.stars} trên 3 sao`));
    card.append(bigScore(r.probes, `Số lần đo ${r.probes}`, true, false), el('p', 'note', `lần đo · ${debugClaim(lv.id)?.text ?? `AI kỹ sư cần ${r.par} lần`}`));
  } else {
    card.append(el('p', 'note', r.reason ?? ''));
  }
  card.append(el('p', 'note', `Lỗi thật: ${r.answer}.${r.wrong ? ` Bạn đã báo sai ${r.wrong} lần.` : ''}`));
  if (o.improved) card.append(el('p', 'result-record', 'Kết quả tốt nhất của bạn!'));
  const next = r.win && o.onNext ? action('btn-primary', 'Màn tiếp', o.onNext) : null;
  if (next) card.append(next);
  if (r.win) {
    card.append(
      o.share(
        { mode: 'KIỂM THỬ', title: `${lv.id.toUpperCase()} · ${lv.name}`, big: String(r.probes), bigLabel: 'lần đo để tìm ra lỗi', stars: r.stars, lines: [`AI kỹ sư cần ${r.par} lần (trường hợp xấu nhất)`, `Lỗi: ${r.answer}`], badge: r.probes < r.par ? 'Ít hơn AI kỹ sư!' : undefined },
        `Mình tìm ra lỗi chip ở màn ${lv.id.toUpperCase()} "${lv.name}" chỉ với ${r.probes} lần đo (AI kỹ sư cần ${r.par}) trong CHIP RUSH. Thử sức nhé:`,
      ),
    );
  }
  const again = action(r.win ? '' : 'btn-primary', 'Chơi lại', o.onAgain);
  // Minh bạch: xem từng bước AI kỹ sư đo trên chính con chip này
  card.append(again, action('', 'Xem AI kỹ sư đo', o.onWatchAi), action('btn-secondary', 'Danh sách màn', o.onList));
  return { card, focus: next ?? (r.win ? null : again) };
}
