import { Code } from './color';

export interface Game {
  readonly secret: Code;
}

export function countExact(game: Game, guess: Code): number {
  return guess.filter((color, position) => color === game.secret[position]).length;
}
