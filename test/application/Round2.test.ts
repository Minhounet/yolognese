import { ITEM_KINDS, ItemKind } from '../../src/domain/round';
import { AWAY, MISS, startedRound } from '../support/round';

const kindIndex = (kind: ItemKind) => ITEM_KINDS.indexOf(kind);

/** Lets the first item appear (at 8000 ms) as the given kind, and answers its id. */
async function itemAppears(round: Awaited<ReturnType<typeof startedRound>>, kind: ItemKind): Promise<number> {
  await round.runFor(7900);
  round.random.queue(kindIndex(kind));
  const response = await round.runFor(100);
  if (response.kind !== 'done') throw new Error('no game');
  return response.view.items[0].id;
}

describe('AC10: life bar', () => {
  it('shouldStartWithFullLife', async () => {
    const { tick } = await startedRound();

    expect(await tick.execute()).toMatchObject({ view: { life: 10, maxLife: 10 } });
  });

  it('shouldNotCostLife_whenGuessWins', async () => {
    const { submitGuess } = await startedRound();

    expect(await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] })).toMatchObject({
      view: { status: 'won', life: 10 },
    });
  });
});

describe('AC11: cooldown between peeks', () => {
  it('shouldRejectPeek_whenCoolingDownAfterPeek', async () => {
    const { distractGuardian, peekSecret } = await startedRound();
    await distractGuardian.execute(AWAY);
    await peekSecret.execute({ index: 0 });

    expect(await peekSecret.execute({ index: 1 })).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldShowCooldown_whenPeeked', async () => {
    const { distractGuardian, peekSecret } = await startedRound();
    await distractGuardian.execute(AWAY);

    expect(await peekSecret.execute({ index: 0 })).toMatchObject({ view: { cooldownMs: 5000 } });
  });

  it('shouldCostNothing_whenPeekingWhileCoolingDownAfterBeingCaught', async () => {
    const { peekSecret, tick } = await startedRound();
    await peekSecret.execute({ index: 0 });

    await peekSecret.execute({ index: 0 });

    expect(await tick.execute()).toMatchObject({ view: { life: 8 } });
  });

  it('shouldAllowPeek_whenCooldownIsOver', async () => {
    const { clock, distractGuardian, peekSecret } = await startedRound();
    await distractGuardian.execute(AWAY);
    await peekSecret.execute({ index: 0 });
    clock.advance(5000);
    await distractGuardian.execute(AWAY);

    expect(await peekSecret.execute({ index: 1 })).toMatchObject({ kind: 'revealed', color: 'yellow' });
  });
});

