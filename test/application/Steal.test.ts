import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { FlushMatch, ReceiveMatch, StartSteal } from '../../src/application/Match';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { MatchServer } from '../../src/application/ports';
import { SessionWork } from '../../src/application/SessionWork';
import { settleSteal } from '../../src/application/stealMatch';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { WipeInk } from '../../src/application/WipeInk';
import { Taunt } from '../../src/application/Taunt';
import { settleActions } from '../../src/application/actions';
import { GameView } from '../../src/application/views';
import { Code } from '../../src/domain/color';
import { ITEM_KINDS, MATCH_ITEM_KINDS } from '../../src/domain/items';
import { StartGameImpl } from '../../src/application/StartGame';
import { RoomEvent } from '../../src/domain/steal';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { FakeMatchServer } from '../support/FakeMatchServer';
import { QueuedRandomSource } from '../support/QueuedRandomSource';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];
const SEATS = [
  { id: 'a', name: 'Ann', sauce: all('red') },
  { id: 'b', name: 'Bob', sauce: all('blue') },
  { id: 'c', name: 'Cid', sauce: all('green') },
];
const MISS = all('purple');
const FOOLED = 1; // the guardian's luck: always fooled by a distraction
const scoresWith = (...pairs: [string, number][]) =>
  expect.arrayContaining(pairs.map(([name, points]) => expect.objectContaining({ name, points })));

/**
 * A match refereed by the fake match server (the SQL rules in memory): each
 * phone has its own session and plays main's game (guardian, items, meatballs
 * in lane 0, blocked: every shield is moved there); what the server says reaches
 * every phone a moment later, as through Supabase Realtime. Ann is the host.
 */
async function match(seatCount = 3) {
  const clock = new FakeClock();
  const seats = SEATS.slice(0, seatCount);
  const inFlight: Promise<unknown>[] = [];
  const delivered = async () => {
    while (inFlight.length > 0) await inFlight.shift();
  };
  const server = new FakeMatchServer(clock, (event) => players.forEach((player) => inFlight.push(player.hear(event))));
  const calls: string[] = [];
  let slow: Promise<void> | undefined;
  const counted = (id: string): MatchServer => {
    const real = server.as(id);
    return Object.fromEntries(
      Object.entries(real).map(([name, fn]) => [
        name,
        async (...args: unknown[]) => {
          calls.push(`${id}:${name}`);
          if (slow !== undefined) await slow;
          return (fn as (...a: unknown[]) => unknown)(...args);
        },
      ]),
    ) as unknown as MatchServer;
  };
  const slowDown = () => {
    let release = () => {};
    slow = new Promise((resolve) => (release = resolve));
    return () => {
      slow = undefined;
      release();
    };
  };
  const players = seats.map(({ id }) => {
    const work = new SessionWork(new InMemoryGameRepository(), (session) => settleActions(settleSteal(session, clock.now()), clock.now()));
    const random = new QueuedRandomSource();
    const receive = new ReceiveMatch(work, clock);
    const flush = new FlushMatch(work, clock, counted(id));
    const tick = new TickImpl(work, clock, new QueuedRandomSource(), random);
    const submitGuess = new SubmitGuessImpl(work);
    const peekSecret = new PeekSecretImpl(work, clock, new QueuedRandomSource());
    const settled = async () => {
      await flush.execute();
      await delivered();
    };
    const viewOf = async (send: boolean): Promise<GameView> => {
      const response = await tick.execute();
      if (send) await settled();
      if (response.kind !== 'ticked') throw new Error('no game');
      return response.view;
    };
    return {
      id,
      random,
      /** What a phone does with what the room says: apply it, then ask what that needs. */
      async hear(event: RoomEvent) {
        await receive.execute(event);
        await flush.execute();
      },
      start: (state: Parameters<StartSteal['execute']>[1]) => new StartSteal(work, clock).execute(id, state),
      /** A guess submitted, the server not asked yet. */
      submitOnly: (code: Code) => submitGuess.execute({ guess: code }),
      async guess(code: Code) {
        const response = await submitGuess.execute({ guess: code });
        await settled();
        return response;
      },
      async peek(index: number) {
        const response = await peekSecret.execute({ index });
        await settled();
        return response;
      },
      distract: new DistractGuardianImpl(work, clock, new ScriptedRandomSource([FOOLED])),
      editDraft: new EditDraftImpl(work, clock),
      collectItem: new CollectItemImpl(work, clock, random),
      moveShield: new MoveShieldImpl(work),
      wipeInk: new WipeInk(work, clock),
      taunt: new Taunt(work, clock, new QueuedRandomSource()),
      settled,
      /** The phone's view now, after a tick and what it asks, as the screen does every 100 ms. */
      view: () => viewOf(true),
      /** The view after a tick, before anything is sent. */
      quietView: () => viewOf(false),
      async step() {
        await tick.execute();
        await settled();
      },
      async tickAndSend() {
        await tick.execute();
        void flush.execute();
        await Promise.resolve();
      },
      session: () => work.run((session) => ({ result: session })),
    };
  });
  for (const { id, sauce } of seats) await server.as(id).setSauce('ROOM', sauce);
  const state = await server.as('a').start('ROOM', seats.map(({ id, name }) => ({ id, name })));
  await delivered();
  for (const player of players) await player.start(state);
  for (const player of players) await player.moveShield.execute({ lane: 0 }); // the meatballs (lane 0) are blocked
  for (const player of players) await player.settled(); // each asks the server for its own sauce
  const runFor = async (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      for (const player of players) await player.step();
    }
  };
  const [ann, bob, cid] = players;
  return { clock, server, calls, runFor, slowDown, firstState: state, ann, bob, cid };
}

