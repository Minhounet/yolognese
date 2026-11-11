import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { MatchServer, RaceLink } from '../../src/application/ports';
import { FlushRaceImpl, ReceiveRaceImpl, StartStealImpl } from '../../src/application/Race';
import { RoundAction } from '../../src/application/RoundAction';
import { SessionWork } from '../../src/application/SessionWork';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { GameView } from '../../src/application/views';
import { Code } from '../../src/domain/color';
import { ITEM_KINDS } from '../../src/domain/round';
import { RoomEvent } from '../../src/domain/steal';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { FakeMatchServer } from '../support/FakeMatchServer';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];
const SEATS = [
  { id: 'a', name: 'Ann', sauce: all('red') },
  { id: 'b', name: 'Bob', sauce: all('blue') },
  { id: 'c', name: 'Cid', sauce: all('green') },
];
const MISS = all('purple');
const scoresWith = (...pairs: [string, number][]) =>
  expect.arrayContaining(pairs.map(([name, points]) => expect.objectContaining({ name, points })));

/**
 * A match refereed by the fake match server (the SQL rules in memory): each
 * phone has its own session; the server's and the phones' messages reach every
 * other phone a moment later, as through Supabase Realtime. Ann is the host.
 */
async function match(seatCount = 3) {
  const clock = new FakeClock();
  const seats = SEATS.slice(0, seatCount);
  const inFlight: Promise<unknown>[] = [];
  const delivered = async () => {
    while (inFlight.length > 0) await inFlight.shift();
  };
  const toEveryone = (event: RoomEvent, except?: string) =>
    players.filter(({ id }) => id !== except).forEach((player) => inFlight.push(player.hear(event)));
  const server = new FakeMatchServer(clock, (event) => toEveryone(event));
  const calls: string[] = [];
  /** While set, the server's answers wait for it: a slow network. */
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
    const work = new SessionWork(new InMemoryGameRepository());
    const random = new QueuedRandomSource();
    const action = new RoundAction(work, clock, random);
    const link: RaceLink = { send: (event) => toEveryone(event, id) };
    const receive = new ReceiveRaceImpl(work, clock, random);
    const flush = new FlushRaceImpl(work, link, clock, counted(id));
    const tick = new TickImpl(action);
    const submitGuess = new SubmitGuessImpl(work, clock);
    const peekSecret = new PeekSecretImpl(work, clock);
    const settled = async () => {
      await flush.execute();
      await delivered();
    };
    return {
      id,
      random,
      server: server.as(id),
      /** What a phone does with a message: apply it, then send/ask what that produced. */
      async hear(event: RoomEvent) {
        await receive.execute(event);
        await flush.execute();
      },
      start: (state: Parameters<StartStealImpl['execute']>[0]['state']) => new StartStealImpl(random, work, clock).execute({ me: id, state }),
      /** A guess submitted, the server not asked yet (no flush). */
      submitOnly: (code: Code) => submitGuess.execute({ guess: code }),
      /** The view after a tick, before anything is sent. */
      async quietView(): Promise<GameView> {
        const response = await tick.execute();
        if (response.kind !== 'done') throw new Error(`no view: ${response.reason}`);
        return response.view;
      },
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
      distract: new DistractGuardianImpl(work, clock),
      editDraft: new EditDraftImpl(action),
      collectItem: new CollectItemImpl(action),
      moveShield: new MoveShieldImpl(action),
      settled,
      /** The phone's view now, after a tick and a flush, as the screen does every 100 ms. */
      async view(): Promise<GameView> {
        const response = await tick.execute();
        await settled();
        if (response.kind !== 'done') throw new Error(`no view: ${response.reason}`);
        return response.view;
      },
      async step() {
        await tick.execute();
        await settled();
      },
      /** A tick and a flush, without waiting for the server's answers. */
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
  for (const player of players) await player.moveShield.execute({ lane: 0 }); // the guardians' throws (lane 0) are blocked
  for (const player of players) await player.settled(); // each asks the server for its own sauce
  const runFor = async (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      for (const player of players) await player.step();
    }
  };
  const [ann, bob, cid] = players;
  return { clock, server, calls, runFor, delivered, slowDown, firstState: state, ann, bob, cid };
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

    expect(calls.filter((call) => call.endsWith(':sync'))).toHaveLength(1); // the first phone's sync turns it for all
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
      { notice: 'scored', steal: { target: 'Cid', scores: scoresWith(['Ann', 1], ['Bob', 0], ['Cid', 0]) } },
      { notice: 'robbed', steal: { target: 'Ann' } },
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

    expect(response).toMatchObject({ kind: 'revealed', color: undefined });
    expect(await bob.view()).toMatchObject({ reveal: { index: 2, color: 'green' } });
  });

  it('shouldNotAskTheServer_whenCaught', async () => {
    const { bob, calls } = await match();

    expect(await bob.peek(2)).toMatchObject({ kind: 'caught' });
    expect(calls).not.toContain('b:peek');
  });

  it('shouldShowAPegBriefly_whenXrayCollected', async () => {
    const { cid, runFor } = await match();
    await runFor(7900);
    cid.random.queue(ITEM_KINDS.indexOf('xray'));
    await runFor(100);
    const id = (await cid.view()).items[0].id;
    cid.random.queue(1); // the second peg

    await cid.collectItem.execute({ id });
    await cid.settled();

    expect(await cid.view()).toMatchObject({ xray: { index: 1, color: 'red' } });
  });
});

describe('Steal the sauce: defending', () => {
  it('shouldShowTheAttackerProgress_onMySauce', async () => {
    const { bob, cid } = await match();

    await bob.guess(['green', 'green', 'red', 'red']);

    expect(await cid.view()).toMatchObject({ steal: { attacker: 'Bob', threat: 2 } });
  });

  it('shouldThrowAtMyAttacker_whenSabotageCollected', async () => {
    const { ann, cid, runFor } = await match();
    await runFor(7900);
    ann.random.queue(ITEM_KINDS.indexOf('sabotage'));
    await runFor(100);
    const id = (await ann.view()).items[0].id;
    ann.random.queue(1, 2); // a fork, lane 2

    await ann.collectItem.execute({ id });
    await ann.settled();

    expect(await cid.view()).toMatchObject({ attack: { kind: 'fork', lane: 2, fromName: 'Ann' } });
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
      { status: 'won', steal: { finished: true, scores: scoresWith(['Ann', 1]) } },
      { status: 'lost', steal: { finished: true } },
    ]);
  });

  it('shouldRejectGuesses_whenTheMatchIsOver', async () => {
    const { ann, runFor } = await match();
    await runFor(300_000);

    expect(await ann.guess(MISS)).toMatchObject({ kind: 'rejected', reason: 'game-over' });
  });
});
