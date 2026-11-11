import { Code, Color } from './color';

/** The row the player is composing: four slots, each a colour or empty. */
export type Draft = readonly (Color | undefined)[];

export const EMPTY_DRAFT: Draft = [undefined, undefined, undefined, undefined];

export function isComplete(draft: Draft): draft is Code {
  return draft.every((color) => color !== undefined);
}

/** Puts the colour in the given slot, or in the first empty one; a full row is unchanged. */
export function placeColor(draft: Draft, color: Color, slot?: number): Draft {
  const target = slot ?? draft.indexOf(undefined);
  return target === -1 ? draft : draft.map((current, index) => (index === target ? color : current));
}

export function clearSlot(draft: Draft, slot: number): Draft {
  return draft.map((current, index) => (index === slot ? undefined : current));
}

export function filledSlots(draft: Draft): readonly number[] {
  return draft.flatMap((color, slot) => (color === undefined ? [] : [slot]));
}

/** AC33: two placed pegs switch places; `first` and `second` pick among the placed ones. Fewer than two: unchanged. */
export function switchTwo(draft: Draft, pick: (count: number) => number): Draft {
  const filled = filledSlots(draft);
  if (filled.length < 2) return draft;
  const first = pick(filled.length);
  const second = (first + 1 + pick(filled.length - 1)) % filled.length;
  const [a, b] = [filled[first], filled[second]];
  return draft.map((color, slot) => (slot === a ? draft[b] : slot === b ? draft[a] : color));
}

/** AC34: the fork takes one placed peg, picked among the placed ones. None placed: unchanged. */
export function stealOne(draft: Draft, pick: (count: number) => number): Draft {
  const filled = filledSlots(draft);
  return filled.length === 0 ? draft : clearSlot(draft, filled[pick(filled.length)]);
}
