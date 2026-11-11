import { Scheduler } from '../application/ports';

export class TimeoutScheduler implements Scheduler {
  after(ms: number, task: () => void): () => void {
    const timer = setTimeout(task, ms);
    return () => clearTimeout(timer);
  }
}
