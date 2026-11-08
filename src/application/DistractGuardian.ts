import { isOver, punch } from '../domain/game';
import { distract } from '../domain/guardian';
import { Point } from '../domain/point';
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
  | { readonly kind: 'punched'; readonly view: GameView }
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
    if (this.luck.nextInt(LUCK_OUTCOMES) === SEES_THROUGH) {
      const game = punch(session.game);
      this.repository.save({ ...session, game });
      return { kind: 'punched', view: toGameView(game) };
    }
    const now = this.clock.now();
    const guardian = distract(session.guardian, now, now + DISTRACTION_MS);
    this.repository.save({ ...session, guardian });
    return { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } };
  }
}
