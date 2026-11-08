import { distract } from '../domain/guardian';
import { Point } from '../domain/point';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView, GuardianView } from './views';

const DISTRACTION_MS = 1500;

export interface DistractCommand {
  readonly target: Point;
}

export type DistractResponse =
  | { readonly kind: 'distracted'; readonly view: GuardianView }
  | { readonly kind: 'punched'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

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
    const now = this.clock.now();
    const guardian = distract(session.guardian, now, now + DISTRACTION_MS);
    this.repository.save({ ...session, guardian });
    return { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } };
  }
}
