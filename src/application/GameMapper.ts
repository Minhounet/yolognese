import { Game, attemptsLeft, isLost, isWon } from '../domain/game';
import { GameStatus, GameView } from './views';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

export function toGameView(game: Game): GameView {
  return {
    status: toStatus(game),
    attemptsLeft: attemptsLeft(game),
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
  };
}