describe('Steal the sauce: the server holds the sauces', () => {
  it('shouldKnowOnlyItsOwnSauce', async () => {
    const { ann } = await match();
    const session = await ann.session();

    expect((await ann.view()).steal).toMatchObject({ mySecret: all('red') });
    expect(session?.game.secret).toBeUndefined();
    expect(JSON.stringify(session)).not.toContain('blue');
  });

  it('shouldGetTheScoreFromTheServer', async () => {
    const { ann } = await match();

    await ann.guess(['blue', 'blue', 'red', 'red']);

    expect(await ann.view()).toMatchObject({ pendingGuess: undefined, turns: [{ guess: ['blue', 'blue', 'red', 'red'], exact: 2, misplaced: 0 }], life: 9 });
  });

  it('shouldShowTheGuessAsPending_untilTheServerAnswers', async () => {
    const { ann } = await match();

    await ann.submitOnly(MISS);

    expect(await ann.quietView()).toMatchObject({ pendingGuess: MISS, turns: [], draft: [undefined, undefined, undefined, undefined] });
    await ann.settled();
    expect(await ann.quietView()).toMatchObject({ pendingGuess: undefined, turns: [{ guess: MISS }] });
  });

  it('shouldSendOneGuessAtATime', async () => {
    const { ann, calls } = await match();

    await ann.submitOnly(MISS);
    await ann.submitOnly(all('orange'));
    await ann.settled();

    expect(calls.filter((call) => call === 'a:guess')).toHaveLength(1);
    expect(await ann.quietView()).toMatchObject({ turns: [{ guess: MISS }] });
  });
});

describe('Steal the sauce: the circle', () => {
  it('shouldAttackTheNextSeat_whenMatchStarts', async () => {
    const { ann, bob, cid } = await match();

    expect([(await ann.view()).steal, (await bob.view()).steal, (await cid.view()).steal]).toMatchObject([
      { target: 'Bob', attacker: 'Cid' },
      { target: 'Cid', attacker: 'Ann' },
      { target: 'Ann', attacker: 'Bob' },
    ]);
  });

  it('shouldTurnTheCircleForEveryone_after45Seconds', async () => {
    const { ann, bob, cid, runFor } = await match();
    await runFor(45_000);

    expect([(await ann.view()).steal, (await bob.view()).steal, (await cid.view()).steal]).toMatchObject([
      { target: 'Cid', attacker: 'Bob' },
      { target: 'Ann', attacker: 'Cid' },
      { target: 'Bob', attacker: 'Ann' },
    ]);
  });

  it('shouldAskTheServerToTurn_onlyOnceUntilItAnswers', async () => {
    const { calls, runFor } = await match();
    await runFor(45_000);

    expect(calls.filter((call) => call.endsWith(':sync'))).toHaveLength(1);
  });

  it('shouldNotAskAgain_whileTheServerIsSlowToTurn', async () => {
    const { bob, calls, clock, runFor, slowDown } = await match();
    await runFor(44_900);
    const answer = slowDown();
    for (let tick = 0; tick < 5; tick += 1) {
      clock.advance(100);
      await bob.tickAndSend();
    }

    expect(calls.filter((call) => call === 'b:sync')).toHaveLength(1);
    answer();
  });

  it('shouldIgnoreAnOlderState_arrivingLate', async () => {
    const { bob, firstState, runFor } = await match();
    await runFor(45_000);

    await bob.hear({ type: 'state', state: firstState, cause: { kind: 'switch' } });

    expect(await bob.view()).toMatchObject({ steal: { target: 'Ann' } });
  });

  it('shouldWarnBeforeTheSwitch', async () => {
    const { bob, runFor } = await match();
    await runFor(42_000);

    expect(await bob.view()).toMatchObject({ steal: { switchInMs: 3000 } });
  });

  it('shouldKeepGuesses_whenTheCircleComesBack', async () => {
    const { ann, runFor } = await match();
    await ann.guess(MISS);
    await runFor(45_000);
    expect(await ann.view()).toMatchObject({ turns: [], steal: { target: 'Cid' } });

    await runFor(45_000);

    expect(await ann.view()).toMatchObject({ turns: [{ guess: MISS }], steal: { target: 'Bob' } });
  });

  it('shouldNotSwitch_withTwoPlayers', async () => {
    const { ann, runFor } = await match(2);
    await ann.guess(MISS);
    await runFor(45_000);

    expect(await ann.view()).toMatchObject({ turns: [{ guess: MISS }], steal: { target: 'Bob', attacker: 'Bob', switchInMs: undefined } });
  });
});

