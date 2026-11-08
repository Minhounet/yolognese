import { Clock, GameRepository } from './ports';
import { GameView } from './views';

export type TickResponse =
  | { readonly kind: 'ticked'; readonly view: GameView; readonly timeLeftMs: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface Tick {
  execute(): TickResponse;
}

export class TickImpl implements Tick {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(): TickResponse {
    return { kind: 'rejected', reason: 'no-game' };
  }
}
