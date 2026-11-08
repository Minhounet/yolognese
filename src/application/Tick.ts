import { timeUp } from '../domain/game';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView } from './views';

const MIN_TIME_LEFT_MS = 0;

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
    private readonly random: RandomSource,
  ) {}

  execute(): TickResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    const timeLeftMs = Math.max(MIN_TIME_LEFT_MS, session.endsAt - this.clock.now());
    const game = timeLeftMs === MIN_TIME_LEFT_MS ? timeUp(session.game) : session.game;
    this.repository.save({ ...session, game });
    return { kind: 'ticked', view: toGameView(game), timeLeftMs };
  }
}
