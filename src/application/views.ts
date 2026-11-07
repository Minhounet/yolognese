import { Code } from '../domain/color';

export interface TurnView {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface GameView {
  readonly status: 'won';
  readonly turns: readonly TurnView[];
}
