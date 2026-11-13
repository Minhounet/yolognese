import { Color } from './color';

/**
 * Round 15 (AC4-AC7): the taunt duel. The taunter says one insult; the taunted
 * has ANSWER_MS to pick a comeback. Each insult has its own comeback (the same
 * number): picking it wins the duel for the taunted, anything else (or nothing)
 * for the taunter. The winner then forces one penalty on the loser.
 * The lines themselves are the screen's (ui/insults.ts): the rules only count.
 */
export const INSULT_COUNT = 8;
export const INSULTS_OFFERED = 3;
export const COMEBACKS_OFFERED = 3;
export const ANSWER_MS = 5000;

export type Penalty = 'peg' | 'life' | 'scramble' | 'flip' | 'dizzy';
/** The penalties of a match (the server draws one). */
export const MATCH_PENALTIES: readonly Penalty[] = ['peg', 'life', 'scramble', 'flip'];
/** Solo: what the guardian suffers when it loses, and what the player suffers. */
export const GUARDIAN_PENALTIES: readonly Penalty[] = ['peg', 'life', 'dizzy'];
export const PLAYER_PENALTIES: readonly Penalty[] = ['life', 'scramble', 'flip'];

export const LIFE_GIVEN = 2;
export const PEG_SHOWN_MS = 3000;
export const SCRAMBLE_MS = 10_000;
export const FLIP_MS = 8000;
export const DIZZY_MS = 4000;

/** Solo: the guardian picks its own comeback 1 time in GUARDIAN_ODDS, after 1 to 3 s. */
export const GUARDIAN_ODDS = 3;
export const GUARDIAN_ANSWER_MIN_MS = 1000;
export const GUARDIAN_ANSWER_SPREAD_MS = 2001;
/** Solo (AC6): the guardian taunts every 40 to 70 s. */
export const GUARDIAN_TAUNT_MIN_MS = 40_000;
export const GUARDIAN_TAUNT_SPREAD_MS = 30_001;

export const isRightComeback = (insult: number, comeback: number | undefined) => comeback === insult;

/** `count` different numbers below `max`, drawn one by one: `draw(n)` answers 0..n-1. */
export function drawDistinct(count: number, max: number, draw: (n: number) => number): readonly number[] {
  const pool = Array.from({ length: max }, (_, index) => index);
  return Array.from({ length: Math.min(count, max) }, () => pool.splice(draw(pool.length), 1)[0]);
}

/** The comebacks offered for an insult: its own and two others, in a drawn order. */
export function comebacksFor(insult: number, draw: (n: number) => number): readonly number[] {
  const others = drawDistinct(COMEBACKS_OFFERED - 1, INSULT_COUNT - 1, draw).map((other) => (other >= insult ? other + 1 : other));
  const place = draw(COMEBACKS_OFFERED);
  return [...others.slice(0, place), insult, ...others.slice(place)];
}

export function drawPenalty(penalties: readonly Penalty[], draw: (n: number) => number): Penalty {
  return penalties[draw(penalties.length)];
}

/** A permutation of the palette (`map[i]` is placed when colour i is tapped), never leaving all in place. */
export function drawScramble(colors: number, draw: (n: number) => number): readonly number[] {
  const shift = 1 + draw(colors - 1);
  return Array.from({ length: colors }, (_, index) => (index + shift) % colors);
}

/** A duel as the server settled it (a match). */
export interface DuelOutcome {
  readonly id: string;
  readonly taunter: string;
  readonly target: string;
  readonly winner: string;
  readonly penalty: Penalty;
  /** A 🔍 penalty: the peg shown to the winner, only in the answer to the winner. */
  readonly peg?: { readonly index: number; readonly color: Color };
}

/** A draw seeded by text (a duel's id): the same id gives every phone the same order, and no RandomSource is needed. */
export function seededDraw(seed: string): (n: number) => number {
  let state = 0;
  for (const char of seed) state = (Math.imul(state, 31) + char.charCodeAt(0)) >>> 0;
  return (n: number) => {
    state = (Math.imul(state ^ (state >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    return state % n;
  };
}
