import { Code, COLORS, Color } from './color';

const MAX_ATTEMPTS = 10;
const MAX_LIFE = 10;
const LIFE_LOST_PER_MISS = 1;
const LIFE_LOST_WHEN_CAUGHT = 2;

export interface Turn {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface Game {
  readonly secret: Code;
  readonly turns: readonly Turn[];
  readonly penalties: number;
  readonly life: number;
}

export function newGame(secret: Code): Game {
  return { secret, turns: [], penalties: 0, life: MAX_LIFE };
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

export function play(game: Game, guess: Code): Game {
  const turn: Turn = {
    guess,
    exact: countExact(game, guess),
    misplaced: countMisplaced(game, guess),
  };
  return { ...game, turns: [...game.turns, turn], life: game.life - lifeLost(game, turn) };
}

function isWinningTurn(game: Game, { exact }: Turn): boolean {
  return exact === game.secret.length;
}

function lifeLost(game: Game, turn: Turn): number {
  return isWinningTurn(game, turn) ? 0 : LIFE_LOST_PER_MISS;
}

export function penalise(game: Game): Game {
  return { ...game, penalties: game.penalties + 1, life: game.life - LIFE_LOST_WHEN_CAUGHT };
}

export function isWon(game: Game): boolean {
  return game.turns.some((turn) => isWinningTurn(game, turn));
}

export function attemptsLeft(game: Game): number {
  return MAX_ATTEMPTS - game.turns.length - game.penalties;
}

export function isLost(game: Game): boolean {
  return !isWon(game) && (attemptsLeft(game) === 0 || isOutOfLife(game));
}

function isOutOfLife(game: Game): boolean {
  return game.life <= 0;
}

export function isOver(game: Game): boolean {
  return isWon(game) || isLost(game);
}
