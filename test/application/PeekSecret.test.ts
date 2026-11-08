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

  it('shouldLoseTwoLife_whenCaught', () => {
    const { peekSecret } = startedGame();

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 8 } });
  });

  it('shouldBeLost_whenCaughtWithTwoLifeLeft', () => {
    const { peekSecret, submitGuess } = startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    Array.from({ length: 8 }).forEach(() => submitGuess.execute(miss));

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { status: 'lost', life: 0 } });
  });

  it('shouldStopLifeAtZero_whenCaughtWithOneLifeLeft', () => {
    const { peekSecret, submitGuess } = startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    Array.from({ length: 9 }).forEach(() => submitGuess.execute(miss));

    const response = peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 0 } });
  });

  it('shouldRejectPeek_whenGameIsOver', () => {
    const { distractGuardian, peekSecret, submitGuess } = startedGame();
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 2 });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldKeepLifeLost_whenGuessingAfterBeingCaught', () => {
    const { peekSecret, submitGuess } = startedGame();
    peekSecret.execute({ index: 2 });

    const response = submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 7 } });
  });

  it('shouldRejectPeek_whenPeekedJustBefore', () => {
    const { distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
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

  it('shouldAllowPeek_whenCooldownHasPassed', () => {
    const { clock, distractGuardian, peekSecret } = startedGame();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });
    clock.advance(5000);
    distractGuardian.execute(AWAY);

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'revealed', index: 1, color: 'yellow' });
  });

  it('shouldRejectPeek_whenCaughtJustBefore', () => {
    const { peekSecret } = startedGame();
    peekSecret.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });
});
