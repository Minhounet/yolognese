import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { HidePegImpl } from '../../src/application/HidePeg';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue; attackRandom: the attack delay drawn at scheduling, then the lane at wind-up (cycling);
// itemRandom: the item delay drawn at scheduling, then its kind and spot x, y when it appears (cycling)
// item kinds by index: 0 food, 1 smoke, 2 xray, 3 hourglass, 4 charm, 5 present
// collectRandom: what an item draws when collected (the x-ray's peg among the hidden ones, the present's kind)
function startedGame(
  attackRandom: readonly number[] = [0, 2],
  itemRandom: readonly number[] = [0, 0, 30, 70],
  collectRandom: readonly number[] = [1],
) {
  const clock = new FakeClock();
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return {
    clock,
    tick: new TickImpl(
      repository,
      clock,
      new ScriptedRandomSource(attackRandom),
      new ScriptedRandomSource(itemRandom),
    ),
    submitGuess: new SubmitGuessImpl(repository),
    moveShield: new MoveShieldImpl(repository),
    hidePeg: new HidePegImpl(repository),
    distractGuardian: new DistractGuardianImpl(repository, clock, new ScriptedRandomSource([1])),
    collectItem: new CollectItemImpl(repository, clock, new ScriptedRandomSource(collectRandom)),
    peekSecret: new PeekSecretImpl(repository, clock, new ScriptedRandomSource([0])),
  };
}

