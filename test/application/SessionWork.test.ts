import { GameRepository, Session } from '../../src/application/ports';
import { SessionWork } from '../../src/application/SessionWork';
import { newRound } from '../../src/domain/round';
import { place } from '../../src/domain/round';

/** A repository that answers late, like a remote table. */
class SlowRepository implements GameRepository {
  private session: Session | undefined = newRound(['red', 'red', 'red', 'red'], 0, () => 0);

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
    const placeColor = (color: 'blue' | 'green') =>
      work.run((session) => (session === undefined ? { result: undefined } : { session: place(session, color), result: undefined }));

    await Promise.all([placeColor('blue'), placeColor('green')]);

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
});
