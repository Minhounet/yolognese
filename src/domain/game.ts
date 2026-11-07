import { Code, COLORS, Color } from './color';

export interface Game {
  readonly secret: Code;
}

export function countExact(game: Game, guess: Code): number {
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

export function countMisplaced(game: Game, guess: Code): number {
  return countSharedColours(game.secret, guess) - countExact(game, guess);
}
