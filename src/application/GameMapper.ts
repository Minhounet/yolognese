import { Game, MAX_LIFE, isLost, isOver, isWon } from '../domain/game';
import { EMPTY_DRAFT } from '../domain/draft';
import { Session } from './ports';
import { GameStatus, GameView } from './views';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

/** What a view needs from the session besides the game: the row being composed, the x-ray (AC32) and the time. */
export interface ViewContext {
  readonly session?: Pick<Session, 'draft' | 'xray'>;
  readonly now?: number;
}

function xrayed(game: Game, { session, now }: ViewContext): GameView['revealed'] {
  const xray = session?.xray;
  if (xray === undefined || now === undefined || now >= xray.until || isOver(game)) return [];
  return [{ index: xray.index, color: game.secret[xray.index] }];
}

export function toGameView(game: Game, context: ViewContext = {}): GameView {
  return {
    status: toStatus(game),
    life: game.life,
    maxLife: MAX_LIFE,
    revealed: xrayed(game, context),
    draft: context.session?.draft ?? EMPTY_DRAFT,
    secret: isOver(game) ? game.secret : undefined,
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
  };
}
