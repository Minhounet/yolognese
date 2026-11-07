import { Game, isWon } from '../domain/game';
import { GameView } from './views';

export function toGameView(game: Game): GameView {
  return {
    status: isWon(game) ? 'won' : 'playing',
    attemptsLeft: 9,
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
  };
}
