import { COLORS, Code } from './color';
import { Draw } from './attack';
import { Turn } from './game';

/** Every possible sauce: 6 colours on 4 pegs, 1296 codes. */
export const ALL_CODES: readonly Code[] = COLORS.flatMap((a) =>
  COLORS.flatMap((b) => COLORS.flatMap((c) => COLORS.map((d): Code => [a, b, c, d]))),
);

function score(secret: Code, guess: Code): { readonly exact: number; readonly misplaced: number } {
  const exact = guess.filter((color, index) => color === secret[index]).length;
  const shared = COLORS.reduce(
    (total, color) => total + Math.min(secret.filter((s) => s === color).length, guess.filter((g) => g === color).length),
    0,
  );
  return { exact, misplaced: shared - exact };
}

/** The codes that would have given every answer seen so far. */
export function stillPossible(turns: readonly Turn[]): readonly Code[] {
  return ALL_CODES.filter((candidate) =>
    turns.every(({ guess, exact, misplaced }) => {
      const answer = score(candidate, guess);
      return answer.exact === exact && answer.misplaced === misplaced;
    }),
  );
}

/**
 * A test bot's next guess, easy to beat on purpose: one time in `1 / care` it
 * plays a code that fits what it learned, otherwise any code at all.
 * `care` 1 plays every guess with care (a good player); 0.5 is the default bot.
 */
export function nextGuess(turns: readonly Turn[], draw: Draw, care = 0.5): Code {
  const careful = draw(100) < care * 100;
  const pool = careful ? stillPossible(turns) : ALL_CODES;
  const choices = pool.length > 0 ? pool : ALL_CODES;
  return choices[draw(choices.length)];
}

/** The seat a player attacks: seat + 1 + rotation mod (n - 1), as the match server says. */
export function targetSeat(seat: number, rotation: number, players: number): number {
  return (seat + 1 + (rotation % Math.max(1, players - 1))) % players;
}
