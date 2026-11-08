import { MoveShieldImpl } from '../../src/application/MoveShield';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue; attackRandom: the attack delay drawn at scheduling, then the lane at wind-up (cycling)
function startedGame(attackRandom: readonly number[] = [0, 2]) {
  const clock = new FakeClock();
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return {
    clock,
    tick: new TickImpl(repository, clock, new ScriptedRandomSource(attackRandom)),
    submitGuess: new SubmitGuessImpl(repository),
    moveShield: new MoveShieldImpl(repository),
  };
}

describe('Tick', () => {
  it('shouldCountDownTimeLeft_whenTicked', () => {
    const { clock, tick } = startedGame();
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 179000 });
  });

  it('shouldBeLost_whenTimeIsUp', () => {
    const { clock, tick } = startedGame();
    clock.advance(180000);

    const response = tick.execute();

    expect(response).toMatchObject({
      kind: 'ticked',
      view: { status: 'lost', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldStopTimeAtZero_whenTimeIsUp', () => {
    const { clock, tick } = startedGame();
    clock.advance(200000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 0 });
  });

  it('shouldStayWon_whenTimeRunsOutAfterWinning', () => {
    const { clock, submitGuess, tick } = startedGame();
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    clock.advance(180000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { status: 'won' } });
  });

  it('shouldRejectGuess_afterTimeIsUp', () => {
    const { clock, submitGuess, tick } = startedGame();
    clock.advance(180000);
    tick.execute();

    const response = submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldWarnOfAttack_whenAttackTimeComes', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2, landsInMs: 1000 } });
  });

  it('shouldNotWarn_beforeAttackTime', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(9999);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldWaitRandomDelay_beforeAttacking', () => {
    const { clock, tick } = startedGame([10000, 2]);
    tick.execute();
    clock.advance(19999);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldHitPlayer_whenShieldIsNotInLane', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
  });

  it('shouldBlockAttack_whenShieldIsInLane', () => {
    const { clock, moveShield, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    moveShield.execute({ lane: 2 });
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldHitOnlyOnce_whenAttackLands', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(1000);
    tick.execute();
    clock.advance(100);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldAttackAgain_afterLanding', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(1000);
    tick.execute();
    clock.advance(10000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2, landsInMs: 1000 } });
  });
});
