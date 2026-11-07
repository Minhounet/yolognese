import { Code } from '../domain/color';

export interface TurnView {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface GameView {
  readonly status: GameStatus;
  readonly attemptsLeft: number;
  readonly turns: readonly TurnView[];
}
