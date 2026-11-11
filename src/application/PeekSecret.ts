import { Attack, LANE_COUNT, punchWindUp } from '../domain/attack';
import { Color } from '../domain/color';
import { PEEK_COOLDOWN_MS } from '../domain/peek';
import { penalise } from '../domain/game';
import { isBlind, isDistracted } from '../domain/guardian';
import { toGameView } from './GameMapper';
import { askPeg, isSessionOver } from './stealMatch';
import { withPunchThrown } from './punches';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

const NO_COOLDOWN_MS = 0;

export interface PeekCommand {
  readonly index: number;
}

export type PeekResponse =
  | {
      readonly kind: 'revealed';
      readonly index: number;
      /** Undefined when the server holds the secret: the peg comes up a moment later, in the view's pegUp. */
      readonly color?: Color;
      readonly cooldownMs: number;
    }
  | { readonly kind: 'caught'; readonly view: GameView; readonly cooldownMs: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'peg-up' }
  | { readonly kind: 'rejected'; readonly reason: 'cooling-down'; readonly punch?: Attack };

export interface PeekSecret {
  execute(command: PeekCommand): Promise<PeekResponse>;
}

export class PeekSecretImpl implements PeekSecret {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(command: PeekCommand): Promise<PeekResponse> {
    return this.work.run<PeekResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isSessionOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const now = this.clock.now();
      if (now < session.peekReadyAt) {
        if (session.attackLandsAt !== undefined) return { result: { kind: 'rejected', reason: 'cooling-down' } };
        const punch = punchWindUp(this.random.nextInt(LANE_COUNT));
        return { session: withPunchThrown(session, now, punch), result: { kind: 'rejected', reason: 'cooling-down', punch } };
      }
      if (session.pegUp !== undefined) return { result: { kind: 'rejected', reason: 'peg-up' } };
      if (!isDistracted(session.guardian, now)) {
        const game = penalise(session.game);
        const caught = { ...session, game, peekReadyAt: now + PEEK_COOLDOWN_MS };
        return { session: caught, result: { kind: 'caught', view: toGameView(game, { session, now }), cooldownMs: PEEK_COOLDOWN_MS } };
      }
      const cooldownMs = isBlind(session.guardian, now) ? NO_COOLDOWN_MS : PEEK_COOLDOWN_MS;
      if (session.game.secret === undefined) {
        const asked = askPeg({ ...session, peekReadyAt: now + cooldownMs }, command.index, 'peek');
        return { session: asked, result: { kind: 'revealed', index: command.index, cooldownMs } };
      }
      const color = session.game.secret[command.index];
      const peeked = { ...session, peekReadyAt: now + cooldownMs, pegUp: { index: command.index, color } };
      return { session: peeked, result: { kind: 'revealed', index: command.index, color, cooldownMs } };
    });
  }
}
