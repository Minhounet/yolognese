import { Code } from '../domain/color';
import { EMPTY_DRAFT } from '../domain/draft';
import { play } from '../domain/game';
import { isSessionOver, sendGuess } from './stealMatch';
import { toGameView } from './GameMapper';
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

export class SubmitGuessImpl implements SubmitGuess {
  constructor(private readonly work: SessionWork) {}

  execute(command: SubmitGuessCommand): Promise<SubmitGuessResponse> {
    return this.work.run<SubmitGuessResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isSessionOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      if (session.steal !== undefined) {
        // "steal the sauce": the server scores it; the view shows it pending until then
        const sent = sendGuess(session, session.steal, command.guess);
        return { session: sent, result: { kind: 'played', view: toGameView(sent.game, { session: sent }) } };
      }
      const game = play(session.game, command.guess);
      const played = { ...session, game, draft: EMPTY_DRAFT };
      return { session: played, result: { kind: 'played', view: toGameView(game, { session: played }) } };
    });
  }
}
