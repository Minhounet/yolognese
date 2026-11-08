import { DistractGuardian, DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// the guardian's luck draw: 1 is fooled, 0 sees through it
const FOOLED = 1;
const SEES_THROUGH = 0;

function startedGame(clock: FakeClock, luck: readonly number[] = [FOOLED]): DistractGuardian {
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return new DistractGuardianImpl(repository, clock, new ScriptedRandomSource(luck));
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

  it('shouldPunchPlayer_whenDistractionFails', () => {
    const distractGuardian = startedGame(new FakeClock(), [SEES_THROUGH]);

    const response = distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toMatchObject({ kind: 'punched', view: { life: 9 } });
  });

  it('shouldNotPunch_whenGameIsOver', () => {
    const clock = new FakeClock();
    const repository = new InMemoryGameRepository();
    new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
    new SubmitGuessImpl(repository).execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    const distractGuardian = new DistractGuardianImpl(repository, clock, new ScriptedRandomSource([SEES_THROUGH]));

    const response = distractGuardian.execute({ target: { x: 120, y: -40 } });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });
});
