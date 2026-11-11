import { Code, COLORS, Color } from './color';

export const MAX_LIFE = 10;
export const CODE_LENGTH = 4;
const STARTING_LIFE = MAX_LIFE;
const LIFE_LOST_PER_MISS = 1;
const LIFE_LOST_WHEN_CAUGHT = 2;
const LIFE_LOST_WHEN_PUNCHED = 1;
const LIFE_LOST_WHEN_BOMB_EXPLODES = 2;
const LIFE_RESTORED_BY_FOOD = 3;
const MIN_LIFE = 0;

export interface Turn {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface Game {
  /** Undefined when the server holds it ("steal the sauce"): guesses are scored there. */
  readonly secret?: Code;
  readonly turns: readonly Turn[];
  readonly life: number;
  readonly revealed: readonly number[];
}

export function newGame(secret?: Code): Game {
  return { secret, turns: [], life: STARTING_LIFE, revealed: [] };
}

function secretOf(game: Game): Code {
  if (game.secret === undefined) throw new Error('this secret is held by the server');
  return game.secret;
}

function countExact(game: Game, guess: Code): number {
  const secret = secretOf(game);
  return guess.filter((color, position) => color === secret[position]).length;
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
  return countSharedColours(secretOf(game), guess) - countExact(game, guess);
}

function cracksCode(turn: Turn): boolean {
  return turn.exact === CODE_LENGTH;
}

/** Adds a scored guess; one that does not crack the code costs a life. */
export function record(game: Game, turn: Turn): Game {
  const life = cracksCode(turn) ? game.life : game.life - LIFE_LOST_PER_MISS;
  return { ...game, turns: [...game.turns, turn], life };
}

/** Scores a guess against the secret this phone holds, and records it. */
export function play(game: Game, guess: Code): Game {
  return record(game, { guess, exact: countExact(game, guess), misplaced: countMisplaced(game, guess) });
}

export function penalise(game: Game): Game {
  const life = Math.max(MIN_LIFE, game.life - LIFE_LOST_WHEN_CAUGHT);
  return { ...game, life };
}

export function punch(game: Game): Game {
  return { ...game, life: game.life - LIFE_LOST_WHEN_PUNCHED };
}

export function explode(game: Game): Game {
  return { ...game, life: Math.max(MIN_LIFE, game.life - LIFE_LOST_WHEN_BOMB_EXPLODES) };
}

export function restoreLife(game: Game): Game {
  return { ...game, life: Math.min(MAX_LIFE, game.life + LIFE_RESTORED_BY_FOOD) };
}

export function hiddenPegs(game: Game): readonly number[] {
  return Array.from({ length: CODE_LENGTH }, (_, index) => index).filter((index) => !game.revealed.includes(index));
}

export function revealPeg(game: Game, index: number): Game {
  return { ...game, revealed: [...game.revealed, index] };
}

export function timeUp(game: Game): Game {
  return { ...game, life: MIN_LIFE };
}

export function isWon(game: Game): boolean {
  return game.turns.some(cracksCode);
}

export function isLost(game: Game): boolean {
  return !isWon(game) && game.life <= 0;
}

export function isOver(game: Game): boolean {
  return isWon(game) || isLost(game);
}
