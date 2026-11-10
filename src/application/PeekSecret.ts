import { Color } from '../domain/color';
import { isOver } from '../domain/game';
import { peek } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, GameRepository } from './ports';
import { GameView } from './views';

export interface PeekCommand {
  readonly index: number;
}

export type PeekResponse =
  | { readonly kind: 'revealed'; readonly index: number; readonly color: Color; readonly view: GameView }
  | { readonly kind: 'caught'; readonly view: GameView }
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
    const { round, outcome } = peek(session, now);
    if (outcome === 'cooling-down') {
      return { kind: 'rejected', reason: 'cooling-down' };
    }
    this.repository.save(round);
    const view = toGameView(round, now);
    if (outcome === 'caught') {
      return { kind: 'caught', view };
    }
    return { kind: 'revealed', index: command.index, color: round.game.secret[command.index], view };
  }
}
