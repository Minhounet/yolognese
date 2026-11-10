import { StartGameImpl } from '../../src/application/StartGame';
import { FakeClock } from '../support/FakeClock';
import { SubmitGuess, SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret indexes into COLORS: red=0 yellow=1 green=2 blue=3 purple=4 orange=5
const RED_YELLOW_GREEN_BLUE = [0, 1, 2, 3];

function startedGame(secretIndexes: readonly number[]): SubmitGuess {
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource(secretIndexes), repository, new FakeClock()).execute();
  return new SubmitGuessImpl(repository, new FakeClock());
}

describe('SubmitGuess', () => {
  it('shouldReportFourExact_whenGuessEqualsSecret', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'yellow', 'green', 'blue'], exact: 4, misplaced: 0 }] },
    });
  });

  it('shouldReportNothing_whenGuessSharesNoColour', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['purple', 'purple', 'orange', 'orange'], exact: 0, misplaced: 0 }] },
    });
  });

  it('shouldReportMisplaced_whenColoursAreInWrongPlaces', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['yellow', 'red', 'blue', 'green'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['yellow', 'red', 'blue', 'green'], exact: 0, misplaced: 4 }] },
    });
  });

  it('shouldCountColourOnce_whenSecretHoldsItOnce', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['red', 'red', 'yellow', 'yellow'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'red', 'yellow', 'yellow'], exact: 1, misplaced: 1 }] },
    });
  });

  it('shouldListGuessesInOrder_whenTwoGuessesPlayed', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);
    submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

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

  it('shouldMatchRepeatedColour_whenSecretHoldsItTwice', () => {
    const submitGuess = startedGame([0, 0, 2, 3]);

    const response = submitGuess.execute({ guess: ['red', 'green', 'green', 'green'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { turns: [{ guess: ['red', 'green', 'green', 'green'], exact: 2, misplaced: 0 }] },
    });
  });

  it('shouldBeWon_whenGuessEqualsSecret', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({ kind: 'played', view: { status: 'won' } });
  });

  it('shouldKeepPlaying_whenGuessMisses', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { status: 'playing' } });
  });

  it('shouldCountAttemptsLeft_whenGuessPlayed', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 9 } });
  });

  it('shouldBeLost_whenTenthGuessMisses', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    Array.from({ length: 9 }).forEach(() => submitGuess.execute(miss));

    const response = submitGuess.execute(miss);

    expect(response).toMatchObject({ kind: 'played', view: { status: 'lost', life: 0 } });
  });

  it('shouldRejectGuess_whenGameIsOver', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldRejectGuess_whenGameIsLost', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    Array.from({ length: 10 }).forEach(() => submitGuess.execute(miss));

    const response = submitGuess.execute(miss);

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldRevealSecret_whenGameIsOver', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldHideSecret_whenPlaying', () => {
    const submitGuess = startedGame(RED_YELLOW_GREEN_BLUE);

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response.kind === 'played' && response.view.secret).toBeUndefined();
  });
});
