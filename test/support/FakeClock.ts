import { Clock } from '../../src/application/ports';

/** A clock the test moves by hand, in milliseconds. */
export class FakeClock implements Clock {
  private current = 0;

  now(): number {
    return this.current;
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }
}
