import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { HidePegImpl } from '../../src/application/HidePeg';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue; attackRandom: the attack delay drawn at scheduling, then the lane at wind-up (cycling);
// itemRandom: the item delay drawn at scheduling, then its kind and spot x, y when it appears (cycling)
// item kinds by index: 0 food, 1 smoke, 2 xray, 3 hourglass, 4 charm, 5 present, 6 bomb
// a present's gift by index: 0 food, 1 smoke, 2 xray, 3 hourglass, 4 charm, 5 darkness, 6 mixup, 7 bomb
// a throw: one draw, lane = draw mod 3, a fork when draw is 6 to 8 (AC34)
// collectRandom: what an item draws when collected (the x-ray's peg among the hidden ones, the present's kind)
async function startedGame(
  attackRandom: readonly number[] = [0, 2],
  itemRandom: readonly number[] = [0, 0, 30, 70],
  collectRandom: readonly number[] = [1],
) {
  const clock = new FakeClock();
  const repository = new SessionWork(new InMemoryGameRepository());
  await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
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
    editDraft: new EditDraftImpl(repository, clock),
    peekSecret: new PeekSecretImpl(repository, clock, new ScriptedRandomSource([0])),
  };
}

async function collectShownItem(tick: Awaited<ReturnType<typeof startedGame>>['tick'], collectItem: Awaited<ReturnType<typeof startedGame>>['collectItem']) {
  const shown = await tick.execute();
  const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
  return await collectItem.execute({ id });
}

