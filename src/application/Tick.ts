import { Game, expire } from '../domain/game';
import { Clock, GameRepository, Session } from './ports';
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
    const timeLeftMs = Math.max(0, this.deadlineStartingClock(session) - this.clock.now());
    const game = timeLeftMs <= 0 ? this.expireAndSave(session) : session.game;
    return { kind: 'ticked', timeLeftMs, view: toGameView(game) };
  }

  private expireAndSave(session: Session): Game {
    const game = expire(session.game);
    this.repository.save({ ...session, game });
    return game;
  }

  /** The game's end; the first tick of a game starts the clock and saves it. */
  private deadlineStartingClock(session: Session): number {
    if (session.endsAt !== undefined) {
      return session.endsAt;
    }
    const endsAt = this.clock.now() + GAME_DURATION_MS;
    this.repository.save({ ...session, endsAt });
    return endsAt;
  }
}