describe('Steal the sauce: cracking', () => {
  it('shouldScoreAndSwitchEveryone_whenTargetCracked', async () => {
    const { ann, bob, cid } = await match();

    await ann.guess(all('blue'));

    expect([await ann.view(), await bob.view(), await cid.view()]).toMatchObject([
      { steal: { notice: 'scored', target: 'Cid', scores: scoresWith(['Ann', 1], ['Bob', 0], ['Cid', 0]) } },
      { steal: { notice: 'robbed', target: 'Ann' } },
      { steal: { target: 'Bob' } },
    ]);
  });

  it('shouldLearnTheNewSauce_whenRobbed', async () => {
    const { ann, bob, server } = await match();
    server.newSauces.push(all('yellow'));

    await ann.guess(all('blue'));
    await bob.settled();

    expect(await bob.view()).toMatchObject({ steal: { mySecret: all('yellow') } });
  });

  it('shouldFaceTheNewSauce_whenTheCircleComesBackToTheRobbed', async () => {
    const { ann, runFor, server } = await match();
    server.newSauces.push(all('yellow'));
    await ann.guess(all('blue'));
    await runFor(45_000);
    expect(await ann.view()).toMatchObject({ turns: [], steal: { target: 'Bob' } });

    await ann.guess(all('yellow'));

    expect(await ann.view()).toMatchObject({ steal: { scores: scoresWith(['Ann', 2]) } });
  });
});

describe('Steal the sauce: peeking', () => {
  it('shouldShowThePegFromTheServer_whenAPeekGetsThrough', async () => {
    const { bob } = await match();
    await bob.distract.execute({ target: { x: 100, y: 0 } });

    const response = await bob.peek(2);

    expect(response).toEqual({ kind: 'revealed', index: 2, cooldownMs: 5000 }); // no colour yet: the server holds it
    expect(await bob.view()).toMatchObject({ pegUp: { index: 2, color: 'green' } });
  });

  it('shouldNotAskTheServer_whenCaught', async () => {
    const { bob, calls } = await match();

    expect(await bob.peek(2)).toMatchObject({ kind: 'caught' });
    expect(calls).not.toContain('b:peek');
  });

  it('shouldShowAPegBriefly_whenXrayCollected', async () => {
    const { cid, runFor } = await match();
    await runFor(8000); // the item's delay, drawn at the first tick (0.1 s), was 0: it shows at 8.1 s
    cid.random.queue(ITEM_KINDS.indexOf('xray')); // its kind
    await runFor(100);
    cid.random.queue(1); // the second peg

    await cid.collectItem.execute({ id: 0 });
    await cid.settled();

    expect(await cid.view()).toMatchObject({ revealed: [{ index: 1, color: 'red' }] });
  });
});

describe('Steal the sauce: defending', () => {
  it('shouldShowTheAttackerProgress_onMySauce', async () => {
    const { bob, cid } = await match();

    await bob.guess(['green', 'green', 'red', 'red']);

    expect(await cid.view()).toMatchObject({ steal: { attacker: 'Bob', threat: 2 } });
  });
});

