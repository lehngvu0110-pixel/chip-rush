// Góc học tập: trắc nghiệm điện - điện tử (dữ liệu + logic thuần, test được).
// Câu soạn sẵn ghi đáp án đúng ở vị trí đầu cho dễ soát; khi ra đề, thứ tự phương án được xáo lại.
// Câu tính toán (Ohm, công suất, vạch màu, nhị phân...) sinh ngẫu nhiên có seed, nên mỗi lần chơi một đề khác
// nhưng test vẫn tái lập được; lời giải ghi đủ phép tính.
import { resistorBands, resistorDigits } from '../parts/catalog';
import { createRng, pick, randInt, type Rng } from '../util/rng';

export type QuizTopic = 'basic' | 'parts' | 'semi' | 'digital';
export const TOPIC_NAME: Record<QuizTopic, string> = {
  basic: 'Điện cơ bản',
  parts: 'Linh kiện thụ động',
  semi: 'Bán dẫn',
  digital: 'Số và vi mạch',
};

export interface QuizQuestion {
  id: string;
  topic: QuizTopic;
  q: string;
  options: string[];
  /** chỉ số phương án đúng trong `options` */
  answer: number;
  explain: string;
}

/** Câu soạn sẵn: opts[0] là đáp án đúng. */
interface Authored {
  id: string;
  topic: QuizTopic;
  q: string;
  opts: [string, string, string, string];
  explain: string;
}

