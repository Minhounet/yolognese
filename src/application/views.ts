import { Point } from '../domain/point';
import { Code, Color } from '../domain/color';
import { Penalty } from '../domain/duel';
import { Swap } from '../domain/shellGame';

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
  /** Round 15 (AC2): the action bar: charges as a fraction (0 to 3), and the time until it is full. */
  readonly bar?: BarView;
  /** Round 15 (AC3): the shell game on the table. */
  readonly shell?: ShellView;
  /** Round 15 (AC4): the duel this player is in, and the last verdict while it is fresh (AC5). */
  readonly duel?: DuelView;
  readonly duelResult?: DuelResultView;
  /** Round 15 (AC5): the palette lies; the screen is upside down. */
  readonly scrambled?: boolean;
  readonly flipped?: boolean;
}

export interface BarView {
  readonly charges: number;
  readonly fullInMs: number;
  /** What each action costs, and whether it can be paid now. */
  readonly canShell: boolean;
  readonly canTaunt: boolean;
}

export interface ShellView {
  /** The 🍝's place before the swaps, and the swaps: the screen moves the cups itself. */
  readonly start: number;
  readonly swaps: readonly Swap[];
  /** Since it was opened. */
  readonly elapsedMs: number;
  readonly canPick: boolean;
  /** Once over: the place tapped (if any), the 🍝's place, and whether it was found. */
  readonly over?: { readonly picked?: number; readonly sauceAt: number; readonly found: boolean };
}

export type DuelView =
  | { readonly phase: 'choosing'; readonly offered: readonly number[] }
  | { readonly phase: 'waiting'; readonly insult: number; readonly opponent: string }
  | { readonly phase: 'answering'; readonly insult: number; readonly from: string; readonly choices: readonly number[]; readonly leftMs: number; readonly answered?: number };

export interface DuelResultView {
  readonly won: boolean;
  readonly penalty: Penalty;
  /** The opponent's name ("the guardian" in solo). */
  readonly opponent: string;
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
