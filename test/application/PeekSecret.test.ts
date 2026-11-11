import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { HidePegImpl } from '../../src/application/HidePeg';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue; the guardian's luck draw: 1 is fooled (0 sees through it);
// punchLanes: the lane a punch is thrown at
const FOOLED = 1;
async function startedGame(luck: readonly number[] = [FOOLED], punchLanes: readonly number[] = [2]) {
  const clock = new FakeClock();
  const repository = new SessionWork(new InMemoryGameRepository());
  await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return {
    clock,
    distractGuardian: new DistractGuardianImpl(repository, clock, new ScriptedRandomSource(luck)),
    peekSecret: new PeekSecretImpl(repository, clock, new ScriptedRandomSource(punchLanes)),
    submitGuess: new SubmitGuessImpl(repository),
    hidePeg: new HidePegImpl(repository),
  };
}

const AWAY = { target: { x: 150, y: -60 } };

describe('PeekSecret', () => {
  it('shouldRevealColour_whenPeekingWhileDistracted', async () => {
    const { distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'revealed', index: 2, color: 'green' });
  });

  it('shouldBeCaught_whenPeekingWhileWatched', async () => {
    const { peekSecret } = await startedGame();

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldBeCaught_whenPeekingAfterDistractionEnds', async () => {
    const { clock, distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    clock.advance(1500);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldRevealColour_justBeforeDistractionEnds', async () => {
    const { clock, distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    clock.advance(1499);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', index: 0, color: 'red' });
  });

  it('shouldLoseTwoLife_whenCaught', async () => {
    const { peekSecret } = await startedGame();

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 8 } });
  });

  it('shouldBeLost_whenCaughtWithTwoLifeLeft', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    for (let time = 0; time < 8; time += 1) await submitGuess.execute(miss);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { status: 'lost', life: 0 } });
  });

  it('shouldStopLifeAtZero_whenCaughtWithOneLifeLeft', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    const miss = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
    for (let time = 0; time < 9; time += 1) await submitGuess.execute(miss);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught', view: { life: 0 } });
  });

  it('shouldRejectPeek_whenGameIsOver', async () => {
    const { distractGuardian, peekSecret, submitGuess } = await startedGame();
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldKeepLifeLost_whenGuessingAfterBeingCaught', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    await peekSecret.execute({ index: 2 });

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 7 } });
  });

  it('shouldRejectPeek_whenPeekedJustBefore', async () => {
    const { distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    await peekSecret.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldRejectPeek_justBeforeCooldownEnds', async () => {
    const { clock, distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    await peekSecret.execute({ index: 0 });
    clock.advance(4999);
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldAllowPeek_whenCooldownHasPassed', async () => {
    const { clock, distractGuardian, hidePeg, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);
    await peekSecret.execute({ index: 0 });
    await hidePeg.execute({ index: 0 });
    clock.advance(5000);
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'revealed', index: 1, color: 'yellow' });
  });

  it('shouldRejectPeek_whenCaughtJustBefore', async () => {
    const { peekSecret } = await startedGame();
    await peekSecret.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldCostNothing_whenPeekRejectedDuringCooldown', async () => {
    const { peekSecret, submitGuess } = await startedGame();
    await peekSecret.execute({ index: 0 });
    await peekSecret.execute({ index: 1 });

    const response = await submitGuess.execute({ guess: ['purple', 'purple', 'orange', 'orange'] });

    expect(response).toMatchObject({ kind: 'played', view: { life: 7 } });
  });

  it('shouldStartCooldown_whenPeekRevealed', async () => {
    const { distractGuardian, peekSecret } = await startedGame();
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 3 });

    expect(response).toMatchObject({ kind: 'revealed', cooldownMs: 5000 });
  });

  it('shouldStartCooldown_whenCaught', async () => {
    const { peekSecret } = await startedGame();

    const response = await peekSecret.execute({ index: 3 });

    expect(response).toMatchObject({ kind: 'caught', cooldownMs: 5000 });
  });

  it('shouldBeCaught_whenPeekingAfterBeingPunched', async () => {
    const { distractGuardian, peekSecret } = await startedGame([0]);
    await distractGuardian.execute(AWAY);

    const response = await peekSecret.execute({ index: 2 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldThrowPunch_whenPeekingDuringCooldown', async () => {
    const { peekSecret } = await startedGame([FOOLED], [2]);
    await peekSecret.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down', punch: { lane: 2, landsInMs: 450 } });
  });
});
