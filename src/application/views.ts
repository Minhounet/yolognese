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
}

export interface GameView {
  readonly status: GameStatus;
  /** Why a lost game was lost. */
  readonly lostBy?: 'life' | 'time';
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
}

export interface GuardianView {
  readonly gaze: Point;
  readonly remainingMs: number;
}
