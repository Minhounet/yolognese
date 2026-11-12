import { settleActions } from '../../src/application/actions';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { HidePegImpl } from '../../src/application/HidePeg';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { PlayShellGame } from '../../src/application/PlayShellGame';
import { SessionWork } from '../../src/application/SessionWork';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { Taunt } from '../../src/application/Taunt';
import { TickImpl } from '../../src/application/Tick';
import { GameView } from '../../src/application/views';
import { isDistracted } from '../../src/domain/guardian';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { QueuedRandomSource } from '../support/QueuedRandomSource';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// Round 15 (PEEK-3): the action bar, the shell game and the taunt duel, in a solo game.
// secret: red yellow green blue. The guardian throws nothing in these tests (its first throw is 10 s away
// and every test that runs longer keeps the shield where the meatball falls: lane 0, the draws being 0).
const MISS = ['purple', 'purple', 'orange', 'orange'] as const;
const AWAY = { target: { x: 150, y: -60 } };

async function soloGame(options: { readonly guardianTaunts?: boolean } = {}) {
  const clock = new FakeClock();
  const work = new SessionWork(new InMemoryGameRepository(), (session) => settleActions(session, clock.now()));
  await new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), work, clock).execute();
  await new MoveShieldImpl(work).execute({ lane: 0 }); // every meatball (lane 0) is blocked
  const shellDraws = new QueuedRandomSource();
  const duelDraws = new QueuedRandomSource();
  const tick = new TickImpl(work, clock, new QueuedRandomSource(), new QueuedRandomSource(), options.guardianTaunts ? duelDraws : undefined);
  const view = async (): Promise<GameView> => {
    const response = await tick.execute();
    if (response.kind !== 'ticked') throw new Error('no game');
    return response.view;
  };
  const submitGuess = new SubmitGuessImpl(work);
  return {
    clock,
    shellDraws,
    duelDraws,
    view,
    shell: new PlayShellGame(work, clock, shellDraws),
    taunt: new Taunt(work, clock, duelDraws),
    peek: new PeekSecretImpl(work, clock, new QueuedRandomSource()),
    hidePeg: new HidePegImpl(work),
    distract: new DistractGuardianImpl(work, clock, new ScriptedRandomSource([1])),
    editDraft: new EditDraftImpl(work, clock),
    /** Misses `count` guesses: a life each. */
    async miss(count: number) {
      for (let guess = 0; guess < count; guess += 1) await submitGuess.execute({ guess: [...MISS] });
    },
    /** Moves the clock in ticks of 100 ms, as the screen does. */
    async runFor(milliseconds: number) {
      for (let passed = 0; passed < milliseconds; passed += 100) {
        clock.advance(100);
        await tick.execute();
      }
    },
    session: () => work.run((session) => ({ result: session })),
  };
}

describe('Round 15 AC2: the action bar', () => {
  it('shouldStartWithAFullBarOfThreeCharges', async () => {
    const game = await soloGame();

    expect(await game.view()).toMatchObject({ bar: { charges: 3, fullInMs: 0, canShell: true, canTaunt: true } });
  });

  it('shouldRefillOneChargeEveryFiveSeconds_afterSpendingTwo', async () => {
    const game = await soloGame();
    await game.shell.execute({ kind: 'open' });

    expect(await game.view()).toMatchObject({ bar: { charges: 1, fullInMs: 10_000, canShell: false } });
    game.clock.advance(5000);
    expect((await game.view()).bar).toMatchObject({ charges: 2, fullInMs: 5000, canShell: true, canTaunt: false });
  });

  it('shouldEmptyTheBar_whenCaughtPeeking', async () => {
    const game = await soloGame();

    await game.peek.execute({ index: 0 });

    expect((await game.view()).bar).toMatchObject({ charges: 0, canShell: false, canTaunt: false });
  });

  it('shouldCostOneCharge_whenAPeekGetsThrough', async () => {
    const game = await soloGame();
    await game.distract.execute(AWAY);

    await game.peek.execute({ index: 0 });

    expect((await game.view()).bar).toMatchObject({ charges: 2, canTaunt: false });
  });

  it('shouldRefuseTheShellGame_withOneCharge', async () => {
    const game = await soloGame();
    await game.peek.execute({ index: 0 }); // caught: empty
    game.clock.advance(5000);

    expect(await game.shell.execute({ kind: 'open' })).toEqual({ kind: 'rejected', reason: 'not-enough' });
  });

  it('shouldRefuseTheTaunt_withTwoCharges', async () => {
    const game = await soloGame();
    await game.distract.execute(AWAY);
    await game.peek.execute({ index: 0 });

    expect(await game.taunt.execute({ kind: 'open' })).toEqual({ kind: 'rejected', reason: 'not-enough' });
  });
});

