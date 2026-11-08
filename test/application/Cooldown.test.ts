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

  it('shouldAllowPeek_whenCooldownHasPassed', () => {
    const { clock, distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });
    clock.advance(5000);
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'revealed', index: 1, color: 'yellow' });
  });

  it('shouldRejectPeek_justBeforeCooldownEnds', () => {
    const { clock, distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });
    clock.advance(4999);
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldStartCooldown_whenCaught', () => {
    const { distractGuardian, peekSecret } = startedGame();
    peekSecret.execute({ index: 0 });
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldCostNothing_whenPeekRejectedForCooldown', () => {
    const { peekSecret, submitGuess } = startedGame();
    peekSecret.execute({ index: 0 });
    peekSecret.execute({ index: 1 });

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 7 } });
  });
});
