import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
async function startedGame() {
  const clock = new FakeClock();
  const work = new SessionWork(new InMemoryGameRepository());
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), work, clock).execute();
  return {
    clock,
    distractGuardian: new DistractGuardianImpl(work, clock),
    peekSecret: new PeekSecretImpl(work, clock),
    submitGuess: new SubmitGuessImpl(work, clock),
  };
}

const AWAY = { target: { x: 150, y: -60 } };

describe('PeekSecret', () => {
  it('shouldRevealColour_whenPeekingWhileDistracted', async () => {
    const { distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'revealed', index: 2, color: 'green' });
  });

  it('shouldBeCaught_whenPeekingWhileWatched', async () => {
    const { peekSecret } = await startedGame();

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldBeCaught_whenPeekingAfterDistractionEnds', async () => {
    const { clock, distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    clock.advance(1500);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldRevealColour_justBeforeDistractionEnds', async () => {
    const { clock, distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    clock.advance(1499);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', index: 0, color: 'red' });
  });

  it('shouldCostTwoLife_whenCaught', async () => {
    const { peekSecret } = await startedGame();

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 8 } });
  });

  it('shouldLoseGame_whenCaughtOnLastAttempt', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    for (let time = 0; time < 9; time += 1) await submitGuess.execute(miss);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { status: 'lost', life: 0 } });
  });

  it('shouldRejectPeek_whenGameIsOver', async () => {
    const { distractGuardian, peekSecret, submitGuess } = await startedGame();
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldKeepPenalty_whenGuessingAfterBeingCaught', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    await peekSecret.execute({ index: 2 });

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 7 } });
  });
});