describe('Round 15 AC3: the shell game', () => {
  // the draws all 0: the 🍝 starts under cup 0; five swaps of cups 0 and 1 leave it under cup 1
  const SHUFFLED_MS = 3500;

  it('shouldRefillThreeLife_whenTheCupWithTheSauceIsPicked', async () => {
    const game = await soloGame();
    await game.miss(4);
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS);

    const response = await game.shell.execute({ kind: 'pick', place: 1 });

    expect(response).toMatchObject({ kind: 'played', view: { life: 9, shell: { over: { picked: 1, sauceAt: 1, found: true } } } });
  });

  it('shouldGiveNothing_whereTheSauceStartedBeforeTheSwaps', async () => {
    const game = await soloGame();
    await game.miss(4);
    game.shellDraws.queue(2, 0, 1, 1, 0, 2, 1, 0, 0, 0, 1); // start 2; swaps 0-2, 1-2, 2-1, 0-1, 0-2: 2 → 0 → 0 → 0 → 1 → 1
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS);

    expect(await game.shell.execute({ kind: 'pick', place: 2 })).toMatchObject({ view: { life: 6 } });
  });

  it('shouldFindTheSauceWhereTheSwapsTookIt', async () => {
    const game = await soloGame();
    await game.miss(4);
    game.shellDraws.queue(2, 0, 1, 1, 0, 2, 1, 0, 0, 0, 1);
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS);

    expect(await game.shell.execute({ kind: 'pick', place: 1 })).toMatchObject({ view: { life: 9, shell: { over: { found: true } } } });
  });

  it('shouldGiveNothing_whenAnotherCupIsPicked', async () => {
    const game = await soloGame();
    await game.miss(4);
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS);

    const response = await game.shell.execute({ kind: 'pick', place: 2 });

    expect(response).toMatchObject({ view: { life: 6, shell: { over: { picked: 2, sauceAt: 1, found: false } } } });
  });

  it('shouldIgnoreAPick_whileTheCupsStillMove', async () => {
    const game = await soloGame();
    await game.miss(4);
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS - 1);

    expect(await game.shell.execute({ kind: 'pick', place: 1 })).toMatchObject({ view: { life: 6, shell: { canPick: false } } });
  });

  it('shouldShowWhereTheSauceWas_whenTheTimeRunsOut_thenClearTheTable', async () => {
    const game = await soloGame();
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(SHUFFLED_MS + 5000);

    expect((await game.view()).shell).toMatchObject({ canPick: false, over: { sauceAt: 1, found: false } });
    game.clock.advance(1500);
    expect((await game.view()).shell).toBeUndefined();
  });

  it('shouldRefuseASecondShellGame_whileOneIsOnTheTable', async () => {
    const game = await soloGame();
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(5000); // two charges again, the cups still on the table

    expect(await game.shell.execute({ kind: 'open' })).toEqual({ kind: 'rejected', reason: 'busy' });
  });
});

describe('Round 15 AC4-AC5: taunting the guardian', () => {
  // say: the guardian right (draw 0) or not, its comeback, when it answers (+1 s + draw), then the stakes:
  // the guardian's penalty (peg, life, dizzy), the player's (life, scramble, flip), the peg shown, the palette's shift
  async function taunted(guardianRight: boolean, guardianPenalty: number) {
    const game = await soloGame();
    await game.miss(2); // life 8
    await game.taunt.execute({ kind: 'open' });
    game.duelDraws.queue(...(guardianRight ? [0] : [1, 0]), 0, guardianPenalty, 0, 1, 0);
    await game.taunt.execute({ kind: 'say', insult: 1 });
    return game;
  }

  it('shouldOfferThreeInsults_andSpendTheWholeBar', async () => {
    const game = await soloGame();
    game.duelDraws.queue(3, 3, 3);

    const response = await game.taunt.execute({ kind: 'open' });

    expect(response).toMatchObject({ view: { duel: { phase: 'choosing', offered: [3, 4, 5] }, bar: { charges: 0 } } });
  });

  it('shouldWaitForTheGuardiansComeback', async () => {
    const game = await taunted(false, 1);
    game.clock.advance(999);

    expect(await game.view()).toMatchObject({ duel: { phase: 'waiting', insult: 1, opponent: 'the guardian' } });
  });

  it('shouldWinAndTakeTwoLife_whenTheGuardianAnswersWithAnotherComeback', async () => {
    const game = await taunted(false, 1);
    game.clock.advance(1000);

    const view = await game.view();

    expect(view).toMatchObject({ life: 10, duelResult: { won: true, penalty: 'life', opponent: 'the guardian' } });
    expect(view.duel).toBeUndefined();
  });

  it('shouldLoseTwoLife_whenTheGuardianAnswersWithItsOwnComeback', async () => {
    const game = await taunted(true, 1);
    game.clock.advance(1000);

    expect(await game.view()).toMatchObject({ life: 6, duelResult: { won: false, penalty: 'life' } });
  });

  it('shouldShowAPegOfTheSecret_whenTheGuardianLosesItsPeg', async () => {
    const game = await taunted(false, 0);
    game.clock.advance(1000);

    expect((await game.view()).revealed).toEqual([{ index: 1, color: 'yellow' }]);
    game.clock.advance(3000);
    expect((await game.view()).revealed).toEqual([]);
  });

  it('shouldMakeTheGuardianDizzy_forFourSeconds', async () => {
    const game = await taunted(false, 2);
    game.clock.advance(1000);
    await game.view();

    const session = await game.session();
    expect(isDistracted(session!.guardian, game.clock.now() + 3999)).toBe(true);
    expect(isDistracted(session!.guardian, game.clock.now() + 4000)).toBe(false);
  });

  it('shouldShowTheVerdictFor2_5Seconds', async () => {
    const game = await taunted(false, 1);
    game.clock.advance(1000);
    await game.view();
    game.clock.advance(2499);
    expect((await game.view()).duelResult).toBeDefined();

    game.clock.advance(1);

    expect((await game.view()).duelResult).toBeUndefined();
  });

  it('shouldRefuseAnInsultNotOffered', async () => {
    const game = await soloGame();
    await game.taunt.execute({ kind: 'open' }); // offered 0, 1, 2

    expect(await game.taunt.execute({ kind: 'say', insult: 7 })).toMatchObject({ view: { duel: { phase: 'choosing' } } });
  });
});