const AUTHORED: Authored[] = [
  // ---- Điện cơ bản ----
  { id: 'b-unit-r', topic: 'basic', q: 'Đơn vị đo điện trở là gì?', opts: ['Ohm (Ω)', 'Vôn (V)', 'Ampe (A)', 'Oát (W)'], explain: 'Điện trở đo bằng ohm. Vôn đo điện áp, ampe đo dòng điện, oát đo công suất.' },
  { id: 'b-ammeter', topic: 'basic', q: 'Muốn đo dòng điện qua một bóng đèn, ampe kế phải mắc thế nào?', opts: ['Nối tiếp với bóng đèn', 'Song song với bóng đèn', 'Song song với nguồn', 'Không cần nối vào mạch'], explain: 'Dòng điện phải chạy qua ampe kế nên nó mắc nối tiếp. Vôn kế thì ngược lại, mắc song song.' },
  { id: 'b-series', topic: 'basic', q: 'Hai điện trở 100 Ω mắc nối tiếp. Điện trở tương đương là?', opts: ['200 Ω', '50 Ω', '100 Ω', '10 kΩ'], explain: 'Nối tiếp thì cộng: 100 + 100 = 200 Ω.' },
  { id: 'b-parallel', topic: 'basic', q: 'Hai điện trở 100 Ω mắc song song. Điện trở tương đương là?', opts: ['50 Ω', '200 Ω', '100 Ω', '0 Ω'], explain: '1/R = 1/100 + 1/100 = 2/100 nên R = 50 Ω. Song song luôn nhỏ hơn điện trở nhỏ nhất.' },
  { id: 'b-kcl', topic: 'basic', q: 'Định luật Kirchhoff về dòng điện (KCL) phát biểu rằng:', opts: ['Tổng dòng vào một nút bằng tổng dòng ra', 'Tổng điện áp quanh một vòng kín bằng 0', 'U = I · R', 'P = U · I'], explain: 'KCL nói về dòng tại một nút (điện tích không mất đi). Câu "tổng điện áp quanh vòng bằng 0" là KVL.' },
  { id: 'b-kvl', topic: 'basic', q: 'Pin 9 V nối một điện trở và một LED (sụt 2 V). Điện áp trên điện trở là?', opts: ['7 V', '9 V', '2 V', '11 V'], explain: 'Theo KVL, điện áp nguồn chia cho các phần tử nối tiếp: 9 − 2 = 7 V đặt lên điện trở.' },
  { id: 'b-short', topic: 'basic', q: '"Chập mạch" (đoản mạch) là gì?', opts: ['Hai điểm khác điện áp bị nối bằng đường gần như không có điện trở, dòng tăng vọt', 'Mạch bị đứt, không có dòng', 'Điện trở trong mạch quá lớn', 'Pin đã hết điện'], explain: 'Khi chập, R gần bằng 0 nên I = U / R rất lớn, có thể làm nóng dây, cháy nguồn.' },
  { id: 'b-acdc', topic: 'basic', q: 'Điểm khác nhau chính giữa điện một chiều (DC) và xoay chiều (AC)?', opts: ['DC không đổi chiều, AC đổi chiều theo chu kỳ', 'DC luôn mạnh hơn AC', 'AC chỉ có trong pin', 'DC chỉ dùng cho động cơ'], explain: 'Pin cho dòng DC. Điện lưới Việt Nam là AC 50 Hz: 50 chu kỳ mỗi giây, mỗi chu kỳ dòng đổi chiều 2 lần, nên đổi chiều 100 lần mỗi giây.' },
  { id: 'b-grid', topic: 'basic', q: 'Điện lưới sinh hoạt ở Việt Nam có thông số danh định nào?', opts: ['220 V, 50 Hz', '110 V, 60 Hz', '12 V, một chiều', '5 V, một chiều'], explain: 'Việt Nam dùng điện lưới 220 V, 50 Hz. Một số nước như Mỹ dùng 120 V, 60 Hz.' },
  { id: 'b-khz', topic: 'basic', q: 'Tín hiệu có tần số 1 kHz lặp lại bao nhiêu lần mỗi giây?', opts: ['1000 lần', '1 lần', '100 lần', '1 000 000 lần'], explain: 'Tiền tố k (kilo) = 1000. Chu kỳ T = 1 / f = 1 ms.' },
  // ---- Linh kiện thụ động ----
  { id: 'p-dc-block', topic: 'parts', q: 'Khi đã nạp đầy, tụ điện chặn loại dòng nào?', opts: ['Dòng một chiều (DC)', 'Dòng xoay chiều tần số cao', 'Mọi loại dòng', 'Không chặn loại nào'], explain: 'Tụ đầy thì không còn dòng DC đi qua; tín hiệu xoay chiều vẫn qua được, tần số càng cao càng dễ qua.' },
  { id: 'p-104', topic: 'parts', q: 'Tụ gốm in mã "104" có điện dung bao nhiêu?', opts: ['100 nF', '104 pF', '10 nF', '1 µF'], explain: 'Hai số đầu là giá trị, số thứ ba là số chữ số 0, đơn vị pF: 10 và 0000 = 100 000 pF = 100 nF.' },
  { id: 'p-tau', topic: 'parts', q: 'Mạch RC có R = 1 kΩ, C = 1000 µF. Hằng số thời gian τ là?', opts: ['1 giây', '1 mili giây', '1000 giây', '0,1 giây'], explain: 'τ = R · C = 1000 Ω × 0,001 F = 1 s. Sau 1 τ, tụ nạp được khoảng 63%.' },
  { id: 'p-stripe', topic: 'parts', q: 'Vạch sọc in trên vỏ tụ hoá chỉ chân nào?', opts: ['Cực âm (−)', 'Cực dương (+)', 'Chân nối đất vỏ', 'Không có ý nghĩa'], explain: 'Vạch sọc là cực âm; chân dài hơn là cực dương. Cắm ngược tụ hoá có thể phồng hoặc nổ.' },
  { id: 'p-inductor', topic: 'parts', q: 'Cuộn cảm chống lại điều gì?', opts: ['Sự thay đổi đột ngột của dòng điện', 'Sự thay đổi đột ngột của điện áp', 'Nhiệt độ tăng', 'Ánh sáng chiếu vào'], explain: 'U = L · dI/dt: dòng đổi càng nhanh, cuộn cảm sinh điện áp chống lại càng lớn. Tụ điện mới là linh kiện "giữ" điện áp.' },
  { id: 'p-cap-par', topic: 'parts', q: 'Hai tụ 10 µF mắc song song cho điện dung tương đương là?', opts: ['20 µF', '5 µF', '10 µF', '100 µF'], explain: 'Tụ song song thì cộng điện dung (ngược với điện trở). Tụ nối tiếp mới giảm điện dung.' },
  { id: 'p-watt', topic: 'parts', q: 'Đặt 10 V lên điện trở 100 Ω loại 1/4 W. Điều gì xảy ra?', opts: ['Quá công suất (1 W), điện trở nóng và có thể cháy', 'An toàn vì chỉ 0,1 W', 'Điện trở không có dòng', 'Điện áp giảm còn 2,5 V'], explain: 'P = U² / R = 100 / 100 = 1 W, gấp 4 lần định mức 0,25 W.' },
  { id: 'p-pullup', topic: 'parts', q: 'Điện trở kéo lên (pull-up) ở chân đầu vào của vi điều khiển dùng để làm gì?', opts: ['Giữ chân ở mức 1 khi không có tín hiệu, tránh "lơ lửng"', 'Tăng tốc độ xử lý', 'Bảo vệ chống sét', 'Tạo xung clock'], explain: 'Đầu vào CMOS để hở sẽ nhận nhiễu ngẫu nhiên. Pull-up giữ mức 1; ấn nút nối xuống đất thì thành 0.' },
  // ---- Bán dẫn ----
  { id: 's-vf', topic: 'semi', q: 'Diode silicon bắt đầu dẫn khi điện áp thuận khoảng bao nhiêu?', opts: ['0,6-0,7 V', '5 V', '0 V', '12 V'], explain: 'Tiếp giáp P-N của silicon cần khoảng 0,6-0,7 V để dẫn rõ. LED cần cao hơn: đỏ khoảng 2 V, xanh dương khoảng 3 V.' },
  { id: 's-led-leg', topic: 'semi', q: 'Chân dài của LED là cực nào?', opts: ['Anode (+)', 'Cathode (−)', 'Chân nối đất', 'Hai chân như nhau'], explain: 'Chân dài là anode (+); mép vát ở vành đáy LED là phía cathode (−).' },
  { id: 's-led-r', topic: 'semi', q: 'Vì sao LED luôn cần một điện trở mắc nối tiếp?', opts: ['Để giới hạn dòng điện, tránh cháy LED', 'Để LED đổi màu', 'Để LED sáng nháy', 'Vì LED không dẫn điện'], explain: 'Khi đã dẫn, LED gần như không tự hạn chế dòng; thiếu điện trở thì dòng vượt vài chục mA và LED cháy.' },
  { id: 's-bjt', topic: 'semi', q: 'Transistor BJT loại NPN được điều khiển bằng gì?', opts: ['Dòng điện chạy vào chân base', 'Điện áp ở cổng G, gần như không tốn dòng', 'Ánh sáng chiếu vào', 'Từ trường'], explain: 'BJT khuếch đại dòng: I C = β · I B. Điều khiển bằng điện áp, gần như không tốn dòng là MOSFET.' },
  { id: 's-mos', topic: 'semi', q: 'MOSFET kênh N (tăng cường) dẫn điện khi nào?', opts: ['Khi U GS lớn hơn điện áp ngưỡng', 'Khi chân D nối đất', 'Khi dòng vào cổng G đủ lớn', 'Khi nhiệt độ tăng'], explain: 'Điện áp cổng tạo điện trường mở kênh dẫn giữa D và S; cổng cách điện nên không có dòng tĩnh.' },
  { id: 's-doping', topic: 'semi', q: 'Pha phospho (5 electron hoá trị) vào silicon tạo ra bán dẫn loại gì?', opts: ['Loại N', 'Loại P', 'Chất cách điện', 'Kim loại'], explain: 'Phospho dư 1 electron nên tạo loại N. Pha bo (3 electron hoá trị) tạo loại P.' },
  { id: 's-not', topic: 'semi', q: 'Một cổng NOT công nghệ CMOS cần bao nhiêu transistor?', opts: ['2', '1', '4', '6'], explain: '1 MOSFET kênh P nối lên nguồn và 1 MOSFET kênh N nối xuống đất. NAND hoặc NOR 2 đầu vào cần 4.' },
  { id: 's-esd', topic: 'semi', q: 'Vì sao mỗi chân chip đều có diode bảo vệ chống tĩnh điện (ESD)?', opts: ['Tĩnh điện vài nghìn vôn có thể phá lớp cách điện cổng transistor rất mỏng', 'Để chip sáng hơn', 'Để tăng tần số clock', 'Để tiết kiệm điện'], explain: 'Lớp oxit cổng chỉ dày vài nanomet; diode ESD dẫn xung tĩnh điện xuống nguồn hoặc đất trước khi nó tới transistor.' },
  // ---- Số và vi mạch ----
  { id: 'd-xor', topic: 'digital', q: 'Cổng nào cho đầu ra 1 khi hai đầu vào KHÁC nhau?', opts: ['XOR', 'AND', 'OR', 'NAND'], explain: 'XOR (hoặc loại trừ): 0 XOR 1 = 1 XOR 0 = 1, còn 0 XOR 0 = 1 XOR 1 = 0. Bộ cộng nhị phân dùng XOR để tính bit tổng.' },
  { id: 'd-nand', topic: 'digital', q: 'Vì sao NAND được gọi là cổng "vạn năng"?', opts: ['Chỉ dùng NAND có thể ghép ra mọi hàm logic khác', 'NAND chạy nhanh nhất', 'NAND không tốn điện', 'NAND có nhiều đầu vào nhất'], explain: 'NOT = NAND hai đầu vào nối chung; AND = NAND rồi NOT; OR ghép từ 3 NAND. NOR cũng vạn năng.' },
  { id: 'd-ppa', topic: 'digital', q: 'PPA trong thiết kế chip là viết tắt của:', opts: ['Power, Performance, Area', 'Pin, Package, Assembly', 'Program, Process, Array', 'Power, Pin, Antenna'], explain: 'Điện năng, hiệu năng (tốc độ) và diện tích: ba thứ kỹ sư phải cân bằng, như chỉ số chi phí ở màn THIẾT KẾ.' },
  { id: 'd-ff', topic: 'digital', q: 'Flip-flop trong chip dùng để làm gì?', opts: ['Lưu 1 bit và đổi trạng thái theo nhịp clock', 'Khuếch đại âm thanh', 'Chuyển AC thành DC', 'Đo nhiệt độ'], explain: 'Flip-flop là ô nhớ 1 bit đồng bộ; thanh ghi, bộ đếm, bộ nhớ đệm đều ghép từ chúng.' },
  { id: 'd-decouple', topic: 'digital', q: 'Vì sao đặt tụ 100 nF sát chân nguồn của mỗi IC?', opts: ['Cấp dòng tức thời khi cổng chuyển mạch, giảm nhiễu nguồn', 'Để IC chạy chậm lại', 'Để chống cắm ngược nguồn', 'Để tạo xung clock'], explain: 'Mỗi lần hàng loạt cổng đổi trạng thái, IC cần dòng đột ngột; tụ decoupling ở gần cấp dòng đó trước khi nguồn kịp phản ứng.' },
  { id: 'd-moore', topic: 'digital', q: 'Định luật Moore dự đoán điều gì?', opts: ['Số transistor trên chip tăng gấp đôi khoảng mỗi 2 năm', 'Tốc độ ánh sáng trong dây đồng', 'Điện trở tăng theo nhiệt độ', 'Pin dùng lâu gấp đôi mỗi năm'], explain: 'Gordon Moore đưa ra năm 1965 và chỉnh lại năm 1975; đây là quan sát xu hướng công nghiệp, không phải định luật vật lý.' },
  { id: 'd-wafer', topic: 'digital', q: '"Wafer" trong sản xuất chip là gì?', opts: ['Lát silicon tròn, mỏng, trên đó chế tạo hàng trăm chip cùng lúc', 'Vỏ nhựa bọc chip', 'Dây vàng nối chip ra chân', 'Bo mạch in'], explain: 'Wafer phổ biến có đường kính 300 mm; sau khi chế tạo được cắt thành từng die rồi đóng gói.' },
];

