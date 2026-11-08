import { Clock, GameRepository } from './ports';
import { toGameView } from './GameMapper';
import { GameView } from './views';

const GAME_DURATION_MS = 180000;

export type TickResponse =
  | { readonly kind: 'ticked'; readonly timeLeftMs: number; readonly view: GameView }
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
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    return { kind: 'ticked', timeLeftMs: GAME_DURATION_MS, view: toGameView(session.game) };
  }
}