describe('Steal the sauce: points and the end', () => {
  it('shouldLoseAPointOnTheServerAndGetLifeBack_whenKnockedOut', async () => {
    const { ann, bob } = await match();
    await ann.guess(all('blue')); // 1 point, now after Cid
    for (let miss = 0; miss < 10; miss += 1) await ann.guess(MISS);

    expect(await ann.view()).toMatchObject({ life: 10, steal: { scores: scoresWith(['Ann', 0]) } });
    expect(await bob.view()).toMatchObject({ steal: { scores: scoresWith(['Ann', 0]) } });
  });

  it('shouldEndAfterFiveMinutes_withTheTopScorerWinning', async () => {
    const { ann, bob, clock, runFor } = await match();
    await ann.guess(all('blue'));
    await runFor(299_900);
    expect(await ann.view()).toMatchObject({ status: 'playing' });
    clock.advance(100);

    expect([await ann.view(), await bob.view()]).toMatchObject([
      { status: 'won', life: 10, steal: { finished: true, scores: scoresWith(['Ann', 1]) } }, // time ends the match, not the life
      { status: 'lost', steal: { finished: true } },
    ]);
  });

  it('shouldRejectGuesses_whenTheMatchIsOver', async () => {
    const { ann, runFor } = await match();
    await runFor(300_000);

    expect(await ann.guess(MISS)).toMatchObject({ kind: 'rejected', reason: 'game-over' });
  });
});

describe('Round 14: see the others, ink them', () => {
  /** Lets the first item appear on this phone (8.1 s) as the given kind; answers its id. */
  async function itemFor(game: Awaited<ReturnType<typeof match>>, player: Awaited<ReturnType<typeof match>>['ann'], kind: string) {
    await game.runFor(8000);
    player.random.queue(MATCH_ITEM_KINDS.indexOf(kind as (typeof MATCH_ITEM_KINDS)[number]));
    await game.runFor(100);
    return 0;
  }

  it('shouldSeeTheAttackersGuesses_onMySauceLive', async () => {
    const { bob, cid } = await match();

    await bob.guess(['green', 'red', 'green', 'blue']);

    expect(await cid.view()).toMatchObject({ steal: { attempts: [{ by: 'Bob', guess: ['green', 'red', 'green', 'blue'], exact: 2, misplaced: 0 }] } });
  });

  it('shouldKeepOnlyTheLatestThreeAttempts', async () => {
    const { bob, cid } = await match();
    for (const color of ['purple', 'orange', 'yellow', 'red'] as const) await bob.guess(all(color));

    expect((await cid.view()).steal?.attempts.map(({ guess }) => guess[0])).toEqual(['orange', 'yellow', 'red']);
  });

  it('shouldInkThePlayerWhoseSauceIAmAfter_whenInkCollected', async () => {
    const game = await match();
    const { ann, bob, cid } = game;
    const id = await itemFor(game, ann, 'ink');

    await ann.collectItem.execute({ id });
    await ann.settled();

    expect(await ann.view()).toMatchObject({ steal: { notice: 'ink-thrown' } });
    expect(await bob.view()).toMatchObject({ steal: { notice: 'inked', ink: { by: 'Ann', left: 1 } } });
    expect((await cid.view()).steal?.ink).toBeUndefined();
  });

  it('shouldClearTheInk_asItIsWiped', async () => {
    const game = await match();
    const { ann, bob } = game;
    await ann.collectItem.execute({ id: await itemFor(game, ann, 'ink') });
    await ann.settled();

    expect(await bob.wipeInk.execute(0.6)).toMatchObject({ steal: { ink: { left: 0.4 } } });
    expect((await bob.wipeInk.execute(0.5))?.steal?.ink).toBeUndefined();
  });

  it('shouldFadeTheInk_after20SecondsEvenIfNotWiped', async () => {
    const game = await match();
    const { ann, bob, runFor } = game;
    await ann.collectItem.execute({ id: await itemFor(game, ann, 'ink') });
    await ann.settled();
    await runFor(19_900);
    expect((await bob.quietView()).steal?.ink).toBeDefined();

    await runFor(100);

    expect((await bob.quietView()).steal?.ink).toBeUndefined();
  });

  it('shouldNotShowInk_inASoloGame', async () => {
    const clock = new FakeClock();
    const work = new SessionWork(new InMemoryGameRepository());
    const asked: number[] = [];
    const items = { nextInt: (max: number) => (asked.push(max), 0) };
    await new StartGameImpl(new QueuedRandomSource(), work, clock).execute();
    const tick = new TickImpl(work, clock, new QueuedRandomSource(), items);
    await tick.execute();
    clock.advance(8000);

    await tick.execute(); // the item shows: its kind is drawn among the solo kinds, which have no ink

    expect(asked).toContain(ITEM_KINDS.length);
    expect(asked).not.toContain(MATCH_ITEM_KINDS.length);
  });

});

