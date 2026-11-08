import { RandomSource } from '../application/ports';

/** Always draws the same value: a configured outcome (the browser checks fix the guardian's luck with it). */
export class FixedRandomSource implements RandomSource {
  constructor(private readonly value: number) {}

  nextInt(): number {
    return this.value;
  }
}
