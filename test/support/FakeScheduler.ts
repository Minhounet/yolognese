import { Scheduler } from '../../src/application/ports';
import { FakeClock } from './FakeClock';

/** Runs the tasks when the test moves the fake clock past their time. */
export class FakeScheduler implements Scheduler {
  private tasks: { readonly at: number; readonly task: () => void }[] = [];

  constructor(private readonly clock: FakeClock) {}

  after(ms: number, task: () => void): () => void {
    const entry = { at: this.clock.now() + ms, task };
    this.tasks.push(entry);
    return () => {
      this.tasks = this.tasks.filter((other) => other !== entry);
    };
  }

  /** Moves the clock 100 ms at a time, running what falls due and letting it settle. */
  async advance(ms: number, settle: () => Promise<void>): Promise<void> {
    for (let passed = 0; passed < ms; passed += 100) {
      this.clock.advance(100);
      const due = this.tasks.filter(({ at }) => at <= this.clock.now());
      this.tasks = this.tasks.filter((entry) => !due.includes(entry));
      due.forEach(({ task }) => task());
      if (due.length > 0) await settle();
    }
  }

  get pending(): number {
    return this.tasks.length;
  }
}
