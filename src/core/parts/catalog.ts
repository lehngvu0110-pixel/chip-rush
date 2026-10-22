// Thư viện linh kiện điện tử: dữ liệu thuần (không DOM) cho bảng "Linh kiện điện tử" ở màn chính.
// Mỗi linh kiện có công dụng, thông số của mẫu đang xem, cách nhận biết và mục "Liên hệ với vi mạch"
// nối kiến thức linh kiện rời với các khái niệm trong game (PPA, cổng logic, đóng gói chip).
// Số liệu lấy theo datasheet phổ biến của từng mã; chỗ nào thay đổi theo hãng thì ghi rõ "xem datasheet".

export type PartId = 'resistor' | 'ceramic-cap' | 'electrolytic' | 'inductor' | 'diode' | 'led' | 'bjt' | 'mosfet' | 'ic555' | 'crystal' | 'button';

export interface Part {
  id: PartId;
  name: string;
  /** tên tiếng Anh (thuật ngữ khi đọc datasheet) */
  en: string;
  /** chữ ký hiệu trên sơ đồ mạch (R1, C2, Q3...) */
  letter: string;
  /** một dòng ở danh sách */
  short: string;
  /** mẫu cụ thể đang hiện ở mô hình 3D */
  sample: string;
  summary: string;
  specs: [string, string][];
  tips: string[];
  /** liên hệ với thiết kế vi mạch và với game */
  chip: string;
}

// ---------------- Mã vạch màu điện trở ----------------
export interface BandColor {
  name: string;
  hex: string;
}

/** Màu cho chữ số 0-9 (chuẩn IEC 60062). */
export const DIGIT_COLORS: readonly BandColor[] = [
  { name: 'Đen', hex: '#1a1a1e' },
  { name: 'Nâu', hex: '#7a4524' },
  { name: 'Đỏ', hex: '#d42a2a' },
  { name: 'Cam', hex: '#f07a1c' },
  { name: 'Vàng', hex: '#f2cf0a' },
  { name: 'Lục', hex: '#2c9a46' },
  { name: 'Lam', hex: '#2f5fd0' },
  { name: 'Tím', hex: '#8a44b0' },
  { name: 'Xám', hex: '#8c8c8c' },
  { name: 'Trắng', hex: '#f2f2f2' },
];
export const GOLD: BandColor = { name: 'Nhũ vàng', hex: '#c9a227' };
export const SILVER: BandColor = { name: 'Nhũ bạc', hex: '#c4c8ce' };

/** Màu vạch hệ số nhân 10^e (e = -2..9). */
export function multiplierColor(e: number): BandColor | null {
  if (e === -1) return GOLD;
  if (e === -2) return SILVER;
  return Number.isInteger(e) && e >= 0 && e <= 9 ? DIGIT_COLORS[e]! : null;
}

/**
 * 3 vạch đầu của điện trở 4 vạch: 2 chữ số có nghĩa + hệ số nhân, ví dụ 4700 Ω → [4, 7, 2] (Vàng Tím Đỏ).
 * Giá trị phải viết được đúng bằng 2 chữ số (dãy E12/E24 đều thoả); không được thì trả null.
 */
export function resistorDigits(ohms: number): [number, number, number] | null {
  if (!Number.isFinite(ohms) || ohms <= 0) return null;
  let e = Math.floor(Math.log10(ohms)) - 1;
  let n = Math.round(ohms / 10 ** e);
  if (n >= 100) {
    // làm tròn đẩy lên 3 chữ số (ví dụ 99,96)
    e += 1;
    n = Math.round(ohms / 10 ** e);
  }
  if (e < -2 || e > 9) return null;
  if (Math.abs(n * 10 ** e - ohms) > ohms * 1e-9) return null;
  return [Math.floor(n / 10), n % 10, e];
}

/** 4 vạch màu (vạch thứ 4: sai số ±5% = nhũ vàng, ±10% = nhũ bạc). */
export function resistorBands(ohms: number, tolerance: 5 | 10 = 5): BandColor[] | null {
  const d = resistorDigits(ohms);
  if (!d) return null;
  const m = multiplierColor(d[2]);
  if (!m) return null;
  return [DIGIT_COLORS[d[0]]!, DIGIT_COLORS[d[1]]!, m, tolerance === 5 ? GOLD : SILVER];
}

/** "4,7 kΩ", "220 Ω", "1 MΩ" (dấu phẩy thập phân kiểu Việt Nam). */
export function formatOhms(ohms: number): string {
  const [v, unit] = ohms >= 1e6 ? [ohms / 1e6, 'MΩ'] : ohms >= 1e3 ? [ohms / 1e3, 'kΩ'] : [ohms, 'Ω'];
  return `${String(Number(v.toPrecision(3))).replace('.', ',')} ${unit}`;
}

