import { Code } from '../domain/color';
import { isWon, play } from '../domain/game';
import { toGameView } from './GameMapper';
import { GameRepository } from './ports';
import { GameView } from './views';

export interface SubmitGuessCommand {
  readonly guess: Code;
}

export type SubmitGuessResponse =
  | { readonly kind: 'played'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

export interface SubmitGuess {
  execute(command: SubmitGuessCommand): SubmitGuessResponse;
}

export class SubmitGuessImpl implements SubmitGuess {
  constructor(private readonly repository: GameRepository) {}

  execute(command: SubmitGuessCommand): SubmitGuessResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    if (isWon(session.game)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const game = play(session.game, command.guess);
    this.repository.save({ ...session, game });
    return { kind: 'played', view: toGameView(game) };
  }
}
