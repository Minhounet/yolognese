import { DistractGuardian, DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { StartGameImpl } from '../../src/application/StartGame';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

async function startedGame(clock: FakeClock): Promise<DistractGuardian> {
  const work = new SessionWork(new InMemoryGameRepository());
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), work, clock).execute();
  return new DistractGuardianImpl(work, clock);
}

describe('DistractGuardian', () => {
  it('shouldLookAtTarget_whenPointedAt', async () => {
    const distractGuardian = await startedGame(new FakeClock());

    const response = await distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'distracted', view: { gaze: { x: 120, y: -40 } } });
  });

  it('shouldStayDistractedFor1500Ms_whenPointedAt', async () => {
    const distractGuardian = await startedGame(new FakeClock());

    const response = await distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'distracted', view: { remainingMs: 1500 } });
  });
});
