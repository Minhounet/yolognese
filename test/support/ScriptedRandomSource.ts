import { RandomSource } from '../../src/application/ports';

/** Returns the scripted values in order; the secret's colours, as indexes into COLORS. */
export class ScriptedRandomSource implements RandomSource {
  private position = 0;

  constructor(private readonly values: readonly number[]) {}

  nextInt(): number {
    const value = this.values[this.position % this.values.length];
    this.position += 1;
    return value;
  }
}
