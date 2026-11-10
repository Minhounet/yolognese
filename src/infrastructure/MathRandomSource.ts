import { RandomSource } from '../application/ports';

type Random = () => number;

/**
 * Math.random, unless the page defines `__yologneseRandom` first: the browser
 * checks script the game's chance through it (other code on the page calls
 * Math.random too, so scripting Math.random itself loses values).
 */
export class MathRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    const random = (globalThis as { __yologneseRandom?: Random }).__yologneseRandom ?? Math.random;
    return Math.floor(random() * maxExclusive);
  }
}
