import { ITEM_KINDS, ItemKind } from '../../src/domain/round';
import { AWAY, MISS, startedRound } from '../support/round';

const kindIndex = (kind: ItemKind) => ITEM_KINDS.indexOf(kind);

/** Lets the first item appear (at 8000 ms) as the given kind, and answers its id. */
function itemAppears(round: ReturnType<typeof startedRound>, kind: ItemKind): number {
  round.runFor(7900);
  round.random.queue(kindIndex(kind));
  const response = round.runFor(100);
  if (response.kind !== 'done') throw new Error('no game');
  return response.view.items[0].id;
}

describe('AC10: life bar', () => {
  it('shouldStartWithFullLife', () => {
    const { tick } = startedRound();

    expect(tick.execute()).toMatchObject({ view: { life: 10, maxLife: 10 } });
  });

  it('shouldNotCostLife_whenGuessWins', () => {
    const { submitGuess } = startedRound();

    expect(submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] })).toMatchObject({
      view: { status: 'won', life: 10 },
    });
  });
});

describe('AC11: cooldown between peeks', () => {
  it('shouldRejectPeek_whenCoolingDownAfterPeek', () => {
    const { distractGuardian, peekSecret } = startedRound();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });

    expect(peekSecret.execute({ index: 1 })).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldShowCooldown_whenPeeked', () => {
    const { distractGuardian, peekSecret } = startedRound();
    distractGuardian.execute(AWAY);

    expect(peekSecret.execute({ index: 0 })).toMatchObject({ view: { cooldownMs: 5000 } });
  });

  it('shouldCostNothing_whenPeekingWhileCoolingDownAfterBeingCaught', () => {
    const { peekSecret, tick } = startedRound();
    peekSecret.execute({ index: 0 });

    peekSecret.execute({ index: 0 });

    expect(tick.execute()).toMatchObject({ view: { life: 8 } });
  });

  it('shouldAllowPeek_whenCooldownIsOver', () => {
    const { clock, distractGuardian, peekSecret } = startedRound();
    distractGuardian.execute(AWAY);
    peekSecret.execute({ index: 0 });
    clock.advance(5000);
    distractGuardian.execute(AWAY);

    expect(peekSecret.execute({ index: 1 })).toMatchObject({ kind: 'revealed', color: 'yellow' });
  });
});

