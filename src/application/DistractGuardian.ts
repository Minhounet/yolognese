import { DISTRACTION_MS, distract } from '../domain/round';
import { Point } from '../domain/point';
import { Clock, GameRepository } from './ports';
import { GuardianView } from './views';

export interface DistractCommand {
  readonly target: Point;
}

export type DistractResponse =
  | { readonly kind: 'distracted'; readonly view: GuardianView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface DistractGuardian {
  execute(command: DistractCommand): DistractResponse;
}

export class DistractGuardianImpl implements DistractGuardian {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(command: DistractCommand): DistractResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    this.repository.save(distract(session, this.clock.now()));
    return { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } };
  }
}
