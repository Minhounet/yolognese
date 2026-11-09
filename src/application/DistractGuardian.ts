import { Attack, LANE_COUNT, punchWindUp } from '../domain/attack';
import { isOver } from '../domain/game';
import { distract } from '../domain/guardian';
import { Point } from '../domain/point';
import { withPunchThrown } from './punches';
import { Clock, GameRepository, RandomSource } from './ports';
import { toGameView } from './GameMapper';
import { GameView, GuardianView } from './views';

const DISTRACTION_MS = 1500;
const LUCK_OUTCOMES = 4;
const SEES_THROUGH = 0;

export interface DistractCommand {
  readonly target: Point;
}

export type DistractResponse =
  | { readonly kind: 'distracted'; readonly view: GuardianView }
  | { readonly kind: 'punched'; readonly punch: Attack; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

export interface DistractGuardian {
  execute(command: DistractCommand): DistractResponse;
}

export class DistractGuardianImpl implements DistractGuardian {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly luck: RandomSource,
  ) {}

  execute(command: DistractCommand): DistractResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    if (isOver(session.game)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const now = this.clock.now();
    if (this.luck.nextInt(LUCK_OUTCOMES) === SEES_THROUGH) {
      const punch = punchWindUp(this.luck.nextInt(LANE_COUNT));
      this.repository.save(withPunchThrown(session, now, punch));
      return { kind: 'punched', punch, view: toGameView(session.game) };
    }
    const guardian = distract(session.guardian, now, now + DISTRACTION_MS);
    this.repository.save({ ...session, guardian });
    return { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } };
  }
}