describe('AC12: time limit', () => {
  it('shouldCountDownFromThreeMinutes', () => {
    const { clock, tick } = startedRound();
    clock.advance(1000);

    expect(tick.execute()).toMatchObject({ view: { timeLeftMs: 179_000 } });
  });

  it('shouldLoseAndRevealSecret_whenTimeRunsOut', () => {
    const round = startedRound();
    round.moveShield.execute({ lane: 0 }); // keep the attacks off

    expect(round.runFor(180_000)).toMatchObject({
      view: { status: 'lost', lostBy: 'time', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldStillPlay_justBeforeTimeRunsOut', () => {
    const { clock, tick } = startedRound();
    clock.advance(179_999);

    expect(tick.execute()).toMatchObject({ view: { status: 'playing' } });
  });
});

describe('AC13: items', () => {
  it('shouldShowItem_whenItsTimeComes', () => {
    const round = startedRound();
    round.runFor(7900);
    round.random.queue(kindIndex('smoke'), 20, 40);

    expect(round.runFor(100)).toMatchObject({ view: { items: [{ kind: 'smoke', x: 0.3, y: 0.5 }] } });
  });

  it('shouldRemoveItem_whenNotCollectedIn4Seconds', () => {
    const round = startedRound();
    const id = itemAppears(round, 'food');
    round.runFor(4000);

    expect(round.collectItem.execute({ id })).toEqual({ kind: 'rejected', reason: 'gone' });
  });

  it('shouldRegainThreeLife_whenFoodCollected', () => {
    const round = startedRound();
    [1, 2, 3, 4].forEach(() => round.submitGuess.execute(MISS));
    const id = itemAppears(round, 'food');

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { life: 9, items: [], notice: 'food' } });
  });

  it('shouldNotGoOverFullLife_whenFoodCollected', () => {
    const round = startedRound();
    const id = itemAppears(round, 'food');

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { life: 10 } });
  });

  it('shouldPeekSafelyWithoutCooldown_whenGuardianIsBlinded', () => {
    const round = startedRound();
    round.collectItem.execute({ id: itemAppears(round, 'smoke') });
    round.peekSecret.execute({ index: 0 });

    expect(round.peekSecret.execute({ index: 3 })).toMatchObject({ kind: 'revealed', color: 'blue', view: { life: 10 } });
  });

  it('shouldCatchAgain_whenSmokeClears', () => {
    const round = startedRound();
    round.collectItem.execute({ id: itemAppears(round, 'smoke') });
    round.clock.advance(4000);

    expect(round.peekSecret.execute({ index: 0 })).toMatchObject({ kind: 'caught' });
  });

  it('shouldShowOnePegBriefly_whenXrayCollected', () => {
    const round = startedRound();
    const id = itemAppears(round, 'xray');
    round.random.queue(2);

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { xray: { index: 2, color: 'green' } } });
  });

  it('shouldHidePegAgain_whenXrayWearsOff', () => {
    const round = startedRound();
    round.collectItem.execute({ id: itemAppears(round, 'xray') });

    expect(round.runFor(1200)).toMatchObject({ view: { xray: undefined } });
  });

  it('shouldAddThirtySeconds_whenHourglassCollected', () => {
    const round = startedRound();
    const id = itemAppears(round, 'hourglass');

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { timeLeftMs: 202_000 } });
  });

  it('shouldGiveGoodThing_whenPresentHoldsOne', () => {
    const round = startedRound();
    const id = itemAppears(round, 'present');
    round.random.queue(0, 3); // good, the fourth good gift: hourglass

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { notice: 'hourglass', timeLeftMs: 202_000 } });
  });

  it('shouldBurn_whenPresentHoldsChili', () => {
    const round = startedRound();
    const id = itemAppears(round, 'present');
    round.random.queue(1, 1); // bad, chili

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { notice: 'chili', life: 8 } });
  });
});

describe('AC15: a present can switch the order of the row', () => {
  it('shouldSwitchTwoPlacedPegs_whenPresentHoldsMixup', () => {
    const round = startedRound();
    round.editDraft.execute({ kind: 'place', color: 'red' });
    round.editDraft.execute({ kind: 'place', color: 'blue' });
    round.editDraft.execute({ kind: 'place', color: 'green' });
    const id = itemAppears(round, 'present');
    round.random.queue(1, 0, 0, 0); // bad, mixup, first placed peg, the next one

    expect(round.collectItem.execute({ id })).toMatchObject({
      view: { notice: 'mixup', draft: ['blue', 'red', 'green', undefined] },
    });
  });

  it('shouldLeaveRowAlone_whenFewerThanTwoPegsPlaced', () => {
    const round = startedRound();
    round.editDraft.execute({ kind: 'place', color: 'red' });
    const id = itemAppears(round, 'present');
    round.random.queue(1, 0);

    expect(round.collectItem.execute({ id })).toMatchObject({ view: { draft: ['red', undefined, undefined, undefined] } });
  });
});

