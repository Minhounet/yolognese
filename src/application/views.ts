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

export interface ScoreView {
  readonly name: string;
  readonly points: number;
  readonly me: boolean;
}

/** "Steal the sauce": whose sauce this player is after, who is after its own, and the scores. */
export interface StealView {
  readonly target: string;
  readonly attacker: string;
  /** The attacker's best count of right-place pegs on this player's sauce. */
  readonly threat: number;
  /** Undefined until the server has told this phone. */
  readonly mySecret?: Code;
  /** Highest points first. */
  readonly scores: readonly ScoreView[];
  /** Until the circle turns; undefined with two players (no one else to turn to). */
  readonly switchInMs?: number;
  readonly finished: boolean;
  /** What just happened, while it is fresh. */
  readonly notice?: 'switch' | 'robbed' | 'scored' | 'knocked-out' | 'inked' | 'ink-thrown';
  /** Round 14: the latest guesses rivals made on this player's sauce, newest last. */
  readonly attempts: readonly { readonly by: string; readonly guess: Code; readonly exact: number; readonly misplaced: number }[];
  /** Round 14: ink a rival threw on this player's screen, and how much is left to wipe (1 → 0). */
  readonly ink?: { readonly by: string; readonly left: number };
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
  readonly steal?: StealView;
  /** "Steal the sauce": a guess the server has not scored yet. */
  readonly pendingGuess?: Code;
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