/** Điện trở mẫu ở mô hình 3D. */
export const SAMPLE_OHMS = 4700;

function bandRow(ohms: number): string {
  const b = resistorBands(ohms);
  const d = resistorDigits(ohms);
  if (!b || !d) return '';
  const mult = d[2] >= 0 ? (10 ** d[2]).toLocaleString('vi-VN') : String(10 ** d[2]).replace('.', ',');
  return `${b[0]!.name} ${d[0]} · ${b[1]!.name} ${d[1]} · ${b[2]!.name} ×${mult} · ${b[3]!.name} ±5% → ${formatOhms(ohms)}`;
}

// ---------------- Danh mục ----------------
export const PARTS: readonly Part[] = [
  {
    id: 'resistor',
    name: 'Điện trở',
    en: 'Resistor',
    letter: 'R',
    short: 'Cản dòng điện, chia điện áp',
    sample: `${formatOhms(SAMPLE_OHMS)} ±5%, 1/4 W, màng than`,
    summary:
      'Điện trở cản bớt dòng điện. Theo định luật Ohm U = I·R: cùng một điện áp, điện trở càng lớn thì dòng càng nhỏ. Dùng để hạn dòng cho LED, chia điện áp, kéo chân tín hiệu lên mức 1 (pull-up) hoặc xuống mức 0 (pull-down).',
    specs: [
      ['Đơn vị', 'ohm (Ω); thường gặp kΩ, MΩ'],
      ['Phân cực', 'Không: cắm chiều nào cũng được'],
      ['Vạch màu mẫu này', bandRow(SAMPLE_OHMS)],
      ['Kích thước thật', 'thân dài khoảng 6,3 mm, đường kính 2,5 mm'],
    ],
    tips: [
      'Đọc vạch màu từ đầu có vạch nằm sát mép thân; vạch nhũ vàng hoặc nhũ bạc (sai số) nằm ở cuối.',
      'Bảng màu: Đen 0, Nâu 1, Đỏ 2, Cam 3, Vàng 4, Lục 5, Lam 6, Tím 7, Xám 8, Trắng 9.',
      'Công suất càng lớn thì thân càng to; loại 1/4 W phổ biến nhất trong mạch học tập.',
    ],
    chip: 'Trong chip, điện trở được làm từ dải polysilicon hoặc vùng bán dẫn pha tạp. Chúng tốn diện tích nên mạch số gần như không dùng. Ngược lại, chính các dây nối trong chip có điện trở ký sinh; cùng với tụ ký sinh, nó làm tín hiệu tới chậm hơn (chỉ số Delay trong game).',
  },
  {
    id: 'ceramic-cap',
    name: 'Tụ gốm',
    en: 'Ceramic capacitor',
    letter: 'C',
    short: 'Lọc nhiễu nguồn cho IC',
    sample: '100 nF (mã 104), 50 V',
    summary:
      'Tụ điện gồm hai bản cực ngăn bởi lớp cách điện (ở đây là gốm), tích điện tích khi có điện áp. Tụ gốm 100 nF thường được đặt sát chân nguồn của mỗi IC để cấp dòng tức thời và lọc nhiễu cao tần (tụ decoupling).',
    specs: [
      ['Đơn vị', 'farad (F); thường gặp pF, nF, µF'],
      ['Phân cực', 'Không'],
      ['Đọc mã 104', 'Hai số đầu là giá trị, số thứ ba là số chữ số 0 thêm vào, đơn vị pF: 10 và 0000 → 100.000 pF = 100 nF'],
      ['Kích thước thật', 'đường kính khoảng 5 mm'],
    ],
    tips: ['Tụ gốm nhỏ, thường màu vàng cam hoặc xanh, in mã 3 chữ số.', 'Mọi tụ đều có điện áp định mức: không dùng ở điện áp cao hơn số ghi trên thân.'],
    chip: 'Mỗi dây nối trong chip là một tụ điện nhỏ với đất. Mỗi lần tín hiệu đổi 0 ↔ 1, tụ đó được nạp hoặc xả và tốn năng lượng, xấp xỉ P = α·C·V²·f. Vì vậy chỉ số Power trong game đếm số lần dây đổi giá trị.',
  },
  {
    id: 'electrolytic',
    name: 'Tụ hoá',
    en: 'Electrolytic capacitor',
    letter: 'C',
    short: 'Tụ dung lượng lớn, có cực + và −',
    sample: '470 µF, 25 V',
    summary:
      'Tụ hoá có điện dung lớn gấp hàng nghìn lần tụ gốm cùng cỡ, dùng để san phẳng điện áp sau mạch chỉnh lưu và giữ nguồn ổn định khi tải thay đổi đột ngột.',
    specs: [
      ['Đơn vị', 'µF tới mF'],
      ['Phân cực', 'CÓ: chân dài là cực dương (+), vạch sọc trên vỏ chỉ cực âm (−)'],
      ['Điện áp định mức', '25 V: không được vượt, nên chọn dư so với điện áp mạch để tụ bền hơn'],
      ['Kích thước thật', 'Ø 6,3 mm, cao 11 mm'],
    ],
    tips: [
      'Cắm ngược cực hoặc quá áp, tụ có thể phồng, rò điện, thậm chí nổ: luôn nhìn vạch sọc trước khi hàn.',
      'Đỉnh tụ có rãnh khắc hình chữ thập hoặc chữ K: đó là van an toàn để khí thoát ra khi tụ hỏng.',
    ],
    chip: 'Tụ làm trên chip chỉ đạt cỡ vài nF trên mỗi mm² silicon. Muốn có 470 µF sẽ cần diện tích lớn gấp hàng trăm lần một con chip thông thường, nên tụ lớn luôn được đặt bên ngoài, sát chân nguồn của chip.',
  },
  {
    id: 'inductor',
    name: 'Cuộn cảm',
    en: 'Inductor',
    letter: 'L',
    short: 'Dây đồng quấn quanh lõi từ',
    sample: '100 µH, lõi ferrite hình xuyến',
    summary:
      'Cuộn cảm là dây đồng quấn nhiều vòng. Khi có dòng điện, nó tích năng lượng trong từ trường và chống lại sự thay đổi đột ngột của dòng. Dùng trong mạch nguồn xung (buck, boost) của bộ sạc, laptop và trong bộ lọc LC.',
    specs: [
      ['Đơn vị', 'henry (H); thường gặp µH, mH'],
      ['Phân cực', 'Không'],
      ['Lõi hình xuyến', 'giữ từ trường bên trong vòng, ít gây nhiễu ra xung quanh'],
      ['Dòng định mức', 'quá dòng thì lõi bão hoà, độ tự cảm tụt mạnh'],
    ],
    tips: ['Nhiều vòng dây hơn → độ tự cảm lớn hơn (tỉ lệ với bình phương số vòng).', 'Cuộn cảm dán (SMD) trên bo điện thoại thường là khối vuông nhỏ màu xám hoặc đen.'],
    chip: 'Chip thu phát sóng (Wi-Fi, Bluetooth, 5G) có cuộn cảm xoắn ốc vẽ bằng lớp kim loại trên cùng. Mỗi cuộn chỉ vài nH nhưng chiếm diện tích bằng hàng chục nghìn cổng logic, nên kỹ sư luôn cố dùng ít cuộn nhất.',
  },
  {
    id: 'diode',
    name: 'Diode chỉnh lưu',
    en: 'Rectifier diode',
    letter: 'D',
    short: 'Cho dòng đi một chiều',
    sample: '1N4007: 1000 V, 1 A',
    summary:
      'Diode chỉ cho dòng điện chạy từ anode (A) sang cathode (K). Dùng để chỉnh lưu điện xoay chiều thành một chiều, chống cắm ngược nguồn và dập điện áp ngược khi ngắt cuộn dây relay hay động cơ.',
    specs: [
      ['Phân cực', 'CÓ: vạch bạc trên thân là cathode (K)'],
      ['Sụt áp thuận', 'khoảng 0,6-1 V (silicon), tăng theo dòng'],
      ['Điện áp ngược tối đa', '1000 V'],
      ['Dòng tối đa', '1 A'],
    ],
    tips: [
      'Ký hiệu trên sơ đồ: tam giác chỉ chiều dòng, vạch ngang là cathode, giống vạch bạc trên thân.',
      'Đo bằng đồng hồ vạn năng ở thang diode: chiều thuận hiện khoảng 0,5-0,7 V, chiều ngược không lên số.',
    ],
    chip: 'Diode là một tiếp giáp p-n, cũng là "nửa" của transistor. Mỗi chân của chip đều có diode bảo vệ chống tĩnh điện (ESD): tia tĩnh điện từ ngón tay có thể lên tới hàng nghìn vôn, đủ phá lớp cách điện cổng transistor chỉ dày vài nanomet.',
  },
  {
    id: 'led',
    name: 'LED',
    en: 'Light-emitting diode',
    letter: 'D',
    short: 'Diode phát sáng',
    sample: 'LED đỏ 5 mm, khoảng 2 V, 20 mA',
    summary: 'LED là diode phát ra ánh sáng khi có dòng chạy theo chiều thuận. Màu ánh sáng do vật liệu bán dẫn quyết định: LED đỏ sụt áp khoảng 1,8-2,2 V, xanh dương và trắng khoảng 3 V.',
    specs: [
      ['Phân cực', 'CÓ: chân dài là anode (+); mép vát ở vành đáy là cathode (−)'],
      ['Dòng làm việc', '10-20 mA'],
      ['Điện trở hạn dòng', 'R = (U nguồn − U LED) / I = (5 − 2) / 0,01 = 300 Ω → chọn 330 Ω'],
    ],
    tips: ['Không nối LED thẳng vào nguồn: thiếu điện trở hạn dòng, LED cháy ngay.', 'Nhìn xuyên lớp nhựa: tấm kim loại to hơn bên trong thường là cathode.'],
    chip: 'Trong game, đèn LED ở màn THIẾT KẾ là đầu ra của mạch: sáng = bit 1, tắt = bit 0. Ngoài đời, chân của vi điều khiển chỉ cấp được vài mA tới vài chục mA, nên LED luôn đi kèm điện trở, còn tải lớn hơn thì cần transistor.',
  },
  {
    id: 'bjt',
    name: 'Transistor BJT',
    en: 'Bipolar junction transistor (NPN)',
    letter: 'Q',
    short: 'Dòng nhỏ điều khiển dòng lớn',
    sample: 'PN2222A, NPN, vỏ TO-92',
    summary:
      'BJT có 3 chân: Emitter (E), Base (B), Collector (C). Một dòng nhỏ chạy vào B cho phép dòng lớn hơn khoảng 100 lần chạy từ C xuống E. Dùng làm công tắc điện tử (bật relay, LED, động cơ nhỏ) hoặc khuếch đại tín hiệu.',
    specs: [
      ['Loại', 'NPN (loại PNP chạy theo chiều ngược lại)'],
      ['Hệ số khuếch đại β', 'khoảng 100-300'],
      ['Điện áp C-E tối đa', '40 V (PN2222A)'],
      ['Thứ tự chân', 'PN2222A, mặt phẳng hướng về bạn: E-B-C; nhưng BC547 lại là C-B-E. Luôn tra datasheet!'],
    ],
    tips: ['Mặt phẳng in mã số; mặt cong nằm phía sau.', 'Dùng BJT làm công tắc thì luôn có điện trở ở chân B (ví dụ 1 kΩ) để giới hạn dòng base.'],
    chip: 'BJT từng là linh kiện chính của chip đời đầu (họ logic TTL 74xx). Ngày nay chip số dùng CMOS vì tốn ít điện hơn nhiều; BJT vẫn có mặt trong mạch tạo điện áp chuẩn (bandgap) và nhiều chip analog.',
  },
  {
    id: 'mosfet',
    name: 'MOSFET công suất',
    en: 'N-channel power MOSFET',
    letter: 'Q',
    short: 'Công tắc điều khiển bằng điện áp',
    sample: 'IRF540N, kênh N, vỏ TO-220',
    summary:
      'MOSFET có 3 chân: Gate (G), Drain (D), Source (S). Đặt điện áp ở G (so với S) là mở kênh dẫn cho dòng chạy từ D sang S; khi đứng yên, G gần như không tốn dòng. Dùng để bật tắt động cơ, đèn LED công suất, mạch nguồn.',
    specs: [
      ['Điện áp D-S tối đa', '100 V'],
      ['Dòng D tối đa', '33 A (khi có tản nhiệt tốt)'],
      ['Điện trở khi dẫn', '44 mΩ (ở U G-S = 10 V)'],
      ['Thứ tự chân', 'G-D-S (mặt có chữ hướng về bạn); tab kim loại nối với D'],
    ],
    tips: [
      'Tab kim loại có lỗ để bắt vít vào tấm tản nhiệt.',
      'IRF540N cần khoảng 10 V ở G mới mở hoàn toàn; muốn điều khiển thẳng từ vi điều khiển 3,3 V hoặc 5 V nên chọn loại "logic level" như IRLZ44N.',
    ],
    chip: 'Đây chính là viên gạch xây nên mọi con chip! Mỗi cổng logic trong game được ghép từ MOSFET kênh N và kênh P (công nghệ CMOS): cổng NOT cần 2 transistor, NAND hay NOR 2 đầu vào cần 4. Chip điện thoại ngày nay chứa hơn 10 tỷ MOSFET, mỗi cái chỉ rộng vài chục nanomet.',
  },
  {
    id: 'ic555',
    name: 'IC 555',
    en: 'NE555 timer IC',
    letter: 'U',
    short: 'Vi mạch hẹn giờ, tạo xung',
    sample: 'NE555, vỏ DIP-8',
    summary: 'IC 555 là vi mạch hẹn giờ nổi tiếng nhất (ra mắt năm 1972). Chỉ cần thêm vài điện trở và tụ là có mạch nháy LED, tạo âm thanh hay hẹn giờ tắt đèn.',
    specs: [
      ['Kiểu vỏ', 'DIP-8: 2 hàng chân, bước chân 2,54 mm (0,1 inch)'],
      ['Nguồn', '4,5-16 V'],
      ['Chân quan trọng', '1 = GND (đất), 3 = OUT (đầu ra), 8 = VCC (nguồn)'],
      ['Bên trong', 'khoảng 25 transistor, 15 điện trở, 2 diode'],
    ],
    tips: [
      'Đếm chân: tìm vết khuyết hoặc chấm tròn đánh dấu chân 1, rồi đếm NGƯỢC chiều kim đồng hồ khi nhìn từ trên xuống. Xoay mô hình để thử!',
      'Cắm IC ngược chiều có thể làm hỏng IC: luôn tìm chấm chân 1 trước.',
    ],
    chip: 'Con chip bạn thiết kế trong game, sau khi sản xuất, cũng được đóng gói như thế này: mảnh silicon (die) nằm giữa lớp nhựa đen, nối ra chân kim loại bằng những sợi dây vàng hoặc đồng mảnh hơn sợi tóc (wire bonding).',
  },
  {
    id: 'crystal',
    name: 'Thạch anh',
    en: 'Quartz crystal',
    letter: 'Y',
    short: 'Tạo nhịp clock chính xác',
    sample: '16 MHz, vỏ HC-49/US',
    summary:
      'Bên trong vỏ kim loại là một lát thạch anh. Nhờ hiệu ứng áp điện, lát này rung ở một tần số rất ổn định khi được kích bằng điện, dùng làm nhịp đồng hồ (clock) cho vi điều khiển. Vi điều khiển ATmega328P trên nhiều bo Arduino chạy ở 16 MHz.',
    specs: [
      ['Sai số', 'khoảng ±20-50 ppm (phần triệu)'],
      ['Phân cực', 'Không'],
      ['Đi kèm', '2 tụ gốm nhỏ (ví dụ 22 pF) nối từ mỗi chân xuống đất'],
    ],
    tips: ['Số in trên vỏ là tần số: 16.000 nghĩa là 16,000 MHz.', 'Đồng hồ đeo tay dùng thạch anh 32.768 Hz = 2 mũ 15: chia đôi 15 lần là được đúng 1 nhịp mỗi giây.'],
    chip: 'Mọi flip-flop trong chip đổi trạng thái theo nhịp clock. Chỉ số Delay trong game cho biết tín hiệu đi qua mạch mất bao lâu: mạch càng chậm thì clock càng phải chậm lại, chip làm được càng ít phép tính mỗi giây.',
  },
  {
    id: 'button',
    name: 'Nút nhấn',
    en: 'Tactile push button',
    letter: 'S',
    short: 'Tạo tín hiệu 0/1 bằng tay',
    sample: 'Nút nhấn 6×6 mm, 4 chân',
    summary: 'Ấn nút thì hai tiếp điểm chạm nhau, nhả ra thì hở. Nối nút với một điện trở kéo lên (pull-up) là có tín hiệu số: không ấn = 1, ấn = 0.',
    specs: [
      ['4 chân', 'Hai chân nằm xa nhau (cách 6,5 mm) luôn nối sẵn: A với A, B với B. Ấn nút mới nối A với B.'],
      ['Dòng tối đa', 'khoảng 50 mA ở 12 V: chỉ dùng cho tín hiệu, không bật tải lớn'],
    ],
    tips: ['Dội phím (bounce): khi ấn, tiếp điểm nảy lên xuống trong vài mili giây, mạch có thể đếm thành nhiều lần ấn. Chống dội bằng mạch RC hoặc chờ khoảng 10-20 ms trong phần mềm.'],
    chip: 'Công tắc đầu vào A, B, C trong game giống hệt nút nhấn: mỗi tổ hợp bật/tắt là một hàng trong bảng chân trị. Ngoài đời, đầu vào của chip CMOS không được để "lơ lửng", luôn cần điện trở kéo lên hoặc kéo xuống.',
  },
];

export function partById(id: string): Part | undefined {
  return PARTS.find((p) => p.id === id);
}
