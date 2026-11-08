import { StartGameImpl } from '../../src/application/StartGame';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startGame() {
  const repository = new InMemoryGameRepository();
  const view = new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository).execute();
  return { repository, view };
}

describe('Life', () => {
  it('shouldStartWithTenLife_whenGameStarts', () => {
    const { view } = startGame();

    expect(view.life).toBe(10);
  });
});