function collectShownItem(tick: ReturnType<typeof startedGame>['tick'], collectItem: ReturnType<typeof startedGame>['collectItem']) {
  const shown = tick.execute();
  const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
  return collectItem.execute({ id });
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

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2, landsInMs: 1500 } });
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
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
  });

  it('shouldBlockAttack_whenShieldIsInLane', () => {
    const { clock, moveShield, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    moveShield.execute({ lane: 2 });
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldHitOnlyOnce_whenAttackLands', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(2500);
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
    clock.advance(2500);
    tick.execute();
    clock.advance(10000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2 } });
  });

  it('shouldNotAttack_whenGuardianIsDistracted', () => {
    const { clock, distractGuardian, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(9500);
    distractGuardian.execute({ target: { x: 150, y: -60 } });
    clock.advance(500);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldShowItem_whenItemTimeComes', () => {
    const { clock, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food', spot: { x: 30, y: 70 } } });
  });

  it('shouldRemoveItem_afterFourSeconds', () => {
    const { clock, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    tick.execute();
    clock.advance(4000);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.item).toBeUndefined();
  });

  it('shouldRestoreLife_whenFoodCollected', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    peekSecret.execute({ index: 0 });
    clock.advance(5000);
    peekSecret.execute({ index: 0 });
    clock.advance(3000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;

    const response = collectItem.execute({ id });

    expect(response).toMatchObject({ kind: 'collected', item: 'food', view: { life: 9 } });
  });

  it('shouldCapLife_whenFoodCollectedAtFullLife', () => {
    const { clock, collectItem, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;

    const response = collectItem.execute({ id });

    expect(response).toMatchObject({ kind: 'collected', view: { life: 10, maxLife: 10 } });
  });

  it('shouldRejectCollect_whenItemIsGone', () => {
    const { clock, collectItem, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    clock.advance(4000);

    const response = collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'no-item' });
  });

  it('shouldRejectCollect_whenAlreadyCollected', () => {
    const { clock, collectItem, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    collectItem.execute({ id });

    const response = collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'no-item' });
  });

  it('shouldKeepSameItem_whileShown', () => {
    const { clock, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    tick.execute();
    clock.advance(100);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food', spot: { x: 30, y: 70 } } });
  });

  it('shouldNotShowItem_afterItWasCollected', () => {
    const { clock, collectItem, tick } = startedGame([20000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    collectItem.execute({ id });
    clock.advance(100);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.item).toBeUndefined();
  });

  it('shouldShowAnotherItem_afterOneLeaves', () => {
    const { clock, tick } = startedGame([30000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    tick.execute();
    clock.advance(4000);
    tick.execute();
    clock.advance(8000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food' } });
  });

  it('shouldShowAnotherItem_afterOneIsCollected', () => {
    const { clock, collectItem, tick } = startedGame([30000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    collectItem.execute({ id });
    clock.advance(100);
    tick.execute();
    clock.advance(8000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food' } });
  });

  it('shouldBlindGuardian_whenSmokeCollected', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([30000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);

    const response = peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', index: 0, color: 'red' });
  });

  it('shouldNotStartCooldown_whenPeekingWhileBlind', () => {
    const { clock, collectItem, hidePeg, peekSecret, tick } = startedGame([30000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    peekSecret.execute({ index: 0 });
    hidePeg.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'revealed', index: 1, color: 'yellow' });
  });

  it('shouldSeeAgain_afterFourSecondsOfSmoke', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([30000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(4000);

    const response = peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldNotAttack_whenGuardianIsBlind', () => {
    const { clock, collectItem, tick } = startedGame([0, 2], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(2000);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldReportNoCooldown_whenPeekingWhileBlind', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([30000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);

    const response = peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', cooldownMs: 0 });
  });

  it('shouldRevealHiddenPeg_whenXrayCollected', () => {
    const { clock, collectItem, tick } = startedGame([30000, 0], [0, 2, 30, 70], [1]);
    tick.execute();
    clock.advance(8000);

    const response = collectShownItem(tick, collectItem);

    expect(response).toMatchObject({
      kind: 'collected',
      item: 'xray',
      view: { revealed: [{ index: 1, color: 'yellow' }] },
    });
  });

  it('shouldRevealStillHiddenPeg_whenXrayCollectedAgain', () => {
    const { clock, collectItem, tick } = startedGame([30000, 0], [0, 2, 30, 70], [1, 1]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(100);
    tick.execute();
    clock.advance(8000);

    const response = collectShownItem(tick, collectItem);

    expect(response).toMatchObject({
      kind: 'collected',
      view: {
        revealed: [
          { index: 1, color: 'yellow' },
          { index: 2, color: 'green' },
        ],
      },
    });
  });

  it('shouldAddThirtySeconds_whenHourglassCollected', () => {
    const { clock, collectItem, tick } = startedGame([30000, 0], [0, 3, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 202000 });
  });

  it('shouldBlockNextAttack_whenCharmCollected', () => {
    const { clock, collectItem, tick } = startedGame([0, 2], [0, 4, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(2000);
    tick.execute();
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldHitAgain_afterCharmWasUsed', () => {
    const { clock, collectItem, tick } = startedGame([0, 2], [30000, 4, 30, 70]);
    tick.execute();
    clock.advance(38000);
    collectShownItem(tick, collectItem);
    clock.advance(10000);
    tick.execute();
    clock.advance(2500);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
  });

  it('shouldGiveAnotherItem_whenPresentCollected', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([30000, 0], [0, 5, 30, 70], [0]);
    tick.execute();
    peekSecret.execute({ index: 0 });
    clock.advance(5000);
    peekSecret.execute({ index: 0 });
    clock.advance(3000);

    const response = collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', item: 'present', view: { life: 9 } });
  });

  it('shouldReportHit_whenAttackLands', () => {
    const { clock, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'hit' });
  });

  it('shouldReportBlocked_whenShieldStopsAttack', () => {
    const { clock, moveShield, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    moveShield.execute({ lane: 2 });
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'blocked' });
  });

  it('shouldReportBlocked_whenCharmStopsAttack', () => {
    const { clock, collectItem, tick } = startedGame([0, 2], [0, 4, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(2000);
    tick.execute();
    clock.advance(2500);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'blocked' });
  });

  it('shouldNameGift_whenPresentCollected', () => {
    const { clock, collectItem, tick } = startedGame([30000, 0], [0, 5, 30, 70], [1]);
    tick.execute();
    clock.advance(8000);

    const response = collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', item: 'present', gift: 'smoke' });
  });

  it('shouldStayBlind_whenPointingDuringSmoke', () => {
    const { clock, collectItem, distractGuardian, peekSecret, tick } = startedGame([30000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    clock.advance(100);
    distractGuardian.execute({ target: { x: 150, y: -60 } });
    clock.advance(2000);

    const response = peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', cooldownMs: 0 });
  });

  it('shouldRejectCollect_whenGameIsOver', () => {
    const { clock, collectItem, submitGuess, tick } = startedGame([30000, 0], [0, 0, 30, 70]);
    tick.execute();
    clock.advance(8000);
    const shown = tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    const response = collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldRevealNothingMore_whenEveryPegIsRevealed', () => {
    const { clock, collectItem, tick } = startedGame([300000, 0], [0, 2, 30, 70], [0]);
    tick.execute();
    const collectNextXray = () => {
      clock.advance(8000);
      const response = collectShownItem(tick, collectItem);
      clock.advance(100);
      tick.execute();
      return response;
    };
    Array.from({ length: 4 }).forEach(collectNextXray);

    const response = collectNextXray();

    expect(response).toMatchObject({ kind: 'collected', view: { revealed: { length: 4 } } });
  });

  it('shouldCostOneLife_whenPunchIsNotParried', () => {
    const { clock, peekSecret, tick } = startedGame([30000, 0]);
    tick.execute();
    peekSecret.execute({ index: 0 });
    peekSecret.execute({ index: 1 });
    clock.advance(700);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 7 }, landed: 'hit' });
  });

  it('shouldParryPunch_whenShieldIsInItsLane', () => {
    const { clock, moveShield, peekSecret, tick } = startedGame([30000, 0]);
    tick.execute();
    peekSecret.execute({ index: 0 });
    peekSecret.execute({ index: 1 });
    moveShield.execute({ lane: 0 });
    clock.advance(700);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 }, landed: 'blocked' });
  });

  it('shouldNotThrowPunch_whenMeatballIsFalling', () => {
    const { clock, peekSecret, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(10000);
    tick.execute();
    peekSecret.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldWaitToThrowMeatball_whilePunchIsFlying', () => {
    const { clock, peekSecret, tick } = startedGame([0, 2]);
    tick.execute();
    clock.advance(9700);
    peekSecret.execute({ index: 0 });
    peekSecret.execute({ index: 1 });
    clock.advance(300);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldKeepPegUp_whenPeekRevealed', () => {
    const { clock, distractGuardian, peekSecret, tick } = startedGame([30000, 0], [30000]);
    tick.execute();
    distractGuardian.execute({ target: { x: 150, y: -60 } });
    peekSecret.execute({ index: 2 });
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { pegUp: { index: 2, color: 'green' } } });
  });

  it('shouldFlipPegBack_whenTappedAgain', () => {
    const { clock, distractGuardian, hidePeg, peekSecret, tick } = startedGame([30000, 0], [30000]);
    tick.execute();
    distractGuardian.execute({ target: { x: 150, y: -60 } });
    peekSecret.execute({ index: 2 });
    hidePeg.execute({ index: 2 });
    clock.advance(100);

    const response = tick.execute();

    expect(response.kind === 'ticked' && response.view.pegUp).toBeUndefined();
  });

  it('shouldCatchPlayer_whenGuardianLooksBackWithPegUp', () => {
    const { clock, distractGuardian, peekSecret, tick } = startedGame([30000, 0], [30000]);
    tick.execute();
    distractGuardian.execute({ target: { x: 150, y: -60 } });
    peekSecret.execute({ index: 2 });
    clock.advance(1600);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
    expect(response.kind === 'ticked' && response.view.pegUp).toBeUndefined();
  });

  it('shouldStartCooldown_whenCaughtWithPegUp', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([300000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    peekSecret.execute({ index: 2 });
    clock.advance(4000);
    tick.execute();

    const response = peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldRefusePeek_whileAnotherPegIsUp', () => {
    const { clock, collectItem, peekSecret, tick } = startedGame([300000, 0], [0, 1, 30, 70]);
    tick.execute();
    clock.advance(8000);
    collectShownItem(tick, collectItem);
    peekSecret.execute({ index: 0 });

    const response = peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'peg-up' });
  });
});
