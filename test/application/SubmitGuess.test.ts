import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret indexes into COLORS: red=0 yellow=1 green=2 blue=3 purple=4 orange=5
const RED_YELLOW_GREEN_BLUE = [0, 1, 2, 3];

async function startedGame(secretIndexes: readonly number[]): Promise<SubmitGuess> {
  const repository = new SessionWork(new InMemoryGameRepository());
  await new StartGameImpl(new ScriptedRandomSource(secretIndexes), repository, new FakeClock()).execute();
  return new SubmitGuessImpl(repository);
}

describe('SubmitGuess', () => {
  it('shouldReportFourExact_whenGuessEqualsSecret', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'yellow', 'green', 'blue'], exact: 4, misplaced: 0 }] },
    });
  });

  it('shouldReportNothing_whenGuessSharesNoColour', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['purple', 'purple', 'orange', 'orange'], exact: 0, misplaced: 0 }] },
    });
  });

  it('shouldReportMisplaced_whenColoursAreInWrongPlaces', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['yellow', 'red', 'blue', 'green'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['yellow', 'red', 'blue', 'green'], exact: 0, misplaced: 4 }] },
    });
  });

  it('shouldCountColourOnce_whenSecretHoldsItOnce', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['red', 'red', 'yellow', 'yellow'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'red', 'yellow', 'yellow'], exact: 1, misplaced: 1 }] },
    });
  });

  it('shouldListGuessesInOrder_whenTwoGuessesPlayed', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);
    await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: {
        turns: [
          { guess: ['purple', 'purple', 'orange', 'orange'], exact: 0, misplaced: 0 },
          { guess: ['red', 'yellow', 'green', 'blue'], exact: 4, misplaced: 0 },
        ],
      },
    });
  });

  it('shouldMatchRepeatedColour_whenSecretHoldsItTwice', async () => {
    const submitGuess = await startedGame([0, 0, 2, 3]);

    const response = await submitGuess.execute({ guess: ['red', 'green', 'green', 'green'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'green', 'green', 'green'], exact: 2, misplaced: 0 }] },
    });
  });

  it('shouldBeWon_whenGuessEqualsSecret', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({ kind: 'played', view: { status: 'won' } });
  });

  it('shouldKeepPlaying_whenGuessMisses', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { status: 'playing' } });
  });

  it('shouldLoseOneLife_whenGuessMisses', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 9 } });
  });

  it('shouldKeepLife_whenGuessWins', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 10 } });
  });

  it('shouldBeLost_whenTenthGuessMisses', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    for (let time = 0; time < 9; time += 1) await submitGuess.execute(miss);

    const response = await submitGuess.execute(miss);

    expect(response).toMatchObject({ kind: 'played', view: { status: 'lost', life: 0 } });
  });

  it('shouldRejectGuess_whenGameIsOver', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldRejectGuess_whenGameIsLost', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    for (let time = 0; time < 10; time += 1) await submitGuess.execute(miss);

    const response = await submitGuess.execute(miss);

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldRevealSecret_whenGameIsOver', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldHideSecret_whenPlaying', async () => {
    const submitGuess = await startedGame(RED_YELLOW_GREEN_BLUE);

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response.kind === 'played' && response.view.secret).toBeUndefined();
  });
});
