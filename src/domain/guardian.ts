export interface Guardian {
  readonly distractedUntil: number;
}

export const WATCHING: Guardian = { distractedUntil: 0 };

export function distractUntil(distractedUntil: number): Guardian {
  return { distractedUntil };
}

export function isDistracted(guardian: Guardian, now: number): boolean {
  return now < guardian.distractedUntil;
}
