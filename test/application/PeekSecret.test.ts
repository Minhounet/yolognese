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

describe('PeekSecret', () => {
  it('shouldRevealColour_whenPeekingWhileDistracted', () => {
    const { distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 2 });

    expect(response).toEqual({ kind: 'revealed', index: 2, color: 'green' });
  });

  it('shouldBeCaught_whenPeekingWhileWatched', () => {
    const { peekSecret } = startedGame();

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldBeCaught_whenPeekingAfterDistractionEnds', () => {
    const { clock, distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    clock.advance(1500);

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldRevealColour_justBeforeDistractionEnds', () => {
    const { clock, distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    clock.advance(1499);

    const response = peekSecret.execute({ index: 0 });

    expect(response).toEqual({ kind: 'revealed', index: 0, color: 'red' });
  });

  it('shouldCostOneAttempt_whenCaught', () => {
    const { peekSecret } = startedGame();

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { attemptsLeft: 9 } });
  });

  it('shouldLoseGame_whenCaughtOnLastAttempt', () => {
    const { peekSecret, submitGuess } = startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    Array.from({ length: 9 }).forEach(() => submitGuess.execute(miss));

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { status: 'lost', attemptsLeft: 0 } });
  });

  it('shouldRejectPeek_whenGameIsOver', () => {
    const { distractGuardian, peekSecret, submitGuess } = startedGame();
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 2 });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });
});