describe('Round 15 AC5-AC6: the guardian taunts the player', () => {
  // at the first tick the next taunt is planned: 40 s + draw; then the taunt: the insult, the two other
  // comebacks, the right one's place, and the stakes (the guardian's penalty, the player's, the peg, the shift)
  async function tauntedByTheGuardian(playerPenalty: number) {
    const game = await soloGame({ guardianTaunts: true });
    await game.view(); // plans the taunt at 40 s
    game.duelDraws.queue(5, 0, 0, 2, 0, playerPenalty, 0, 1);
    game.clock.advance(40_000);
    await game.view();
    return game;
  }

  it('shouldTauntThePlayer_after40Seconds', async () => {
    const game = await soloGame({ guardianTaunts: true });
    await game.view();
    game.clock.advance(39_999);
    expect((await game.view()).duel).toBeUndefined();

    game.clock.advance(1);

    expect((await game.view()).duel).toEqual({ phase: 'answering', insult: 0, from: 'the guardian', choices: [0, 1, 2], leftMs: 5000, answered: undefined });
  });

  it('shouldOfferTheInsultsOwnComebackAmongThree', async () => {
    const game = await tauntedByTheGuardian(0);

    expect((await game.view()).duel).toMatchObject({ insult: 5, choices: [0, 1, 5] });
  });

  it('shouldWinTheDuel_whenAnsweringWithTheInsultsOwnComeback', async () => {
    const game = await tauntedByTheGuardian(0);
    await game.miss(2);

    const response = await game.taunt.execute({ kind: 'answer', comeback: 5 }); // the guardian shows a peg

    expect(response).toMatchObject({ view: { life: 8, duelResult: { won: true, penalty: 'peg' }, revealed: [{ index: 0, color: 'red' }] } });
  });

  it('shouldLoseTwoLife_whenAnsweringWithAnotherComeback', async () => {
    const game = await tauntedByTheGuardian(0);

    expect(await game.taunt.execute({ kind: 'answer', comeback: 1 })).toMatchObject({ view: { life: 8, duelResult: { won: false, penalty: 'life' } } });
  });

  it('shouldLose_whenNotAnsweringInFiveSeconds', async () => {
    const game = await tauntedByTheGuardian(0);
    game.clock.advance(4999);
    expect((await game.view()).duel).toBeDefined();

    game.clock.advance(1);

    expect(await game.view()).toMatchObject({ life: 8, duelResult: { won: false } });
  });

  it('shouldMakeThePaletteLie_forTenSeconds_whenScrambled', async () => {
    const game = await tauntedByTheGuardian(1);
    await game.taunt.execute({ kind: 'answer', comeback: 1 });

    const lying = await game.editDraft.execute({ kind: 'place', color: 'red' });
    game.clock.advance(10_000);
    const honest = await game.editDraft.execute({ kind: 'place', color: 'red' });

    expect(lying).toMatchObject({ view: { scrambled: true } });
    expect(honest).toMatchObject({ view: { draft: ['green', 'red', undefined, undefined] } });
    expect((honest as { view: GameView }).view.scrambled).toBeUndefined();
  });

  it('shouldTurnTheScreenUpsideDown_forEightSeconds_whenFlipped', async () => {
    const game = await tauntedByTheGuardian(2);
    await game.taunt.execute({ kind: 'answer', comeback: 1 });

    expect(await game.view()).toMatchObject({ flipped: true });
    game.clock.advance(8000);
    expect((await game.view()).flipped).toBeUndefined();
  });

  it('shouldNotTaunt_whileAShellGameIsOnTheTable', async () => {
    const game = await soloGame({ guardianTaunts: true });
    await game.view();
    game.clock.advance(38_000);
    await game.shell.execute({ kind: 'open' });
    game.clock.advance(2000);

    expect((await game.view()).duel).toBeUndefined();
  });

  it('shouldNeverTaunt_withoutTheDuelDraws', async () => {
    const game = await soloGame();
    await game.view();
    game.clock.advance(100_000);

    expect((await game.view()).duel).toBeUndefined();
  });
});
