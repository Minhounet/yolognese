import { Code, Color } from './color';

/** The row the player is composing: four slots, each a colour or empty. */
export type Draft = readonly (Color | undefined)[];

export const EMPTY_DRAFT: Draft = [undefined, undefined, undefined, undefined];

export function isComplete(draft: Draft): draft is Code {
  return draft.every((color) => color !== undefined);
}

/** Puts the colour in the first empty slot; a full row is unchanged. */
export function placeColor(draft: Draft, color: Color): Draft {
  const slot = draft.indexOf(undefined);
  return slot === -1 ? draft : draft.map((current, index) => (index === slot ? color : current));
}

export function clearSlot(draft: Draft, slot: number): Draft {
  return draft.map((current, index) => (index === slot ? undefined : current));
}

export function filledSlots(draft: Draft): readonly number[] {
  return draft.flatMap((color, slot) => (color === undefined ? [] : [slot]));
}

export function swapSlots(draft: Draft, first: number, second: number): Draft {
  return draft.map((color, slot) => (slot === first ? draft[second] : slot === second ? draft[first] : color));
}
