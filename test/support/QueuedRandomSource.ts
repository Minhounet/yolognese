import { RandomSource } from '../../src/application/ports';

/** Returns the queued values in order, then 0: a test queues the draws it cares about just before the action. */
export class QueuedRandomSource implements RandomSource {
  private readonly values: number[] = [];

  queue(...values: number[]): void {
    this.values.push(...values);
  }

  nextInt(): number {
    return this.values.shift() ?? 0;
  }
}