describe('AC12: time limit', () => {
  it('shouldCountDownFromThreeMinutes', async () => {
    const { clock, tick } = await startedRound();
    clock.advance(1000);

    expect(await tick.execute()).toMatchObject({ view: { timeLeftMs: 179_000 } });
  });

  it('shouldLoseAndRevealSecret_whenTimeRunsOut', async () => {
    const round = await startedRound();
    await round.moveShield.execute({ lane: 0 }); // keep the attacks off

    expect(await round.runFor(180_000)).toMatchObject({
      view: { status: 'lost', lostBy: 'time', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldStillPlay_justBeforeTimeRunsOut', async () => {
    const { clock, tick } = await startedRound();
    clock.advance(179_999);

    expect(await tick.execute()).toMatchObject({ view: { status: 'playing' } });
  });
});

describe('AC13: items', () => {
  it('shouldShowItem_whenItsTimeComes', async () => {
    const round = await startedRound();
    await round.runFor(7900);
    round.random.queue(kindIndex('smoke'), 20, 40);

    expect(await round.runFor(100)).toMatchObject({ view: { items: [{ kind: 'smoke', x: 0.3, y: 0.5 }] } });
  });

  it('shouldRemoveItem_whenNotCollectedIn4Seconds', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'food');
    await round.runFor(4000);

    expect(await round.collectItem.execute({ id })).toEqual({ kind: 'rejected', reason: 'gone' });
  });

  it('shouldRegainThreeLife_whenFoodCollected', async () => {
    const round = await startedRound();
    for (const _ of [1, 2, 3, 4]) await round.submitGuess.execute(MISS);
    const id = await itemAppears(round, 'food');

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { life: 9, items: [], notice: 'food' } });
  });

  it('shouldNotGoOverFullLife_whenFoodCollected', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'food');

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { life: 10 } });
  });

  it('shouldPeekSafelyWithoutCooldown_whenGuardianIsBlinded', async () => {
    const round = await startedRound();
    await round.collectItem.execute({ id: await itemAppears(round, 'smoke') });
    await round.peekSecret.execute({ index: 0 });

    expect(await round.peekSecret.execute({ index: 3 })).toMatchObject({ kind: 'revealed', color: 'blue', view: { life: 10 } });
  });

  it('shouldCatchAgain_whenSmokeClears', async () => {
    const round = await startedRound();
    await round.collectItem.execute({ id: await itemAppears(round, 'smoke') });
    round.clock.advance(4000);

    expect(await round.peekSecret.execute({ index: 0 })).toMatchObject({ kind: 'caught' });
  });

  it('shouldShowOnePegBriefly_whenXrayCollected', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'xray');
    round.random.queue(2);

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { xray: { index: 2, color: 'green' } } });
  });

  it('shouldHidePegAgain_whenXrayWearsOff', async () => {
    const round = await startedRound();
    await round.collectItem.execute({ id: await itemAppears(round, 'xray') });

    expect(await round.runFor(1200)).toMatchObject({ view: { xray: undefined } });
  });

  it('shouldAddThirtySeconds_whenHourglassCollected', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'hourglass');

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { timeLeftMs: 202_000 } });
  });

  it('shouldGiveGoodThing_whenPresentHoldsOne', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'present');
    round.random.queue(0, 3); // good, the fourth good gift: hourglass

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { notice: 'hourglass', timeLeftMs: 202_000 } });
  });

  it('shouldBurn_whenPresentHoldsChili', async () => {
    const round = await startedRound();
    const id = await itemAppears(round, 'present');
    round.random.queue(1, 1); // bad, chili

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { notice: 'chili', life: 8 } });
  });
});

describe('AC15: a present can switch the order of the row', () => {
  it('shouldSwitchTwoPlacedPegs_whenPresentHoldsMixup', async () => {
    const round = await startedRound();
    await round.editDraft.execute({ kind: 'place', color: 'red' });
    await round.editDraft.execute({ kind: 'place', color: 'blue' });
    await round.editDraft.execute({ kind: 'place', color: 'green' });
    const id = await itemAppears(round, 'present');
    round.random.queue(1, 0, 0, 0); // bad, mixup, first placed peg, the next one

    expect(await round.collectItem.execute({ id })).toMatchObject({
      view: { notice: 'mixup', draft: ['blue', 'red', 'green', undefined] },
    });
  });

  it('shouldLeaveRowAlone_whenFewerThanTwoPegsPlaced', async () => {
    const round = await startedRound();
    await round.editDraft.execute({ kind: 'place', color: 'red' });
    const id = await itemAppears(round, 'present');
    round.random.queue(1, 0);

    expect(await round.collectItem.execute({ id })).toMatchObject({ view: { draft: ['red', undefined, undefined, undefined] } });
  });
});

