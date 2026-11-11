import { Point } from '../domain/point';
import { Code, Color } from '../domain/color';

export interface TurnView {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface RevealedPegView {
  readonly index: number;
  readonly color: Color;
}

export interface GameView {
  readonly status: GameStatus;
  readonly life: number;
  readonly maxLife: number;
  readonly revealed: readonly RevealedPegView[];
  readonly secret?: Code;
  readonly turns: readonly TurnView[];
  readonly pegUp?: RevealedPegView;
  readonly playerBlind?: boolean;
  readonly draft: readonly (Color | undefined)[];
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
