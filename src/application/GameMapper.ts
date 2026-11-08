import { Game, attemptsLeft, isLost, isOver, isWon } from '../domain/game';
import { GameStatus, GameView } from './views';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

export function toGameView(game: Game): GameView {
  return {
    status: toStatus(game),
    attemptsLeft: attemptsLeft(game),
    life: -1,
    secret: isOver(game) ? game.secret : undefined,
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
  };
}
