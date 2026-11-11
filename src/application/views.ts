import { Code, Color } from '../domain/color';
import { AttackKind, ItemKind, NoticeKind } from '../domain/round';
import { Point } from '../domain/point';

export interface TurnView {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export type GameStatus = 'playing' | 'won' | 'lost';

export interface ItemView {
  readonly id: number;
  readonly kind: ItemKind;
  readonly x: number;
  readonly y: number;
}

export interface AttackView {
  readonly kind: AttackKind;
  readonly lane: number;
  readonly msToLand: number;
  /** Race: the rival who threw it. */
  readonly fromName?: string;
}

export interface RivalView {
  readonly name: string;
  readonly life: number;
  readonly bestExact: number;
  readonly out: boolean;
  readonly cracked: boolean;
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
  /** The attacker's best count of right-place pegs on this player's secret. */
  readonly threat: number;
  /** Undefined until the server has told this phone. */
  readonly mySecret?: Code;
  /** Highest points first. */
  readonly scores: readonly ScoreView[];
  /** Until the circle turns; undefined with two players (no one else to turn to). */
  readonly switchInMs?: number;
  readonly finished: boolean;
}

export interface RaceView {
  readonly rivals: readonly RivalView[];
  readonly beatenBy?: string;
}

export interface GameView {
  readonly status: GameStatus;
  /** Why a lost game was lost. */
  readonly lostBy?: 'life' | 'time' | 'beaten';
  /** Race: won as the last player still in. */
  readonly lastStanding: boolean;
  readonly life: number;
  readonly maxLife: number;
  readonly secret?: Code;
  readonly turns: readonly TurnView[];
  readonly draft: readonly (Color | undefined)[];
  readonly timeLeftMs: number;
  readonly cooldownMs: number;
  readonly blindMs: number;
  /** A peg the x-ray glasses show, for a moment. */
  readonly xray?: { readonly index: number; readonly color: Color };
  readonly items: readonly ItemView[];
  readonly attack?: AttackView;
  readonly shieldLane: number;
  readonly charm: boolean;
  /** What just happened (an item's effect, an attack's outcome), while it is fresh. */
  readonly notice?: NoticeKind;
  /** A peg a peek showed, when the server holds the secret; shown briefly. */
  readonly reveal?: { readonly index: number; readonly color: Color };
  /** A guess the server has not scored yet. */
  readonly pendingGuess?: Code;
  readonly race?: RaceView;
  readonly steal?: StealView;
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
