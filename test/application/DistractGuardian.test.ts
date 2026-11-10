import { DistractGuardian, DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { StartGameImpl } from '../../src/application/StartGame';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

function startedGame(clock: FakeClock): DistractGuardian {
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return new DistractGuardianImpl(repository, clock);
}

describe('DistractGuardian', () => {
  it('shouldLookAtTarget_whenPointedAt', () => {
    const distractGuardian = startedGame(new FakeClock());

    const response = distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'distracted', view: { gaze: { x: 120, y: -40 } } });
  });

  it('shouldStayDistractedFor1500Ms_whenPointedAt', () => {
    const distractGuardian = startedGame(new FakeClock());

    const response = distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'distracted', view: { remainingMs: 1500 } });
  });
});
