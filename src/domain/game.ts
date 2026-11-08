import { Code, COLORS, Color } from './color';

const STARTING_LIFE = 10;
const LIFE_LOST_PER_MISS = 1;
const LIFE_LOST_WHEN_CAUGHT = 2;
const LIFE_RESTORED_BY_FOOD = 3;
const MIN_LIFE = 0;

export interface Turn {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface Game {
  readonly secret: Code;
  readonly turns: readonly Turn[];
  readonly life: number;
}

export function newGame(secret: Code): Game {
  return { secret, turns: [], life: STARTING_LIFE };
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

function cracksCode(game: Game, turn: Turn): boolean {
  return turn.exact === game.secret.length;
}

export function play(game: Game, guess: Code): Game {
  const turn: Turn = {
    guess,
    exact: countExact(game, guess),
    misplaced: countMisplaced(game, guess),
  };
  const life = cracksCode(game, turn) ? game.life : game.life - LIFE_LOST_PER_MISS;
  return { ...game, turns: [...game.turns, turn], life };
}

export function penalise(game: Game): Game {
  const life = Math.max(MIN_LIFE, game.life - LIFE_LOST_WHEN_CAUGHT);
  return { ...game, life };
}

export function restoreLife(game: Game): Game {
  return { ...game, life: game.life + LIFE_RESTORED_BY_FOOD };
}

export function timeUp(game: Game): Game {
  return { ...game, life: MIN_LIFE };
}

export function isWon(game: Game): boolean {
  return game.turns.some((turn) => cracksCode(game, turn));
}

export function isLost(game: Game): boolean {
  return !isWon(game) && game.life <= 0;
}

export function isOver(game: Game): boolean {
  return isWon(game) || isLost(game);
}
