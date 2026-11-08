import { Color } from '../domain/color';
import { toGameView } from './GameMapper';
import { Clock, GameRepository } from './ports';
import { GameView } from './views';

export interface PeekCommand {
  readonly index: number;
}

export type PeekResponse =
  | { readonly kind: 'revealed'; readonly index: number; readonly color: Color }
  | { readonly kind: 'caught'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

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
    if (!session.guardian.distracted) {
      return { kind: 'caught', view: toGameView(session.game) };
    }
    return { kind: 'revealed', index: command.index, color: session.game.secret[command.index] };
  }
}
