import { Point } from '../domain/point';
import { Clock, GameRepository } from './ports';
import { GuardianView } from './views';

const DISTRACTION_MS = 1500;

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
    return { kind: 'distracted', view: { gaze: command.target, remainingMs: DISTRACTION_MS } };
  }
}
