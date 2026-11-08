import { Color } from '../domain/color';
import { isOver, penalise } from '../domain/game';
import { isDistracted } from '../domain/guardian';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, Session } from './ports';
import { GameView } from './views';

const PEEK_COOLDOWN_MS = 5000;

export interface PeekCommand {
  readonly index: number;
}

/** A peek that went through, revealed or caught, starts the cooldown; the screen's bar reads it. */
interface Cooldown {
  readonly cooldownRemainingMs: number;
}

export type PeekResponse =
  | ({ readonly kind: 'revealed'; readonly index: number; readonly color: Color } & Cooldown)
  | ({ readonly kind: 'caught'; readonly view: GameView } & Cooldown)
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' }
  | { readonly kind: 'rejected'; readonly reason: 'cooling-down'; readonly remainingMs: number };

export interface PeekSecret {
  execute(command: PeekCommand): PeekResponse;
}

export class PeekSecretImpl implements PeekSecret {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(command: PeekCommand): PeekResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    if (isOver(session.game)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const now = this.clock.now();
    if (now < session.peekReadyAt) {
      return { kind: 'rejected', reason: 'cooling-down', remainingMs: session.peekReadyAt - now };
    }
    const coolingDown: Session = { ...session, peekReadyAt: now + PEEK_COOLDOWN_MS };
    if (!isDistracted(session.guardian, now)) {
      const game = penalise(session.game);
      this.repository.save({ ...coolingDown, game });
      return { kind: 'caught', view: toGameView(game), cooldownRemainingMs: PEEK_COOLDOWN_MS };
    }
    this.repository.save(coolingDown);
    return {
      kind: 'revealed',
      index: command.index,
      color: session.game.secret[command.index],
      cooldownRemainingMs: PEEK_COOLDOWN_MS,
    };
  }
}