// ---------------- định dạng số kiểu Việt Nam ----------------
/** 3 chữ số có nghĩa, dấu phẩy thập phân, bỏ số 0 thừa. */
export function vn(x: number): string {
  const r = Number(x.toPrecision(3));
  return String(r).replace('.', ',');
}
const ohm = (r: number): string => (r >= 1e6 ? `${vn(r / 1e6)} MΩ` : r >= 1e3 ? `${vn(r / 1e3)} kΩ` : `${vn(r)} Ω`);

/**
 * Đáp án + 3 phương án sai, khử trùng theo GIÁ TRỊ hiển thị (sau khi làm tròn, đổi đơn vị):
 * "500 Ω" và "0,5 kΩ" không thể cùng xuất hiện. Thiếu phương án thì lấy thêm từ `fallback` (bội số của đáp án),
 * không bao giờ ghép chữ kiểu "500 Ω × 2" (báo lỗi 26/10: phương án đó trùng giá trị với phương án khác).
 */
function numOpts(correct: number, fmt: (x: number) => string, candidates: number[], fallback = [2, 0.5, 3, 1.5, 10, 0.1, 4]): [string, string, string, string] {
  const out = [fmt(correct)];
  const add = (x: number): void => {
    if (out.length < 4 && Number.isFinite(x) && x > 0 && !out.includes(fmt(x))) out.push(fmt(x));
  };
  candidates.forEach(add);
  fallback.forEach((k) => add(correct * k));
  if (out.length < 4) throw new Error(`numOpts: không đủ phương án cho ${fmt(correct)}`);
  return out as [string, string, string, string];
}

