import { RandomSource } from '../application/ports';

export class MathRandomSource implements RandomSource {
  nextInt(maxExclusive: number): number {
    return Math.floor(Math.random() * maxExclusive);
  }
}
