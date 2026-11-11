import { Code } from '../domain/color';
import { isOver } from '../domain/game';
import { guess, isRoundOver } from '../domain/round';
import { settle } from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export interface SubmitGuessCommand {
  readonly guess: Code;
}

export type SubmitGuessResponse =
  | { readonly kind: 'played'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' };

export interface SubmitGuess {
  execute(command: SubmitGuessCommand): Promise<SubmitGuessResponse>;
}

/** Plays the guess and empties the row being composed. */
export class SubmitGuessImpl implements SubmitGuess {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(command: SubmitGuessCommand): Promise<SubmitGuessResponse> {
    return this.work.run<SubmitGuessResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isOver(session.game) || isRoundOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const now = this.clock.now();
      const played = settle(guess(session, command.guess), now);
      return { session: played, result: { kind: 'played', view: toGameView(played, now) } };
    });
  }
}
