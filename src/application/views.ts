import { Point } from '../domain/point';
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
  readonly life: number;
  readonly secret?: Code;
  readonly turns: readonly TurnView[];
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