// ---------------- câu tính toán sinh ngẫu nhiên ----------------
interface Generator {
  id: string;
  topic: QuizTopic;
  make: (rng: Rng) => Authored;
}

const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
const GATES = ['AND', 'OR', 'XOR', 'NAND', 'NOR'] as const;
const gateOut = (g: (typeof GATES)[number], a: number, b: number): number =>
  g === 'AND' ? a & b : g === 'OR' ? a | b : g === 'XOR' ? a ^ b : g === 'NAND' ? 1 - (a & b) : 1 - (a | b);
const GATE_RULE: Record<(typeof GATES)[number], string> = {
  AND: 'AND ra 1 chỉ khi cả hai đầu vào là 1',
  OR: 'OR ra 1 khi có ít nhất một đầu vào là 1',
  XOR: 'XOR ra 1 khi hai đầu vào khác nhau',
  NAND: 'NAND là AND rồi đảo: ra 0 chỉ khi cả hai đầu vào là 1',
  NOR: 'NOR là OR rồi đảo: ra 1 chỉ khi cả hai đầu vào là 0',
};

export const GENERATORS: Generator[] = [
  {
    id: 'g-ohm',
    topic: 'basic',
    make: (rng) => {
      const U = pick(rng, [5, 9, 12, 24]);
      const R = pick(rng, [220, 330, 470, 1000, 2200]);
      const I = (U / R) * 1000;
      return {
        id: 'g-ohm',
        topic: 'basic',
        q: `Đặt ${U} V lên điện trở ${ohm(R)}. Dòng điện qua điện trở là bao nhiêu?`,
        opts: numOpts(I, (x) => `${vn(x)} mA`, [I * 10, I / 10, I * 2, I / 2]),
        explain: `Định luật Ohm: I = U / R = ${U} V / ${R} Ω = ${vn(I / 1000)} A = ${vn(I)} mA.`,
      };
    },
  },
  {
    id: 'g-power',
    topic: 'basic',
    make: (rng) => {
      const U = pick(rng, [5, 12, 24]);
      const I = pick(rng, [0.1, 0.25, 0.5, 2]);
      const P = U * I;
      return {
        id: 'g-power',
        topic: 'basic',
        q: `Một thiết bị dùng ${U} V và tiêu thụ ${vn(I)} A. Công suất của nó là?`,
        opts: numOpts(P, (x) => `${vn(x)} W`, [U / I, P * 2, P / 2, U + I]),
        explain: `P = U · I = ${U} × ${vn(I)} = ${vn(P)} W.`,
      };
    },
  },
  {
    id: 'g-network',
    topic: 'basic',
    make: (rng) => {
      const a = pick(rng, [100, 220, 470, 1000]);
      const b = pick(rng, [100, 220, 470, 1000, 2200]);
      const par = rng() < 0.5;
      const ser = a + b;
      const pr = (a * b) / (a + b);
      return {
        id: 'g-network',
        topic: 'basic',
        q: `Hai điện trở ${ohm(a)} và ${ohm(b)} mắc ${par ? 'song song' : 'nối tiếp'}. Điện trở tương đương là?`,
        opts: numOpts(par ? pr : ser, ohm, [par ? ser : pr, Math.abs(a - b), (a + b) / 2, a * 2, b * 2]),
        explain: par ? `Song song: R = R1·R2 / (R1 + R2) = ${a}·${b} / ${a + b} ≈ ${vn(pr)} Ω.` : `Nối tiếp: R = R1 + R2 = ${a} + ${b} = ${ser} Ω.`,
      };
    },
  },
  {
    id: 'g-led-r',
    topic: 'semi',
    make: (rng) => {
      const U = pick(rng, [5, 9, 12]);
      const mA = pick(rng, [10, 15, 20]);
      const R = (U - 2) / (mA / 1000);
      return {
        id: 'g-led-r',
        topic: 'semi',
        q: `Nguồn ${U} V, LED đỏ sụt 2 V, muốn dòng ${mA} mA. Cần điện trở hạn dòng bao nhiêu?`,
        opts: numOpts(R, ohm, [U / (mA / 1000), (U + 2) / (mA / 1000), R / 10, R * 10]),
        explain: `R = (U nguồn − U LED) / I = (${U} − 2) / ${vn(mA / 1000)} A ≈ ${ohm(R)}. Ngoài đời chọn giá trị tiêu chuẩn gần nhất, lớn hơn một chút cho an toàn.`,
      };
    },
  },
  {
    id: 'g-bands',
    topic: 'parts',
    make: (rng) => {
      // chỉ chọn giá trị mà cả đáp án lẫn phương án nhiễu đều viết được bằng 4 vạch
      for (;;) {
        const v = pick(rng, E12) * 10 ** randInt(rng, 5);
        const bands = resistorBands(v);
        const d = resistorDigits(v);
        if (!bands || !d) continue;
        const swapped = (d[1] * 10 + d[0]) * 10 ** d[2];
        return {
          id: 'g-bands',
          topic: 'parts',
          q: `Điện trở 4 vạch: ${bands.map((b) => b.name).join(' · ')}. Giá trị của nó là?`,
          opts: numOpts(v, ohm, [v * 10, v / 10, swapped, v * 100]),
          explain: `Vạch 1 (${bands[0]!.name}) = ${d[0]}, vạch 2 (${bands[1]!.name}) = ${d[1]}, vạch 3 (${bands[2]!.name}) = nhân 10 mũ ${d[2]}: ${d[0]}${d[1]} × ${10 ** d[2]} = ${ohm(v)}. Vạch nhũ vàng là sai số ±5%.`,
        };
      }
    },
  },
  {
    id: 'g-binary',
    topic: 'digital',
    make: (rng) => {
      const n = 3 + randInt(rng, 13);
      const bits = n.toString(2).padStart(4, '0');
      const rev = parseInt([...bits].reverse().join(''), 2);
      return {
        id: 'g-binary',
        topic: 'digital',
        q: `Số nhị phân ${bits} bằng bao nhiêu trong hệ thập phân?`,
        opts: numOpts(n, String, [rev, n + 1, n - 1, n + 2], [n + 3, n + 4, n - 2]),
        explain: `${[...bits].map((b, i) => `${b}×${2 ** (3 - i)}`).join(' + ')} = ${n}.`,
      };
    },
  },
  {
    id: 'g-gate',
    topic: 'digital',
    make: (rng) => {
      const g = pick(rng, GATES);
      const a = randInt(rng, 2);
      const b = randInt(rng, 2);
      const y = gateOut(g, a, b);
      return {
        id: 'g-gate',
        topic: 'digital',
        q: `Cổng ${g} có A = ${a}, B = ${b}. Đầu ra Y bằng?`,
        // chỉ có 2 phương án thật; 2 phương án còn lại là cách hiểu sai hay gặp
        opts: [String(y), String(1 - y), 'Không xác định', 'Bằng A + B'],
        explain: `${GATE_RULE[g]}, nên Y = ${y}.`,
      };
    },
  },
];

