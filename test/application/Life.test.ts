import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startGame() {
  const repository = new InMemoryGameRepository();
  const view = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository).execute();
  return {
    view,
    submitGuess: new SubmitGuessImpl(repository),
    peekSecret: new PeekSecretImpl(repository, new FakeClock()),
  };
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

  it('shouldKeepLife_whenGuessWins', () => {
    const { submitGuess } = startGame();

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 10 } });
  });

  it('shouldLoseTwoLife_whenCaught', () => {
    const { peekSecret } = startGame();

    const response = peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 8 } });
  });
});
