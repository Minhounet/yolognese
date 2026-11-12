import { RandomSource } from '../application/ports';

/** Draws the configured values in turn, over and over, each kept below the draw's limit (the browser checks script draws with it). */
export class CycleRandomSource implements RandomSource {
  private next = 0;

  constructor(private readonly values: readonly number[]) {}

  nextInt(maxExclusive: number): number {
    const value = this.values[this.next++ % this.values.length];
    return value % maxExclusive;
  }
}
