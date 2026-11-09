export interface Guardian {
  readonly distractedUntil: number;
  readonly blindUntil?: number;
}

export const WATCHING: Guardian = { distractedUntil: 0 };

export function distractUntil(distractedUntil: number): Guardian {
  return { distractedUntil };
}

export function distract(guardian: Guardian, now: number, until: number): Guardian {
  return isBlind(guardian, now) ? guardian : distractUntil(until);
}

export function blindUntil(until: number): Guardian {
  return { distractedUntil: until, blindUntil: until };
}

export function isBlind(guardian: Guardian, now: number): boolean {
  return guardian.blindUntil !== undefined && now < guardian.blindUntil;
}

export function isDistracted(guardian: Guardian, now: number): boolean {
  return now < guardian.distractedUntil;
}
