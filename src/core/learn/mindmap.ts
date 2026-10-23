// Góc học tập: sơ đồ tư duy "Điện - Điện tử" (dữ liệu thuần, không DOM).
// Gốc → 6 nhánh → các ý con. Mỗi nút có lời giải thích ngắn, công thức (nếu có) và liên kết sang
// thư viện linh kiện hoặc chế độ chơi dùng đúng kiến thức đó, để học xong là thử được ngay.
import type { PartId } from '../parts/catalog';

export type MindLink = { kind: 'part'; id: PartId } | { kind: 'mode'; id: 'design' | 'debug' | 'assembly' | 'runtime' };

export interface MindNode {
  id: string;
  label: string;
  /** 1-3 câu giải thích */
  detail: string;
  formula?: string;
  link?: MindLink;
  children?: MindNode[];
}

export const MIND_ROOT: MindNode = {
  id: 'root',
  label: 'Điện - Điện tử',
  detail: 'Điện học nghiên cứu điện tích, điện áp và dòng điện; điện tử học dùng linh kiện bán dẫn để điều khiển dòng điện, từ đèn LED tới con chip hàng tỷ transistor. Chạm vào một nhánh để mở ra.',
  children: [
    {
      id: 'quantity',
      label: 'Đại lượng cơ bản',
      detail: 'Bốn đại lượng dùng nhiều nhất: điện áp (đẩy), dòng điện (chảy), điện trở (cản), công suất (năng lượng mỗi giây).',
      children: [
        { id: 'voltage', label: 'Điện áp U', detail: 'Chênh lệch điện thế giữa hai điểm, giống chênh lệch độ cao làm nước chảy. Đo bằng vôn kế mắc song song.', formula: 'Đơn vị: vôn (V)' },
        { id: 'current', label: 'Dòng điện I', detail: 'Lượng điện tích chạy qua tiết diện dây mỗi giây. Đo bằng ampe kế mắc nối tiếp.', formula: 'Đơn vị: ampe (A); 1 mA = 0,001 A' },
        { id: 'resistance', label: 'Điện trở R', detail: 'Mức cản trở dòng điện của vật dẫn. Dây đồng có điện trở rất nhỏ, chất cách điện có điện trở rất lớn.', formula: 'Đơn vị: ohm (Ω)', link: { kind: 'part', id: 'resistor' } },
        { id: 'power', label: 'Công suất P', detail: 'Năng lượng tiêu thụ hoặc toả ra mỗi giây. Linh kiện có công suất định mức; vượt quá thì nóng và cháy.', formula: 'P = U · I = I² · R = U² / R' },
        { id: 'frequency', label: 'Tần số f', detail: 'Số chu kỳ mỗi giây của tín hiệu lặp lại. Điện lưới Việt Nam 50 Hz; clock của CPU cỡ vài GHz.', formula: 'f = 1 / T (Hz)' },
      ],
    },
    {
      id: 'laws',
      label: 'Định luật',
      detail: 'Ba định luật đủ để phân tích hầu hết mạch điện một chiều: Ohm và hai định luật Kirchhoff.',
      children: [
        { id: 'ohm', label: 'Định luật Ohm', detail: 'Dòng qua điện trở tỉ lệ thuận với điện áp đặt lên nó. Đây là công thức tính điện trở hạn dòng cho LED.', formula: 'U = I · R', link: { kind: 'mode', id: 'assembly' } },
        { id: 'kcl', label: 'Kirchhoff dòng (KCL)', detail: 'Tại một nút, tổng dòng chảy vào bằng tổng dòng chảy ra: điện tích không tự sinh ra hay mất đi.', formula: 'Σ I vào = Σ I ra' },
        { id: 'kvl', label: 'Kirchhoff áp (KVL)', detail: 'Đi một vòng kín bất kỳ trong mạch, tổng đại số các điện áp bằng 0.', formula: 'Σ U quanh vòng = 0' },
        { id: 'series', label: 'Nối tiếp, song song', detail: 'Nối tiếp: cùng dòng, điện trở cộng lại. Song song: cùng điện áp, điện trở tương đương nhỏ hơn điện trở nhỏ nhất.', formula: 'Nối tiếp: R = R1 + R2 · Song song: 1/R = 1/R1 + 1/R2' },
        { id: 'divider', label: 'Mạch chia áp', detail: 'Hai điện trở nối tiếp chia điện áp nguồn theo tỉ lệ điện trở; dùng để hạ áp tín hiệu hoặc đọc cảm biến.', formula: 'U ra = U vào · R2 / (R1 + R2)' },
      ],
    },
    {
      id: 'passive',
      label: 'Linh kiện thụ động',
      detail: 'Không khuếch đại được tín hiệu, chỉ cản trở, tích trữ hoặc lọc năng lượng.',
      children: [
        { id: 'p-resistor', label: 'Điện trở', detail: 'Hạn dòng, chia áp, kéo lên/kéo xuống. Giá trị đọc bằng vạch màu.', formula: 'Đen 0 · Nâu 1 · Đỏ 2 · Cam 3 · Vàng 4 · Lục 5 · Lam 6 · Tím 7 · Xám 8 · Trắng 9', link: { kind: 'part', id: 'resistor' } },
        { id: 'p-capacitor', label: 'Tụ điện', detail: 'Tích điện tích, chặn dòng một chiều khi đã nạp đầy, cho tín hiệu xoay chiều đi qua. Tụ hoá có cực + và −.', formula: 'Q = C · U · τ = R · C', link: { kind: 'part', id: 'electrolytic' } },
        { id: 'p-inductor', label: 'Cuộn cảm', detail: 'Tích năng lượng trong từ trường và chống lại sự thay đổi đột ngột của dòng; có trong mạch nguồn xung.', formula: 'U = L · dI/dt', link: { kind: 'part', id: 'inductor' } },
        { id: 'p-crystal', label: 'Thạch anh', detail: 'Rung ở tần số rất ổn định nhờ hiệu ứng áp điện, làm nhịp clock cho vi điều khiển.', link: { kind: 'part', id: 'crystal' } },
      ],
    },
    {
      id: 'semi',
      label: 'Bán dẫn',
      detail: 'Silicon pha tạp thành loại N (thừa electron) và P (thừa lỗ trống); ghép chúng lại tạo diode và transistor.',
      children: [
        { id: 's-pn', label: 'Tiếp giáp P\u2011N', detail: 'Chỗ tiếp xúc giữa bán dẫn P và N: dẫn khi phân cực thuận, gần như không dẫn khi phân cực ngược.' },
        { id: 's-diode', label: 'Diode', detail: 'Cho dòng đi một chiều từ anode sang cathode; diode silicon sụt khoảng 0,6-0,7 V khi dẫn.', formula: 'Vạch trên thân = cathode', link: { kind: 'part', id: 'diode' } },
        { id: 's-led', label: 'LED', detail: 'Diode phát sáng; luôn cần điện trở hạn dòng.', formula: 'R = (U nguồn − U LED) / I', link: { kind: 'part', id: 'led' } },
        { id: 's-bjt', label: 'BJT', detail: 'Transistor lưỡng cực: dòng base nhỏ điều khiển dòng collector lớn gấp β lần.', formula: 'I C = β · I B', link: { kind: 'part', id: 'bjt' } },
        { id: 's-mosfet', label: 'MOSFET', detail: 'Transistor hiệu ứng trường: điện áp cổng G mở kênh dẫn, gần như không tốn dòng tĩnh. Viên gạch của mọi chip CMOS.', formula: 'Mở khi U GS > U ngưỡng', link: { kind: 'part', id: 'mosfet' } },
      ],
    },
    {
      id: 'digital',
      label: 'Mạch số',
      detail: 'Thay vì đo điện áp liên tục, mạch số chỉ quan tâm hai mức: thấp = 0, cao = 1.',
      children: [
        { id: 'd-bit', label: 'Bit và nhị phân', detail: 'Mỗi bit là 0 hoặc 1; n bit biểu diễn 2 mũ n giá trị. 1011 (nhị phân) = 8 + 2 + 1 = 11.', formula: '1 byte = 8 bit' },
        { id: 'd-gates', label: 'Cổng logic', detail: 'AND ra 1 khi mọi đầu vào là 1; OR ra 1 khi có ít nhất một đầu vào 1; XOR ra 1 khi hai đầu vào khác nhau; NOT đảo bit.', link: { kind: 'mode', id: 'runtime' } },
        { id: 'd-truth', label: 'Bảng chân trị', detail: 'Liệt kê đầu ra cho mọi tổ hợp đầu vào; n đầu vào có 2 mũ n hàng. Đây là "đề bài" của màn THIẾT KẾ.', link: { kind: 'mode', id: 'design' } },
        { id: 'd-cmos', label: 'CMOS', detail: 'Ghép MOSFET kênh N và kênh P để gần như không tốn điện khi đứng yên. Cổng NOT cần 2 transistor, NAND 2 đầu vào cần 4.' },
        { id: 'd-clock', label: 'Clock, flip-flop', detail: 'Flip-flop lưu 1 bit và chỉ đổi theo nhịp clock; nhờ vậy hàng tỷ cổng làm việc đồng bộ.' },
      ],
    },
    {
      id: 'chip',
      label: 'Vi mạch (IC)',
      detail: 'Con chip đi qua nhiều công đoạn: thiết kế, chế tạo trên wafer, kiểm thử, đóng gói, lắp lên bo mạch và vận hành.',
      children: [
        { id: 'c-design', label: 'Thiết kế', detail: 'Ghép cổng logic và đi dây sao cho đúng chức năng với chi phí thấp nhất.', link: { kind: 'mode', id: 'design' } },
        { id: 'c-ppa', label: 'PPA', detail: 'Ba thước đo của thiết kế chip: Power (điện năng), Performance (tốc độ, ngược với Delay), Area (diện tích silicon).', formula: 'P động ≈ α · C · V² · f' },
        { id: 'c-test', label: 'Kiểm thử', detail: 'Chip vừa sản xuất có thể có lỗi; kỹ sư đặt đầu vào và đo đầu ra để khoanh vùng lỗi với ít phép đo nhất.', link: { kind: 'mode', id: 'debug' } },
        { id: 'c-package', label: 'Đóng gói, lắp ráp', detail: 'Die silicon được nối ra chân kim loại (wire bonding), bọc nhựa, rồi cắm lên bo mạch cùng linh kiện khác.', link: { kind: 'mode', id: 'assembly' } },
        { id: 'c-moore', label: 'Định luật Moore', detail: 'Gordon Moore (1965, chỉnh năm 1975) dự đoán số transistor trên chip tăng gấp đôi khoảng mỗi 2 năm; xu hướng này đúng trong nhiều thập kỷ.' },
      ],
    },
  ],
};

/** Tìm nút theo id, kèm đường đi từ gốc (để vẽ đường dẫn "Gốc › Nhánh › Ý"). */
export function findMindPath(id: string, node: MindNode = MIND_ROOT, path: MindNode[] = []): MindNode[] | null {
  const here = [...path, node];
  if (node.id === id) return here;
  for (const c of node.children ?? []) {
    const r = findMindPath(id, c, here);
    if (r) return r;
  }
  return null;
}

export function allMindNodes(node: MindNode = MIND_ROOT): MindNode[] {
  return [node, ...(node.children ?? []).flatMap((c) => allMindNodes(c))];
}
