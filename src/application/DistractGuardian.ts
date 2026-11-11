import { Attack, LANE_COUNT, punchWindUp } from '../domain/attack';
import { distract } from '../domain/guardian';
import { Point } from '../domain/point';
import { withPunchThrown } from './punches';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { toGameView } from './GameMapper';
import { isSessionOver } from './stealMatch';
import { GameView, GuardianView } from './views';

const DISTRACTION_MS = 1500;
const LUCK_OUTCOMES = 4;
const SEES_THROUGH = 0;

export interface DistractCommand {
  readonly target: Point;
}

export type DistractResponse =
  | { readonly kind: 'distracted'; readonly view: GuardianView }
  | { readonly kind: 'punched'; readonly punch?: Attack; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

export interface DistractGuardian {
  execute(command: DistractCommand): Promise<DistractResponse>;
}

export class DistractGuardianImpl implements DistractGuardian {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly luck: RandomSource,
  ) {}

  execute(command: DistractCommand): Promise<DistractResponse> {
    return this.work.run<DistractResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isSessionOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const now = this.clock.now();
      if (this.luck.nextInt(LUCK_OUTCOMES) === SEES_THROUGH) {
        const view = toGameView(session.game, { session, now });
        if (session.attackLandsAt !== undefined) return { result: { kind: 'punched', view } };
        const punch = punchWindUp(this.luck.nextInt(LANE_COUNT));
        return { session: withPunchThrown(session, now, punch), result: { kind: 'punched', punch, view } };
      }
      const guardian = distract(session.guardian, now, now + DISTRACTION_MS);
      return { session: { ...session, guardian }, result: { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } } };
    });
  }
}
