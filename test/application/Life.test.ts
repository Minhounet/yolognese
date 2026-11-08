import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startGame() {
  const repository = new InMemoryGameRepository();
  const view = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository).execute();
  return { repository, view, submitGuess: new SubmitGuessImpl(repository) };
}

describe('Life', () => {
  it('shouldStartWithTenLife_whenGameStarts', () => {
    const { view } = startGame();

    expect(view.life).toBe(10);
  });

  it('shouldLoseOneLife_whenGuessMisses', () => {
    const { submitGuess } = startGame();

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 9 } });
  });
});
