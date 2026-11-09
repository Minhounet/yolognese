import { Attack, LANE_COUNT, punchWindUp } from '../domain/attack';
import { Color } from '../domain/color';
import { PEEK_COOLDOWN_MS } from '../domain/peek';
import { isOver, penalise } from '../domain/game';
import { isBlind, isDistracted } from '../domain/guardian';
import { toGameView } from './GameMapper';
import { withPunchThrown } from './punches';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView } from './views';

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
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'peg-up' }
  | { readonly kind: 'rejected'; readonly reason: 'cooling-down'; readonly punch?: Attack };

export interface PeekSecret {
  execute(command: PeekCommand): PeekResponse;
}

export class PeekSecretImpl implements PeekSecret {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
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
      if (session.attackLandsAt !== undefined) {
        return { kind: 'rejected', reason: 'cooling-down' };
      }
      const punch = punchWindUp(this.random.nextInt(LANE_COUNT));
      this.repository.save(withPunchThrown(session, now, punch));
      return { kind: 'rejected', reason: 'cooling-down', punch };
    }
    if (session.pegUp !== undefined) {
      return { kind: 'rejected', reason: 'peg-up' };
    }
    if (!isDistracted(session.guardian, now)) {
      const game = penalise(session.game);
      this.repository.save({ ...session, game, peekReadyAt: now + PEEK_COOLDOWN_MS });
      return { kind: 'caught', view: toGameView(game), cooldownMs: PEEK_COOLDOWN_MS };
    }
    const cooldownMs = isBlind(session.guardian, now) ? NO_COOLDOWN_MS : PEEK_COOLDOWN_MS;
    const color = session.game.secret[command.index];
    this.repository.save({
      ...session,
      peekReadyAt: now + cooldownMs,
      pegUp: { index: command.index, color },
    });
    return { kind: 'revealed', index: command.index, color, cooldownMs };
  }
}
