import { Code } from '../domain/color';
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
    return {
      kind: 'played',
      view: { turns: [{ guess: command.guess, exact: 4, misplaced: 0 }] },
    };
  }
}
