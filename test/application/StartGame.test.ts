import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

describe('StartGame', () => {
  it('shouldStartWithTenLife_whenGameStarts', () => {
    const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), new InMemoryGameRepository());

    const view = startGame.execute();

    expect(view).toMatchObject({ life: 10 });
  });

  it('shouldStartFreshGame_whenStartedAgain', () => {
    const repository = new InMemoryGameRepository();
    const startGame = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository);
    const submitGuess = new SubmitGuessImpl(repository);
    startGame.execute();
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    startGame.execute();

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({
      kind: 'played',
      view: { status: 'playing', life: 9, turns: [{ exact: 0, misplaced: 0 }] },
    });
  });
});
