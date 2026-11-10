export interface Guardian {
  readonly distractedUntil: number;
  /** Until when a smoke bomb blinds it: peeks are safe, it cannot attack. */
  readonly blindUntil: number;
}

export const WATCHING: Guardian = { distractedUntil: 0, blindUntil: 0 };

export function distractUntil(guardian: Guardian, distractedUntil: number): Guardian {
  return { ...guardian, distractedUntil };
}

export function blindUntil(guardian: Guardian, until: number): Guardian {
  return { ...guardian, blindUntil: until };
}

export function isDistracted(guardian: Guardian, now: number): boolean {
  return now < guardian.distractedUntil;
}

export function isBlind(guardian: Guardian, now: number): boolean {
  return now < guardian.blindUntil;
}

/** It sees the hidden row only when neither distracted nor blind. */
export function isWatching(guardian: Guardian, now: number): boolean {
  return !isDistracted(guardian, now) && !isBlind(guardian, now);
}