describe('Tick', () => {
  it('shouldCountDownTimeLeft_whenTicked', async () => {
    const { clock, tick } = await startedGame();
    clock.advance(1000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 179000 });
  });

  it('shouldBeLost_whenTimeIsUp', async () => {
    const { clock, tick } = await startedGame();
    clock.advance(180000);

    const response = await tick.execute();

    expect(response).toMatchObject({
      kind: 'ticked',
      view: { status: 'lost', secret: ['red', 'yellow', 'green', 'blue'] },
    });
  });

  it('shouldStopTimeAtZero_whenTimeIsUp', async () => {
    const { clock, tick } = await startedGame();
    clock.advance(200000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 0 });
  });

  it('shouldStayWon_whenTimeRunsOutAfterWinning', async () => {
    const { clock, submitGuess, tick } = await startedGame();
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });
    clock.advance(180000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { status: 'won' } });
  });

  it('shouldRejectGuess_afterTimeIsUp', async () => {
    const { clock, submitGuess, tick } = await startedGame();
    clock.advance(180000);
    await tick.execute();

    const response = await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldWarnOfAttack_whenAttackTimeComes', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2, landsInMs: 1500 } });
  });

  it('shouldNotWarn_beforeAttackTime', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(9999);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldWaitRandomDelay_beforeAttacking', async () => {
    const { clock, tick } = await startedGame([10000, 2]);
    await tick.execute();
    clock.advance(19999);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldHitPlayer_whenShieldIsNotInLane', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
  });

  it('shouldBlockAttack_whenShieldIsInLane', async () => {
    const { clock, moveShield, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    await moveShield.execute({ lane: 2 });
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldHitOnlyOnce_whenAttackLands', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);
    await tick.execute();
    clock.advance(100);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldAttackAgain_afterLanding', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);
    await tick.execute();
    clock.advance(10000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', attack: { lane: 2 } });
  });

  it('shouldNotAttack_whenGuardianIsDistracted', async () => {
    const { clock, distractGuardian, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(9500);
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    clock.advance(500);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldShowItem_whenItemTimeComes', async () => {
    const { clock, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food', spot: { x: 30, y: 70 } } });
  });

  it('shouldRemoveItem_afterFourSeconds', async () => {
    const { clock, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await tick.execute();
    clock.advance(4000);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.item).toBeUndefined();
  });

  it('shouldRestoreLife_whenFoodCollected', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    await peekSecret.execute({ index: 0 });
    clock.advance(5000);
    await peekSecret.execute({ index: 0 });
    clock.advance(3000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;

    const response = await collectItem.execute({ id });

    expect(response).toMatchObject({ kind: 'collected', item: 'food', view: { life: 9 } });
  });

  it('shouldCapLife_whenFoodCollectedAtFullLife', async () => {
    const { clock, collectItem, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;

    const response = await collectItem.execute({ id });

    expect(response).toMatchObject({ kind: 'collected', view: { life: 10, maxLife: 10 } });
  });

  it('shouldRejectCollect_whenItemIsGone', async () => {
    const { clock, collectItem, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    clock.advance(4000);

    const response = await collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'no-item' });
  });

  it('shouldRejectCollect_whenAlreadyCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    await collectItem.execute({ id });

    const response = await collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'no-item' });
  });

  it('shouldKeepSameItem_whileShown', async () => {
    const { clock, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await tick.execute();
    clock.advance(100);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food', spot: { x: 30, y: 70 } } });
  });

  it('shouldNotShowItem_afterItWasCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([20000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    await collectItem.execute({ id });
    clock.advance(100);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.item).toBeUndefined();
  });

  it('shouldShowAnotherItem_afterOneLeaves', async () => {
    const { clock, tick } = await startedGame([30000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await tick.execute();
    clock.advance(4000);
    await tick.execute();
    clock.advance(8000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food' } });
  });

  it('shouldShowAnotherItem_afterOneIsCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([30000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    await collectItem.execute({ id });
    clock.advance(100);
    await tick.execute();
    clock.advance(8000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', item: { kind: 'food' } });
  });

  it('shouldBlindGuardian_whenSmokeCollected', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([30000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', index: 0, color: 'red' });
  });

  it('shouldNotStartCooldown_whenPeekingWhileBlind', async () => {
    const { clock, collectItem, hidePeg, peekSecret, tick } = await startedGame([30000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    await peekSecret.execute({ index: 0 });
    await hidePeg.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'revealed', index: 1, color: 'yellow' });
  });

  it('shouldSeeAgain_afterFourSecondsOfSmoke', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([30000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(4000);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'caught' });
  });

  it('shouldNotAttack_whenGuardianIsBlind', async () => {
    const { clock, collectItem, tick } = await startedGame([0, 2], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(2000);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldReportNoCooldown_whenPeekingWhileBlind', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([30000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', cooldownMs: 0 });
  });

  it('shouldRevealHiddenPeg_whenXrayCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([30000, 0], [0, 2, 30, 70], [1]);
    await tick.execute();
    clock.advance(8000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({
      kind: 'collected',
      item: 'xray',
      view: { revealed: [{ index: 1, color: 'yellow' }] },
    });
  });

  it('shouldShowXrayPegOnlyBriefly_whenXrayCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([30000, 0], [0, 2, 30, 70], [1]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(1100);
    expect(await tick.execute()).toMatchObject({ kind: 'ticked', view: { revealed: [{ index: 1, color: 'yellow' }] } });

    clock.advance(100);

    expect(await tick.execute()).toMatchObject({ kind: 'ticked', view: { revealed: [] } });
  });

  it('shouldAddThirtySeconds_whenHourglassCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([30000, 0], [0, 3, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 202000 });
  });

  it('shouldBlockNextAttack_whenCharmCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([0, 2], [0, 4, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(2000);
    await tick.execute();
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldHitAgain_afterCharmWasUsed', async () => {
    const { clock, collectItem, tick } = await startedGame([0, 2], [30000, 4, 30, 70]);
    await tick.execute();
    clock.advance(38000);
    await collectShownItem(tick, collectItem);
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
  });

  it('shouldGiveAnotherItem_whenPresentCollected', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([30000, 0], [0, 5, 30, 70], [0]);
    await tick.execute();
    await peekSecret.execute({ index: 0 });
    clock.advance(5000);
    await peekSecret.execute({ index: 0 });
    clock.advance(3000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', item: 'present', view: { life: 9 } });
  });

  it('shouldReportHit_whenAttackLands', async () => {
    const { clock, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'hit' });
  });

  it('shouldReportBlocked_whenShieldStopsAttack', async () => {
    const { clock, moveShield, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    await moveShield.execute({ lane: 2 });
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'blocked' });
  });

  it('shouldReportBlocked_whenCharmStopsAttack', async () => {
    const { clock, collectItem, tick } = await startedGame([0, 2], [0, 4, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(2000);
    await tick.execute();
    clock.advance(2500);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', landed: 'blocked' });
  });

  it('shouldNameGift_whenPresentCollected', async () => {
    const { clock, collectItem, tick } = await startedGame([30000, 0], [0, 5, 30, 70], [1]);
    await tick.execute();
    clock.advance(8000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', item: 'present', gift: 'smoke' });
  });

  it('shouldStayBlind_whenPointingDuringSmoke', async () => {
    const { clock, collectItem, distractGuardian, peekSecret, tick } = await startedGame([30000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(100);
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    clock.advance(2000);

    const response = await peekSecret.execute({ index: 0 });

    expect(response).toMatchObject({ kind: 'revealed', cooldownMs: 0 });
  });

  it('shouldRejectCollect_whenGameIsOver', async () => {
    const { clock, collectItem, submitGuess, tick } = await startedGame([30000, 0], [0, 0, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    const shown = await tick.execute();
    const id = shown.kind === 'ticked' && shown.item !== undefined ? shown.item.id : -1;
    await submitGuess.execute({ guess: ['red', 'yellow', 'green', 'blue'] });

    const response = await collectItem.execute({ id });

    expect(response).toEqual({ kind: 'rejected', reason: 'game-over' });
  });

  it('shouldShowOnlyTheNewPeg_whenXrayCollectedAgain', async () => {
    const { clock, collectItem, tick } = await startedGame([300000, 0], [0, 2, 30, 70], [1, 3]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(100);
    await tick.execute();
    clock.advance(8000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', view: { revealed: [{ index: 3, color: 'blue' }] } });
  });

  it('shouldCostOneLife_whenPunchIsNotParried', async () => {
    const { clock, peekSecret, tick } = await startedGame([30000, 0]);
    await tick.execute();
    await peekSecret.execute({ index: 0 });
    await peekSecret.execute({ index: 1 });
    clock.advance(700);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 7 }, landed: 'hit' });
  });

  it('shouldParryPunch_whenShieldIsInItsLane', async () => {
    const { clock, moveShield, peekSecret, tick } = await startedGame([30000, 0]);
    await tick.execute();
    await peekSecret.execute({ index: 0 });
    await peekSecret.execute({ index: 1 });
    await moveShield.execute({ lane: 0 });
    clock.advance(700);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 }, landed: 'blocked' });
  });

  it('shouldNotThrowPunch_whenMeatballIsFalling', async () => {
    const { clock, peekSecret, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(10000);
    await tick.execute();
    await peekSecret.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldWaitToThrowMeatball_whilePunchIsFlying', async () => {
    const { clock, peekSecret, tick } = await startedGame([0, 2]);
    await tick.execute();
    clock.advance(9700);
    await peekSecret.execute({ index: 0 });
    await peekSecret.execute({ index: 1 });
    clock.advance(300);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.attack).toBeUndefined();
  });

  it('shouldKeepPegUp_whenPeekRevealed', async () => {
    const { clock, distractGuardian, peekSecret, tick } = await startedGame([30000, 0], [30000]);
    await tick.execute();
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    await peekSecret.execute({ index: 2 });
    clock.advance(1000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { pegUp: { index: 2, color: 'green' } } });
  });

  it('shouldFlipPegBack_whenTappedAgain', async () => {
    const { clock, distractGuardian, hidePeg, peekSecret, tick } = await startedGame([30000, 0], [30000]);
    await tick.execute();
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    await peekSecret.execute({ index: 2 });
    await hidePeg.execute({ index: 2 });
    clock.advance(100);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.view.pegUp).toBeUndefined();
  });

  it('shouldCatchPlayer_whenGuardianLooksBackWithPegUp', async () => {
    const { clock, distractGuardian, peekSecret, tick } = await startedGame([30000, 0], [30000]);
    await tick.execute();
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    await peekSecret.execute({ index: 2 });
    clock.advance(1600);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 } });
    expect(response.kind === 'ticked' && response.view.pegUp).toBeUndefined();
  });

  it('shouldStartCooldown_whenCaughtWithPegUp', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([300000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    await peekSecret.execute({ index: 2 });
    clock.advance(4000);
    await tick.execute();

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toMatchObject({ kind: 'rejected', reason: 'cooling-down' });
  });

  it('shouldRefusePeek_whileAnotherPegIsUp', async () => {
    const { clock, collectItem, peekSecret, tick } = await startedGame([300000, 0], [0, 1, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    await peekSecret.execute({ index: 0 });

    const response = await peekSecret.execute({ index: 1 });

    expect(response).toEqual({ kind: 'rejected', reason: 'peg-up' });
  });

  it('shouldNotCatchPlayer_whenPegFlippedBackInTime', async () => {
    const { clock, distractGuardian, hidePeg, peekSecret, tick } = await startedGame([30000, 0], [30000]);
    await tick.execute();
    await distractGuardian.execute({ target: { x: 150, y: -60 } });
    await peekSecret.execute({ index: 2 });
    await hidePeg.execute({ index: 2 });
    clock.advance(1600);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
  });

  it('shouldExplode_whenBombIsLeftOnField', async () => {
    const { clock, tick } = await startedGame([300000, 0], [0, 6, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await tick.execute();
    clock.advance(4000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 8 }, exploded: true });
  });

  it('shouldNotExplode_whenBombIsTappedAway', async () => {
    const { clock, collectItem, tick } = await startedGame([300000, 0], [0, 6, 30, 70]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(4000);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { life: 10 } });
    expect(response.kind === 'ticked' && response.exploded).toBeFalsy();
  });

  it('shouldBlindPlayer_whenPresentGivesDarkness', async () => {
    const { clock, collectItem, tick } = await startedGame([300000, 0], [0, 5, 30, 70], [5]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(100);

    const response = await tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', view: { playerBlind: true } });
  });

  it('shouldSeeAgain_afterFourSecondsOfDarkness', async () => {
    const { clock, collectItem, tick } = await startedGame([300000, 0], [0, 5, 30, 70], [5]);
    await tick.execute();
    clock.advance(8000);
    await collectShownItem(tick, collectItem);
    clock.advance(4000);

    const response = await tick.execute();

    expect(response.kind === 'ticked' && response.view.playerBlind).toBeFalsy();
  });

  it('shouldExplodeAtOnce_whenPresentGivesBomb', async () => {
    const { clock, collectItem, tick } = await startedGame([300000, 0], [0, 5, 30, 70], [7]);
    await tick.execute();
    clock.advance(8000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', item: 'present', gift: 'bomb', view: { life: 8 } });
  });
});

describe('Round 3 (user): the row being composed, the mix-up, the fork', () => {
  it('shouldPlaceColours_inTheFirstEmptySlotOrWhereDropped', async () => {
    const { editDraft } = await startedGame();
    await editDraft.execute({ kind: 'place', color: 'red' });
    await editDraft.execute({ kind: 'place', color: 'blue', slot: 3 });

    const response = await editDraft.execute({ kind: 'place', color: 'green' });

    expect(response).toMatchObject({ kind: 'edited', view: { draft: ['red', 'green', undefined, 'blue'] } });
  });

  it('shouldEmptyASlot_whenTappedAway', async () => {
    const { editDraft } = await startedGame();
    await editDraft.execute({ kind: 'place', color: 'red' });

    expect(await editDraft.execute({ kind: 'clear', slot: 0 })).toMatchObject({ view: { draft: [undefined, undefined, undefined, undefined] } });
  });

  it('shouldEmptyTheRow_whenTheGuessIsPlayed', async () => {
    const { editDraft, submitGuess } = await startedGame();
    for (const _ of [1, 2, 3, 4]) await editDraft.execute({ kind: 'place', color: 'purple' });

    expect(await submitGuess.execute({ guess: ['purple', 'purple', 'purple', 'purple'] })).toMatchObject({
      view: { draft: [undefined, undefined, undefined, undefined] },
    });
  });

  it('shouldSwitchTwoPlacedPegs_whenAPresentHoldsAMixup', async () => {
    const { clock, collectItem, editDraft, tick } = await startedGame([30000, 0], [0, 5, 30, 70], [6, 0, 0]);
    await editDraft.execute({ kind: 'place', color: 'red' });
    await editDraft.execute({ kind: 'place', color: 'blue' });
    await editDraft.execute({ kind: 'place', color: 'green' });
    await tick.execute();
    clock.advance(8000);

    const response = await collectShownItem(tick, collectItem);

    expect(response).toMatchObject({ kind: 'collected', gift: 'mixup', view: { draft: ['blue', 'red', 'green', undefined] } });
  });

  it('shouldLeaveTheRow_whenAMixupFindsFewerThanTwoPegs', async () => {
    const { clock, collectItem, editDraft, tick } = await startedGame([30000, 0], [0, 5, 30, 70], [6, 0, 0]);
    await editDraft.execute({ kind: 'place', color: 'red' });
    await tick.execute();
    clock.advance(8000);

    expect(await collectShownItem(tick, collectItem)).toMatchObject({ view: { draft: ['red', undefined, undefined, undefined] } });
  });

  it('shouldThrowAFork_oneThrowInThree', async () => {
    const { clock, tick } = await startedGame([0, 8]);
    await tick.execute();
    clock.advance(10000); // the first throw comes after at least 10 s

    expect(await tick.execute()).toMatchObject({ kind: 'ticked', attack: { lane: 2, fork: true } });
  });

  it('shouldStealAPlacedPeg_andNoLife_whenTheForkLands', async () => {
    const { clock, editDraft, moveShield, tick } = await startedGame([0, 8, 50000, 1]);
    await moveShield.execute({ lane: 0 });
    await editDraft.execute({ kind: 'place', color: 'red' });
    await editDraft.execute({ kind: 'place', color: 'blue' });
    await tick.execute();
    clock.advance(10000); // the first throw comes after at least 10 s
    await tick.execute();
    clock.advance(1500);

    expect(await tick.execute()).toMatchObject({ kind: 'ticked', landed: 'stolen', view: { life: 10, draft: ['red', undefined, undefined, undefined] } });
  });

  it('shouldKeepTheRow_whenTheShieldBlocksTheFork', async () => {
    const { clock, editDraft, moveShield, tick } = await startedGame([0, 8, 50000, 1]);
    await moveShield.execute({ lane: 2 });
    await editDraft.execute({ kind: 'place', color: 'red' });
    await tick.execute();
    clock.advance(10000); // the first throw comes after at least 10 s
    await tick.execute();
    clock.advance(1500);

    expect(await tick.execute()).toMatchObject({ kind: 'ticked', landed: 'blocked', view: { draft: ['red', undefined, undefined, undefined] } });
  });
});
