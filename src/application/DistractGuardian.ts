import { DISTRACTION_MS, distract } from '../domain/round';
import { Point } from '../domain/point';
import { Clock } from './ports';
import { SessionWork } from './SessionWork';
import { GuardianView } from './views';

export interface DistractCommand {
  readonly target: Point;
}

export type DistractResponse =
  | { readonly kind: 'distracted'; readonly view: GuardianView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface DistractGuardian {
  execute(command: DistractCommand): Promise<DistractResponse>;
}

export class DistractGuardianImpl implements DistractGuardian {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(command: DistractCommand): Promise<DistractResponse> {
    return this.work.run<DistractResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      return {
        session: distract(session, this.clock.now()),
        result: { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } },
      };
    });
  }
}
