import { Code, COLORS, Color } from './color';

export const MAX_LIFE = 10;

export interface Turn {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface Game {
  readonly secret: Code;
  readonly turns: readonly Turn[];
  readonly life: number;
  readonly outOfTime: boolean;
  /** Race: a rival cracked the code first. */
  readonly beaten: boolean;
  /** Race: every rival is out, so this player wins. */
  readonly lastStanding: boolean;
}

export function newGame(secret: Code): Game {
  return { secret, turns: [], life: MAX_LIFE, outOfTime: false, beaten: false, lastStanding: false };
}

function countExact(game: Game, guess: Code): number {
  return guess.filter((color, position) => color === game.secret[position]).length;
}

function occurrences(code: Code, color: Color): number {
  return code.filter((candidate) => candidate === color).length;
}

function countSharedColours(secret: Code, guess: Code): number {
  return COLORS.reduce(
    (total, color) => total + Math.min(occurrences(secret, color), occurrences(guess, color)),
    0,
  );
}

function countMisplaced(game: Game, guess: Code): number {
  return countSharedColours(game.secret, guess) - countExact(game, guess);
}

export function hurt(game: Game, amount: number): Game {
  return { ...game, life: Math.max(0, game.life - amount) };
}

export function heal(game: Game, amount: number): Game {
  return { ...game, life: Math.min(MAX_LIFE, game.life + amount) };
}

export function runOutOfTime(game: Game): Game {
  return { ...game, outOfTime: true };
}

export function isCracked(game: Game): boolean {
  return game.turns.some(({ exact }) => exact === game.secret.length);
}

export function isWon(game: Game): boolean {
  return isCracked(game) || game.lastStanding;
}

export function bestExact(game: Game): number {
  return Math.max(0, ...game.turns.map(({ exact }) => exact));
}

/** A guess that does not win costs 1 life. */
export function play(game: Game, guess: Code): Game {
  const turn: Turn = {
    guess,
    exact: countExact(game, guess),
    misplaced: countMisplaced(game, guess),
  };
  const played = { ...game, turns: [...game.turns, turn] };
  return isWon(played) ? played : hurt(played, 1);
}

export function isLost(game: Game): boolean {
  return !isWon(game) && (game.life === 0 || game.outOfTime || game.beaten);
}

export function isOver(game: Game): boolean {
  return isWon(game) || isLost(game);
}
