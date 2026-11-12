/**
 * Round 15 (AC2): the action bar. It holds up to MAX_CHARGES charges, one refilled
 * every CHARGE_MS; a peek costs 1, the shell game 2, a taunt 3. The session keeps
 * one time, `readyAt`: when the first charge is (or was) ready. Before it the bar
 * is empty; each CHARGE_MS after it adds a charge, up to the full bar.
 */
export const CHARGE_MS = 5000;
export const MAX_CHARGES = 3;

export const ACTION_COSTS = { peek: 1, shell: 2, taunt: 3 } as const;
export type Action = keyof typeof ACTION_COSTS;

/** The charges at `now`, as a fraction (2.4: two charges and most of a third); 0 before `readyAt`. */
export function chargesAt(readyAt: number, now: number): number {
  if (now < readyAt) return Math.max(0, 1 - (readyAt - now) / CHARGE_MS);
  return Math.min(MAX_CHARGES, 1 + (now - readyAt) / CHARGE_MS);
}

export function canAfford(readyAt: number, now: number, cost: number): boolean {
  return Math.floor(chargesAt(readyAt, now) + 1e-9) >= cost;
}

/** The new `readyAt` after spending `cost` charges (a full bar refills no further). */
export function spend(readyAt: number, now: number, cost: number): number {
  const fullSince = now - (MAX_CHARGES - 1) * CHARGE_MS;
  return Math.max(readyAt, fullSince) + cost * CHARGE_MS;
}

/** Caught peeking: the bar is emptied. */
export function emptied(now: number): number {
  return now + CHARGE_MS;
}

/** How long until the bar is full again. */
export function fullInMs(readyAt: number, now: number): number {
  return Math.max(0, readyAt + (MAX_CHARGES - 1) * CHARGE_MS - now);
}

/** A new game starts with a full bar. */
export function fullBar(now: number): number {
  return now - (MAX_CHARGES - 1) * CHARGE_MS;
}
