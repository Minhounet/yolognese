import { Game } from '../domain/game';
import { GameView } from './views';

export function toGameView(game: Game): GameView {
  return { turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })) };
}
