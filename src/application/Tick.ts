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
    const { endsAt } = this.withDeadline(session);
    return { kind: 'ticked', timeLeftMs: endsAt - this.clock.now(), view: toGameView(session.game) };
  }

  private withDeadline(session: Session): Session & { readonly endsAt: number } {
    if (session.endsAt !== undefined) {
      return { ...session, endsAt: session.endsAt };
    }
    const started = { ...session, endsAt: this.clock.now() + GAME_DURATION_MS };
    this.repository.save(started);
    return started;
  }
}
