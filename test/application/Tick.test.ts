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
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return { clock, tick: new TickImpl(repository, clock), submitGuess: new SubmitGuessImpl(repository) };
}

describe('Tick', () => {
  it('shouldCountDownTimeLeft_whenTicked', () => {
    const { clock, tick } = startedGame();
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 179000 });
  });

  it('shouldBeLost_whenTimeIsUp', () => {
    const { clock, tick } = startedGame();
    clock.advance(180000);

    const response = tick.execute();

    expect(response).toMatchObject({
      kind: 'ticked',
      view: { status: 'lost', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldStopTimeAtZero_whenTimeIsUp', () => {
    const { clock, tick } = startedGame();
    clock.advance(200000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 0 });
  });

  it('shouldStayWon_whenTimeRunsOutAfterWinning', () => {
    const { clock, submitGuess, tick } = startedGame();
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    clock.advance(180000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { status: 'won' } });
  });
});
