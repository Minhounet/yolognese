/** Draws an integer in [0, maxExclusive): the only source of chance in the rules. */
export type Draw = (maxExclusive: number) => number;

/** The shield's lanes along the bottom of the screen. */
export const LANES = 3;

/** A meatball costs life; a fork steals a peg from the row being composed. */
export type AttackKind = 'meatball' | 'fork';
