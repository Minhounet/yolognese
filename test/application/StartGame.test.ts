import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

describe('StartGame', () => {
  it('shouldStartWithTenLife_whenGameStarts', async () => {
    const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), new SessionWork(new InMemoryGameRepository()), new FakeClock());

    const view = await startGame.execute();

    expect(view).toMatchObject({ life: 10 });
  });

  it('shouldStartFreshGame_whenStartedAgain', async () => {
    const repository = new SessionWork(new InMemoryGameRepository());
    const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, new FakeClock());
    const submitGuess = new SubmitGuessImpl(repository);
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
