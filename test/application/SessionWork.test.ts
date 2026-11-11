import { GameRepository, Session } from '../../src/application/ports';
import { SessionWork } from '../../src/application/SessionWork';
import { EMPTY_DRAFT, placeColor } from '../../src/domain/draft';
import { newGame } from '../../src/domain/game';
import { WATCHING } from '../../src/domain/guardian';

/** A repository that answers late, like a remote table. */
class SlowRepository implements GameRepository {
  private session: Session | undefined = {
    game: newGame(['red', 'red', 'red', 'red']),
    guardian: WATCHING,
    peekReadyAt: 0,
    endsAt: 180_000,
    draft: EMPTY_DRAFT,
  };

  async load(): Promise<Session | undefined> {
    await new Promise((resolve) => setTimeout(resolve, 5));
    return this.session;
  }

  async save(session: Session): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 5));
    this.session = session;
  }
}

describe('SessionWork', () => {
  it('shouldKeepBothChanges_whenTwoOperationsOverlap', async () => {
    const repository = new SlowRepository();
    const work = new SessionWork(repository);
    const place = (color: 'blue' | 'green') =>
      work.run((session) => (session === undefined ? { result: undefined } : { session: { ...session, draft: placeColor(session.draft ?? EMPTY_DRAFT, color) }, result: undefined }));

    await Promise.all([place('blue'), place('green')]);

    expect((await repository.load())?.draft).toEqual(['blue', 'green', undefined, undefined]);
  });

  it('shouldGoOn_whenOneOperationFails', async () => {
    const work = new SessionWork(new SlowRepository());
    const failing = work.run(() => {
      throw new Error('broken rule');
    });

    await expect(failing).rejects.toThrow('broken rule');
    await expect(work.run(() => ({ result: 'still working' }))).resolves.toBe('still working');
  });

  it('shouldApplyTheSettleRules_toEverySavedChange', async () => {
    const repository = new SlowRepository();
    const work = new SessionWork(repository, (session) => ({ ...session, peekReadyAt: 42 }));

    await work.run((session) => ({ session, result: undefined }));

    expect((await repository.load())?.peekReadyAt).toBe(42);
  });
});
