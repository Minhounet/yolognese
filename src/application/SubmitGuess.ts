import { Code } from '../domain/color';
import { countExact } from '../domain/game';
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
    const exact = countExact(session.game, command.guess);
    return {
      kind: 'played',
      view: { turns: [{ guess: command.guess, exact, misplaced: 0 }] },
    };
  }
}