describe('AC14: the guardian attacks, the shield protects', () => {
  it('shouldWarnOfAttackOneSecondAhead_inItsLane', async () => {
    const round = await startedRound();
    await round.runFor(9900);
    round.random.queue(0, 2); // meatball, lane 2

    expect(await round.runFor(100)).toMatchObject({ view: { attack: { kind: 'meatball', lane: 2, msToLand: 1000 } } });
  });

  it('shouldCostTwoLife_whenShieldIsInAnotherLane', async () => {
    const round = await startedRound();
    await round.moveShield.execute({ lane: 2 });

    expect(await round.runFor(11_000)).toMatchObject({ view: { life: 8, attack: undefined, notice: 'hit' } });
  });

  it('shouldBlock_whenShieldIsInTheLane', async () => {
    const round = await startedRound();
    await round.moveShield.execute({ lane: 0 });

    expect(await round.runFor(11_000)).toMatchObject({ view: { life: 10, notice: 'blocked' } });
  });

  it('shouldBlockOnce_whenCharmHeld', async () => {
    const round = await startedRound();
    await round.moveShield.execute({ lane: 2 });
    await round.collectItem.execute({ id: await itemAppears(round, 'charm') });

    expect(await round.runFor(3000)).toMatchObject({ view: { life: 10, notice: 'blocked', charm: false } });
  });

  it('shouldNotAttack_whileDistracted', async () => {
    const round = await startedRound();
    await round.runFor(9900);
    await round.distractGuardian.execute(AWAY);

    expect(await round.runFor(100)).toMatchObject({ view: { attack: undefined } });
  });

  it('shouldCancelThrow_whenBlindedDuringWindup', async () => {
    const round = await startedRound();
    await round.moveShield.execute({ lane: 2 });
    await round.runFor(7900);
    round.random.queue(kindIndex('smoke'), 0, 0, 5000); // smoke, next item well after
    await round.runFor(2100); // the item at 8000, the windup at 10000
    const id = await round.tick.execute();
    if (id.kind !== 'done') throw new Error('no game');
    await round.collectItem.execute({ id: id.view.items[0].id });

    expect(await round.runFor(1000)).toMatchObject({ view: { life: 10, attack: undefined } });
  });
});

describe('AC16: the fork steals a placed peg', () => {
  async function forkThrownAtLane0(round: Awaited<ReturnType<typeof startedRound>>) {
    await round.runFor(9900);
    round.random.queue(2, 0); // fork, lane 0
    await round.runFor(100);
  }

  it('shouldRemoveOnePlacedPeg_whenForkLands', async () => {
    const round = await startedRound();
    await round.editDraft.execute({ kind: 'place', color: 'red' });
    await round.editDraft.execute({ kind: 'place', color: 'blue' });
    await forkThrownAtLane0(round);
    round.random.queue(0, 1); // next attack delay, the second placed peg

    expect(await round.runFor(1000)).toMatchObject({
      view: { life: 10, notice: 'stolen', draft: ['red', undefined, undefined, undefined] },
    });
  });

  it('shouldStealNothing_whenRowIsEmpty', async () => {
    const round = await startedRound();
    await forkThrownAtLane0(round);

    expect(await round.runFor(1000)).toMatchObject({ view: { life: 10, notice: 'grab-missed' } });
  });

  it('shouldKeepRow_whenShieldBlocksFork', async () => {
    const round = await startedRound();
    await round.editDraft.execute({ kind: 'place', color: 'red' });
    await round.moveShield.execute({ lane: 0 });
    await forkThrownAtLane0(round);

    expect(await round.runFor(1000)).toMatchObject({ view: { notice: 'blocked', draft: ['red', undefined, undefined, undefined] } });
  });
});

describe('Row being composed', () => {
  it('shouldEmptyRow_whenGuessPlayed', async () => {
    const round = await startedRound();
    for (const _ of ['red', 'red', 'red', 'red']) await round.editDraft.execute({ kind: 'place', color: 'red' });

    expect(await round.submitGuess.execute({ guess: ['red', 'red', 'red', 'red'] })).toMatchObject({
      view: { draft: [undefined, undefined, undefined, undefined] },
    });
  });

  it('shouldFreeSlot_whenPegTappedAway', async () => {
    const round = await startedRound();
    await round.editDraft.execute({ kind: 'place', color: 'red' });
    await round.editDraft.execute({ kind: 'place', color: 'blue' });

    expect(await round.editDraft.execute({ kind: 'clear', slot: 0 })).toMatchObject({
      view: { draft: [undefined, 'blue', undefined, undefined] },
    });
  });
});
