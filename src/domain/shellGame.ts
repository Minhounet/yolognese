/**
 * Round 15 (AC3): the shell game. A 🍝 is shown under one of three cups, the cups
 * cover it and swap places, then the player taps a cup: the 🍝 refills life.
 * Cups are counted by place on the table (0 left, 2 right); a swap exchanges the
 * cups at two places, so the 🍝 follows its cup.
 */
export const CUPS = 3;
export const SWAPS = 5;
export const SHOWN_MS = 1000;
export const SWAP_MS = 500;
export const PICK_MS = 5000;

export type Swap = readonly [number, number];

export interface ShellGame {
  /** The place of the 🍝's cup before the swaps. */
  readonly start: number;
  readonly swaps: readonly Swap[];
  readonly openedAt: number;
  /** The place tapped, once tapped. */
  readonly picked?: number;
}

/** Draws the 🍝's cup and the swaps: `draw(n)` answers 0..n-1. */
export function openShellGame(now: number, draw: (count: number) => number): ShellGame {
  const start = draw(CUPS);
  const swaps = Array.from({ length: SWAPS }, (): Swap => {
    const first = draw(CUPS);
    return [first, (first + 1 + draw(CUPS - 1)) % CUPS];
  });
  return { start, swaps, openedAt: now };
}

/** Where the 🍝 is after the swaps. */
export function sauceAt(shell: ShellGame): number {
  return shell.swaps.reduce((place, [a, b]) => (place === a ? b : place === b ? a : place), shell.start);
}

export const shuffledAt = (shell: ShellGame) => shell.openedAt + SHOWN_MS + SWAPS * SWAP_MS;
export const closesAt = (shell: ShellGame) => shuffledAt(shell) + PICK_MS;

export function canPick(shell: ShellGame, now: number): boolean {
  return shell.picked === undefined && now >= shuffledAt(shell) && now < closesAt(shell);
}

export function isFound(shell: ShellGame): boolean {
  return shell.picked !== undefined && shell.picked === sauceAt(shell);
}

/** How long the result stays on the table after a pick or the end of the time. */
export const RESULT_SHOWN_MS = 1500;
