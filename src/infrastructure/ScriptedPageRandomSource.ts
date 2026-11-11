import { RandomSource } from '../application/ports';

type Random = () => number;

/**
 * For the browser checks only (the composition root picks it when the web build
 * is made with EXPO_PUBLIC_SCRIPTED_CHANCE=1): reads `__yologneseRandom` when the
 * page defines it, so a check can script the game's chance; Math.random otherwise.
 */
export class ScriptedPageRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    const random = (globalThis as { __yologneseRandom?: Random }).__yologneseRandom ?? Math.random;
    return Math.floor(random() * maxExclusive);
  }
}
