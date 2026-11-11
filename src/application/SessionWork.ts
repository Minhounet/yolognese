import { GameRepository, Session } from './ports';

export interface Worked<T> {
  /** The session to save; undefined leaves it as it was. */
  readonly session?: Session;
  readonly result: T;
}

/**
 * Runs the use cases' work on the session one at a time: load, apply the rules,
 * save. The screen ticks every 100 ms while the player taps; with an asynchronous
 * repository (a remote table, device storage) two operations could otherwise
 * read the same session and the second save would drop the first one's change.
 * `settle` applies, after any change, the rules that follow from the new state
 * (a match's own rules, "steal the sauce").
 */
export class SessionWork {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly repository: GameRepository,
    private readonly settle: (session: Session) => Session = (session) => session,
  ) {}

  run<T>(work: (session: Session | undefined) => Worked<T>): Promise<T> {
    const done = this.queue.then(async () => {
      const loaded = await this.repository.load();
      const { session, result } = work(loaded);
      if (session !== undefined) await this.repository.save(this.settle(session));
      return result;
    });
    this.queue = done.catch(() => undefined);
    return done;
  }
}
