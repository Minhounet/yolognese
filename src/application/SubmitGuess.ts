import { Code } from '../domain/color';
import { isOver } from '../domain/game';
import { guess } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, GameRepository } from './ports';
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

/** Plays the guess and empties the row being composed. */
export class SubmitGuessImpl implements SubmitGuess {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(command: SubmitGuessCommand): SubmitGuessResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    if (isOver(session.game)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const played = guess(session, command.guess);
    this.repository.save(played);
    return { kind: 'played', view: toGameView(played, this.clock.now()) };
  }
}
