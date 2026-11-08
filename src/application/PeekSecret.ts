import { Color } from '../domain/color';
import { isOver, penalise } from '../domain/game';
import { isBlind, isDistracted } from '../domain/guardian';
import { toGameView } from './GameMapper';
import { Clock, GameRepository } from './ports';
import { GameView } from './views';

const PEEK_COOLDOWN_MS = 5000;
const NO_COOLDOWN_MS = 0;

export interface PeekCommand {
  readonly index: number;
}

export type PeekResponse =
  | {
      readonly kind: 'revealed';
      readonly index: number;
      readonly color: Color;
      readonly cooldownMs: number;
    }
  | { readonly kind: 'caught'; readonly view: GameView; readonly cooldownMs: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'cooling-down' };

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
      return { kind: 'rejected', reason: 'cooling-down' };
    }
    if (!isDistracted(session.guardian, now)) {
      const game = penalise(session.game);
      this.repository.save({ ...session, game, peekReadyAt: now + PEEK_COOLDOWN_MS });
      return { kind: 'caught', view: toGameView(game), cooldownMs: PEEK_COOLDOWN_MS };
    }
    const cooldownMs = isBlind(session.guardian, now) ? NO_COOLDOWN_MS : PEEK_COOLDOWN_MS;
    this.repository.save({ ...session, peekReadyAt: now + cooldownMs });
    return {
      kind: 'revealed',
      index: command.index,
      color: session.game.secret[command.index],
      cooldownMs,
    };
  }
}