describe('Round 15: a clear knock-out (AC1)', () => {
  it('shouldShowTheKnockOutFor2_5Seconds', async () => {
    const { ann, clock } = await match();
    for (let miss = 0; miss < 10; miss += 1) await ann.guess(MISS);
    expect(await ann.view()).toMatchObject({ steal: { notice: 'knocked-out' } });
    clock.advance(2400);
    expect(await ann.view()).toMatchObject({ steal: { notice: 'knocked-out' } });

    clock.advance(100);

    expect((await ann.view()).steal?.notice).toBeUndefined();
  });
});

describe('Round 15: the taunt duel in a match (AC4, AC5)', () => {
  // Ann (a) is after Bob's sauce (all blue); Cid is after Ann's. Ann's offer: insults 0, 1, 2.
  async function annTauntsBob(insult = 2) {
    const game = await match();
    await game.ann.taunt.execute({ kind: 'open' });
    await game.ann.taunt.execute({ kind: 'say', insult });
    await game.ann.settled();
    return game;
  }

  it('shouldSendTheTaunt_toThePlayerWhoseSauceIAmAfter', async () => {
    const { ann, bob, cid } = await annTauntsBob();

    expect(await ann.view()).toMatchObject({ duel: { phase: 'waiting', insult: 2, opponent: 'Bob' } });
    expect(await bob.view()).toMatchObject({ duel: { phase: 'answering', insult: 2, from: 'Ann', leftMs: 5000 } });
    expect((await bob.view()).duel).toMatchObject({ choices: expect.arrayContaining([2]) });
    expect((await cid.view()).duel).toBeUndefined();
  });

  it('shouldWinTheDuelAndTakeTwoLife_whenTheRightComebackIsPicked', async () => {
    const { ann, bob } = await annTauntsBob();
    await bob.guess(MISS);
    await bob.guess(MISS); // Bob: 8

    await bob.taunt.execute({ kind: 'answer', comeback: 2 });
    await bob.settled();

    expect(await bob.view()).toMatchObject({ life: 10, duelResult: { won: true, penalty: 'life', opponent: 'Ann' } });
    expect(await ann.view()).toMatchObject({ life: 8, duelResult: { won: false, penalty: 'life', opponent: 'Bob' } });
    expect((await ann.view()).duel).toBeUndefined();
  });

  it('shouldApplyTheVerdictOnce_thoughHeardTwice', async () => {
    const { bob } = await annTauntsBob();
    const wrong = (await bob.view()).duel as { choices: number[] };

    await bob.taunt.execute({ kind: 'answer', comeback: wrong.choices.find((choice) => choice !== 2)! });
    await bob.settled();

    expect(await bob.view()).toMatchObject({ life: 8, duelResult: { won: false } });
  });

  it('shouldLoseTheDuel_whenNotAnsweringInTime_andSuffer', async () => {
    const game = await annTauntsBob();
    game.server.penalties.push('scramble');

    await game.runFor(6500);

    expect(await game.bob.view()).toMatchObject({ scrambled: true, duelResult: { won: false, penalty: 'scramble' } });
    expect(await game.ann.view()).toMatchObject({ duelResult: { won: true, penalty: 'scramble' } });
    expect((await game.ann.view()).scrambled).toBeUndefined();
  });

  it('shouldShowTheWinnerAPegOfTheSauceItIsAfter', async () => {
    const game = await annTauntsBob();
    game.server.penalties.push('peg');
    game.server.pegIndexes.push(2);

    await game.runFor(6500);

    expect((await game.ann.view()).revealed).toEqual([{ index: 2, color: 'blue' }]);
    expect((await game.bob.view()).revealed).toEqual([]);
  });

  it('shouldTurnTheLosersScreen_whenFlipped', async () => {
    const game = await annTauntsBob();
    game.server.penalties.push('flip');

    await game.runFor(6500);

    expect(await game.bob.view()).toMatchObject({ flipped: true });
    expect((await game.ann.view()).flipped).toBeUndefined();
  });

  it('shouldGiveTheChargesBack_whenTheServerRefusesTheTaunt', async () => {
    const { ann, cid } = await annTauntsBob(); // Cid is after Ann, who is in a duel
    await cid.taunt.execute({ kind: 'open' });
    await cid.taunt.execute({ kind: 'say', insult: 0 });
    await cid.settled();

    const view = await cid.view();

    expect(view.duel).toBeUndefined();
    expect(view.bar?.charges).toBe(3);
    expect((await ann.view()).duel).toMatchObject({ phase: 'waiting' });
  });
});
