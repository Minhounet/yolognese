import { Code } from '../domain/color';
import { isOver } from '../domain/game';
import { guess, isRoundOver } from '../domain/round';
import { settle } from '../domain/stealRound';
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
    if (isOver(session.game) || isRoundOver(session)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const now = this.clock.now();
    const played = settle(guess(session, command.guess), now);
    this.repository.save(played);
    return { kind: 'played', view: toGameView(played, now) };
  }
}