// ---------------- ra đề ----------------
function shuffle<T>(rng: Rng, a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = randInt(rng, i + 1);
    [r[i], r[j]] = [r[j]!, r[i]!];
  }
  return r;
}

function finalize(rng: Rng, a: Authored): QuizQuestion {
  const order = shuffle(rng, [0, 1, 2, 3]);
  return { id: a.id, topic: a.topic, q: a.q, options: order.map((k) => a.opts[k]!), answer: order.indexOf(0), explain: a.explain };
}

/** Mọi câu soạn sẵn (đáp án ở vị trí 0, chưa xáo) để soát nội dung. */
export const AUTHORED_QUESTIONS: readonly Authored[] = AUTHORED;

/**
 * Ra đề n câu: khoảng 60% câu soạn sẵn (không lặp), còn lại là câu tính toán sinh ngẫu nhiên.
 * `topic = 'all'` trộn mọi chủ đề.
 */
export function makeQuiz(seed: number, topic: QuizTopic | 'all' = 'all', n = 10): QuizQuestion[] {
  const rng = createRng(seed);
  const pool = AUTHORED.filter((q) => topic === 'all' || q.topic === topic);
  const gens = GENERATORS.filter((g) => topic === 'all' || g.topic === topic);
  const nStatic = Math.min(pool.length, gens.length ? Math.round(n * 0.6) : n);
  const chosen: Authored[] = shuffle(rng, pool).slice(0, nStatic);
  // câu sinh: xoay vòng các bộ sinh để đề đa dạng
  const g = shuffle(rng, gens);
  for (let i = 0; chosen.length < n && g.length; i++) chosen.push(g[i % g.length]!.make(rng));
  return shuffle(rng, chosen).map((a) => finalize(rng, a));
}

/** Sao theo tỉ lệ đúng: ≥ 90% 3 sao, ≥ 70% 2 sao, ≥ 50% 1 sao. */
export function quizStars(correct: number, total: number): number {
  const r = total ? correct / total : 0;
  return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.5 ? 1 : 0;
}
