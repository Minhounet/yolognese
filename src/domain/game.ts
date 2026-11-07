import { Code, COLORS, Color } from './color';

export interface Turn {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

export interface Game {
  readonly secret: Code;
  readonly turns: readonly Turn[];
}

export function newGame(secret: Code): Game {
  return { secret, turns: [] };
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
  return { ...game, turns: [...game.turns, turn] };
}
