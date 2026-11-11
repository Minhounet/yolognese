import { Color } from '../domain/color';
import { isOver } from '../domain/game';
import { isRoundOver, peek } from '../domain/round';
import { settle } from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export interface PeekCommand {
  readonly index: number;
}

export type PeekResponse =
  /** The colour is undefined when the server holds the secret: it comes later, in the view's reveal. */
  | { readonly kind: 'revealed'; readonly index: number; readonly color?: Color; readonly view: GameView }
  | { readonly kind: 'caught'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'cooling-down' };

export interface PeekSecret {
  execute(command: PeekCommand): Promise<PeekResponse>;
}

export class PeekSecretImpl implements PeekSecret {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(command: PeekCommand): Promise<PeekResponse> {
    return this.work.run<PeekResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isOver(session.game) || isRoundOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const now = this.clock.now();
      const peeked = peek(session, command.index, now);
      if (peeked.outcome === 'cooling-down') return { result: { kind: 'rejected', reason: 'cooling-down' } };
      const round = settle(peeked.round, now);
      const view = toGameView(round, now);
      if (peeked.outcome === 'caught') return { session: round, result: { kind: 'caught', view } };
      return { session: round, result: { kind: 'revealed', index: command.index, color: round.game.secret?.[command.index], view } };
    });
  }
}