describe('AC14: the guardian attacks, the shield protects', () => {
  it('shouldWarnOfAttackOneSecondAhead_inItsLane', () => {
    const round = startedRound();
    round.runFor(9900);
    round.random.queue(0, 2); // meatball, lane 2

    expect(round.runFor(100)).toMatchObject({ view: { attack: { kind: 'meatball', lane: 2, msToLand: 1000 } } });
  });

  it('shouldCostTwoLife_whenShieldIsInAnotherLane', () => {
    const round = startedRound();
    round.moveShield.execute({ lane: 2 });

    expect(round.runFor(11_000)).toMatchObject({ view: { life: 8, attack: undefined, notice: 'hit' } });
  });

  it('shouldBlock_whenShieldIsInTheLane', () => {
    const round = startedRound();
    round.moveShield.execute({ lane: 0 });

    expect(round.runFor(11_000)).toMatchObject({ view: { life: 10, notice: 'blocked' } });
  });

  it('shouldBlockOnce_whenCharmHeld', () => {
    const round = startedRound();
    round.moveShield.execute({ lane: 2 });
    round.collectItem.execute({ id: itemAppears(round, 'charm') });

    expect(round.runFor(3000)).toMatchObject({ view: { life: 10, notice: 'blocked', charm: false } });
  });

  it('shouldNotAttack_whileDistracted', () => {
    const round = startedRound();
    round.runFor(9900);
    round.distractGuardian.execute(AWAY);

    expect(round.runFor(100)).toMatchObject({ view: { attack: undefined } });
  });

  it('shouldCancelThrow_whenBlindedDuringWindup', () => {
    const round = startedRound();
    round.moveShield.execute({ lane: 2 });
    round.runFor(7900);
    round.random.queue(kindIndex('smoke'), 0, 0, 5000); // smoke, next item well after
    round.runFor(2100); // the item at 8000, the windup at 10000
    const id = round.tick.execute();
    if (id.kind !== 'done') throw new Error('no game');
    round.collectItem.execute({ id: id.view.items[0].id });

    expect(round.runFor(1000)).toMatchObject({ view: { life: 10, attack: undefined } });
  });
});

describe('AC16: the fork steals a placed peg', () => {
  function forkThrownAtLane0(round: ReturnType<typeof startedRound>) {
    round.runFor(9900);
    round.random.queue(2, 0); // fork, lane 0
    round.runFor(100);
  }

  it('shouldRemoveOnePlacedPeg_whenForkLands', () => {
    const round = startedRound();
    round.editDraft.execute({ kind: 'place', color: 'red' });
    round.editDraft.execute({ kind: 'place', color: 'blue' });
    forkThrownAtLane0(round);
    round.random.queue(0, 1); // next attack delay, the second placed peg

    expect(round.runFor(1000)).toMatchObject({
      view: { life: 10, notice: 'stolen', draft: ['red', undefined, undefined, undefined] },
    });
  });

  it('shouldStealNothing_whenRowIsEmpty', () => {
    const round = startedRound();
    forkThrownAtLane0(round);

    expect(round.runFor(1000)).toMatchObject({ view: { life: 10, notice: 'grab-missed' } });
  });

  it('shouldKeepRow_whenShieldBlocksFork', () => {
    const round = startedRound();
    round.editDraft.execute({ kind: 'place', color: 'red' });
    round.moveShield.execute({ lane: 0 });
    forkThrownAtLane0(round);

    expect(round.runFor(1000)).toMatchObject({ view: { notice: 'blocked', draft: ['red', undefined, undefined, undefined] } });
  });
});

describe('Row being composed', () => {
  it('shouldEmptyRow_whenGuessPlayed', () => {
    const round = startedRound();
    ['red', 'red', 'red', 'red'].forEach(() => round.editDraft.execute({ kind: 'place', color: 'red' }));

    expect(round.submitGuess.execute({ guess: ['red', 'red', 'red', 'red'] })).toMatchObject({
      view: { draft: [undefined, undefined, undefined, undefined] },
    });
  });

  it('shouldFreeSlot_whenPegTappedAway', () => {
    const round = startedRound();
    round.editDraft.execute({ kind: 'place', color: 'red' });
    round.editDraft.execute({ kind: 'place', color: 'blue' });

    expect(round.editDraft.execute({ kind: 'clear', slot: 0 })).toMatchObject({
      view: { draft: [undefined, 'blue', undefined, undefined] },
    });
  });
});
