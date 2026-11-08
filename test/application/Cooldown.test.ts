import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startedGame() {
  const clock = new FakeClock();
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository).execute();
  return {
    clock,
    distractGuardian: new DistractGuardianImpl(repository, clock),
    peekSecret: new PeekSecretImpl(repository, clock),
    submitGuess: new SubmitGuessImpl(repository),
  };
}

const AWAY = { target: { x: 150, y: -60 } };

describe('Cooldown', () => {
  it('shouldRejectPeek_whenPeekingAgainRightAfterReveal', () => {
    const { distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });
});
