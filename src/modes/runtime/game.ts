// Máy trạng thái chế độ VẬN HÀNH — thuần logic, không DOM, để test được từng quy tắc trong SPEC mục 1.
// Scene chỉ việc gọi update(dt), answer(gate), rồi vẽ theo trạng thái và xử lý sự kiện.
import { RUNTIME } from '../../config';
import type { GateType } from '../../core/circuit/types';
import { fixedFallTime, multiplier, pointsFor } from '../../core/scoring/runtime';
import { createRng } from '../../core/util/rng';
import { AdaptiveDifficulty } from '../../ai/adaptive';
import { Spawner, unlockedGates, type Packet } from './spawner';

export type RuntimeMode = 'endless' | 'sixty';

/** tỉ lệ sai tối thiểu của một cổng (≥ 3 lần gặp) để báo người chơi rằng game sẽ ra thêm câu cổng đó */
export const ADAPT_ANNOUNCE_RATE = 0.34;

export type GameEvent =
  | { type: 'correct'; points: number; gate: GateType; multiplier: number }
  | { type: 'wrong'; chosen: GateType; expected: GateType[] }
  | { type: 'miss'; expected: GateType[] }
  | { type: 'unlock'; gate: GateType }
  /** độ khó thích nghi bắt đầu ra thêm câu loại cổng người chơi hay sai (SPEC 5.4) — báo 1 lần mỗi cổng mỗi ván */
  | { type: 'adapt'; gate: GateType }
  | { type: 'end' };

export interface RuntimeResult {
  mode: RuntimeMode;
  score: number;
  answered: number;
  correct: number;
  /** 0..1, 0 nếu chưa trả lời câu nào */
  accuracy: number;
  bestCombo: number;
  weakest: { gate: GateType; errorRate: number } | null;
  durationS: number;
}

export class RuntimeGame {
  score = 0;
  lives: number = RUNTIME.lives;
  combo = 0;
  bestCombo = 0;
  answered = 0;
  correctCount = 0;
  elapsed = 0;
  /** thời gian rơi hiện tại của một gói (giây) */
  fall: number = RUNTIME.startFall;
  /** tiến độ rơi của gói hiện tại, 0 → 1 (chạm đáy) */
  progress = 0;
  packet: Packet;
  ended = false;
  paused = false;

  private bestScore = 0;
  private gates: GateType[];
  private events: GameEvent[] = [];
  private readonly adaptive: AdaptiveDifficulty | null;
  /** cổng đã báo "game đang ra thêm câu …" trong ván này */
  private readonly announced = new Set<GateType>();
  private readonly spawner: Spawner;

  constructor(
    readonly mode: RuntimeMode,
    seed: number,
  ) {
    // Thử thách 60 giây TẮT thích nghi để mọi người cùng seed gặp cùng chuỗi gói (so điểm công bằng).
    this.adaptive = mode === 'endless' ? new AdaptiveDifficulty() : null;
    this.spawner = new Spawner(createRng(seed), this.adaptive);
    this.gates = unlockedGates(0);
    this.packet = this.spawner.next(this.gates);
  }

  get unlocked(): readonly GateType[] {
    return this.gates;
  }

  get timeLeft(): number {
    return this.mode === 'sixty' ? Math.max(0, RUNTIME.sixtyDuration - this.elapsed) : Infinity;
  }

  update(dt: number): void {
    if (this.ended || this.paused) return;
    this.elapsed += dt;
    if (this.mode === 'sixty' && this.elapsed >= RUNTIME.sixtyDuration) {
      this.elapsed = RUNTIME.sixtyDuration;
      this.finish();
      return;
    }
    this.progress += dt / this.fall;
    if (this.progress >= 1) this.resolve(false, null);
  }

  /** Người chơi chọn cổng. Trả về true nếu câu trả lời được nhận (không bị bỏ qua). */
  answer(gate: GateType): boolean {
    if (this.ended || this.paused || !this.gates.includes(gate)) return false;
    this.resolve(this.packet.validGates.includes(gate), gate);
    return true;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  drainEvents(): GameEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  result(): RuntimeResult {
    return {
      mode: this.mode,
      score: this.score,
      answered: this.answered,
      correct: this.correctCount,
      accuracy: this.answered ? this.correctCount / this.answered : 0,
      bestCombo: this.bestCombo,
      weakest: this.adaptive?.weakestGate() ?? null,
      durationS: this.elapsed,
    };
  }

  private resolve(correct: boolean, chosen: GateType | null): void {
    const p = this.packet;
    this.answered++;
    this.adaptive?.record(p.cell, correct);

    if (correct) {
      const mult = multiplier(this.combo);
      const points = pointsFor(this.combo);
      this.score += points;
      this.combo++;
      this.correctCount++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.events.push({ type: 'correct', points, gate: chosen as GateType, multiplier: mult });
    } else {
      this.combo = 0;
      this.events.push(chosen ? { type: 'wrong', chosen, expected: p.validGates } : { type: 'miss', expected: p.validGates });
      // Minh bạch: khi AI bắt đầu nhắm vào điểm yếu thì nói cho người chơi biết
      const weak = this.adaptive?.weakestGate();
      if (weak && weak.errorRate >= ADAPT_ANNOUNCE_RATE && !this.announced.has(weak.gate)) {
        this.announced.add(weak.gate);
        this.events.push({ type: 'adapt', gate: weak.gate });
      }
      if (this.mode === 'endless') {
        this.lives--;
        if (this.lives <= 0) {
          this.finish();
          return;
        }
      } else {
        this.score = Math.max(0, this.score - RUNTIME.wrongPenalty);
      }
    }

    // Mở khóa cổng theo điểm cao nhất từng đạt
    this.bestScore = Math.max(this.bestScore, this.score);
    const nowUnlocked = unlockedGates(this.bestScore);
    for (const g of nowUnlocked) if (!this.gates.includes(g)) this.events.push({ type: 'unlock', gate: g });
    this.gates = nowUnlocked;

    // Tốc độ: Vô tận theo độ khó thích nghi, 60 giây theo đường cố định
    this.fall = this.adaptive ? this.adaptive.adjustFall(this.fall) : fixedFallTime(this.correctCount);

    this.packet = this.spawner.next(this.gates);
    this.progress = 0;
  }

  private finish(): void {
    this.ended = true;
    this.events.push({ type: 'end' });
  }
}
