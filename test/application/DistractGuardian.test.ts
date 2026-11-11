import { DistractGuardian, DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// the guardian's luck draw: 1 is fooled, 0 sees through it; after a 0, the next draw is the punch's lane
const FOOLED = 1;
const SEES_THROUGH = 0;

async function startedGame(clock: FakeClock, luck: readonly number[] = [FOOLED]): Promise<DistractGuardian> {
  const repository = new SessionWork(new InMemoryGameRepository());
  await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return new DistractGuardianImpl(repository, clock, new ScriptedRandomSource(luck));
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

  it('shouldPunchPlayer_whenDistractionFails', async () => {
    const distractGuardian = await startedGame(new FakeClock(), [SEES_THROUGH]);

    const response = await distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'punched', punch: { lane: 0 }, view: { life: 10 } });
  });

  it('shouldNotPunch_whenGameIsOver', async () => {
    const clock = new FakeClock();
    const repository = new SessionWork(new InMemoryGameRepository());
    await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
    await new SubmitGuessImpl(repository).execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    const distractGuardian = new DistractGuardianImpl(repository, clock, new ScriptedRandomSource([SEES_THROUGH]));

    const response = await distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldNotThrowPunch_whenMeatballIsFalling', async () => {
    const clock = new FakeClock();
    const repository = new SessionWork(new InMemoryGameRepository());
    await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
    const tick = new TickImpl(repository, clock, new ScriptedRandomSource([0, 2]), new ScriptedRandomSource([30000]));
    const distractGuardian = new DistractGuardianImpl(repository, clock, new ScriptedRandomSource([SEES_THROUGH]));
    await tick.execute();
    clock.advance(10000);
    await tick.execute();

    const response = await distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response.kind === 'punched' && response.punch).toBeFalsy();
  });
});
