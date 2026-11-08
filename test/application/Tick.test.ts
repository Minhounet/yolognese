import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startedGame() {
  const clock = new FakeClock();
  const repository = new InMemoryGameRepository();
  const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository);
  startGame.execute();
  return {
    clock,
    startGame,
    tick: new TickImpl(repository, clock),
    submitGuess: new SubmitGuessImpl(repository),
  };
}

describe('Tick', () => {
  it('shouldReportThreeMinutesLeft_whenFirstTick', () => {
    const { tick } = startedGame();

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 180000 });
  });

  it('shouldCountDown_whenTimePasses', () => {
    const { clock, tick } = startedGame();
    tick.execute();
    clock.advance(60000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 120000 });
  });

  it('shouldLoseAndRevealSecret_whenTimeRunsOut', () => {
    const { clock, tick } = startedGame();
    tick.execute();
    clock.advance(180000);

    const response = tick.execute();

    expect(response).toMatchObject({
      kind: 'ticked',
      timeLeftMs: 0,
      view: { status: 'lost', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldRejectGuess_whenTimeIsUp', () => {
    const { clock, tick, submitGuess } = startedGame();
    tick.execute();
    clock.advance(180000);
    tick.execute();

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });
});
