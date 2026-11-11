import { StartGameImpl } from '../../src/application/StartGame';
import { FakeClock } from '../support/FakeClock';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

describe('StartGame', () => {
  it('shouldStartFreshGame_whenStartedAgain', async () => {
    const work = new SessionWork(new InMemoryGameRepository());
    const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), work, new FakeClock());
    const submitGuess = new SubmitGuessImpl(work, new FakeClock());
    await startGame.execute();
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    await startGame.execute();

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { status: 'playing', life: 9, turns: [{ exact: 0, misplaced: 0 }] },
    });
  });
});
