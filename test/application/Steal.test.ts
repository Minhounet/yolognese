import { CollectItemImpl } from '../../src/application/CollectItem';
import { FlushRaceImpl, ReceiveRaceImpl, StartStealImpl } from '../../src/application/Race';
import { RaceLink } from '../../src/application/ports';
import { RoundAction } from '../../src/application/RoundAction';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { GameView } from '../../src/application/views';
import { Code } from '../../src/domain/color';
import { ITEM_KINDS } from '../../src/domain/round';
import { RoomEvent } from '../../src/domain/steal';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];
const SEATS = [
  { id: 'a', name: 'Ann', secret: all('red') },
  { id: 'b', name: 'Bob', secret: all('blue') },
  { id: 'c', name: 'Cid', secret: all('green') },
];
const MISS = { guess: all('purple') };
/** The scores, in any order, include these (name, points) pairs. */
const scoresWith = (...pairs: [string, number][]) =>
  expect.arrayContaining(pairs.map(([name, points]) => expect.objectContaining({ name, points })));

/** A match in a room that delivers each event to every other player; the host (Ann) is seated first. */
async function match(seatCount = 3) {
  const clock = new FakeClock();
  const seats = SEATS.slice(0, seatCount);
  const sent: RoomEvent[] = [];
  const muted = new Set<string>();
  const inFlight: Promise<unknown>[] = [];
  /** Waits until every message sent so far (and every answer to them) has been heard. */
  const delivered = async () => {
    while (inFlight.length > 0) await inFlight.shift();
  };
  const players = seats.map(({ id }) => {
    const work = new SessionWork(new InMemoryGameRepository());
    const random = new QueuedRandomSource();
    const action = new RoundAction(work, clock, random);
    const link: RaceLink = {
      send: (event) => {
        sent.push(event);
        if (muted.has(id)) return; // lost on the way
        players.filter((other) => other.id !== id).forEach((other) => inFlight.push(other.hear(event)));
      },
    };
    const receive = new ReceiveRaceImpl(work, clock, random);
    const flush = new FlushRaceImpl(work, link);
    const tick = new TickImpl(action);
    const submitGuess = new SubmitGuessImpl(work, clock);
    return {
      id,
      random,
      /** What a phone does with a message: apply it, then send what that produced. */
      async hear(event: RoomEvent) {
        await receive.execute(event);
        await flush.execute();
      },
      start: () => new StartStealImpl(random, work, clock).execute({ me: id, players: seats }),
      async guess(code: { guess: Code }) {
        const response = await submitGuess.execute(code);
        await flush.execute();
        await delivered();
        return response;
      },
      collectItem: new CollectItemImpl(action),
      moveShield: new MoveShieldImpl(action),
      async flush() {
        await flush.execute();
        await delivered();
      },
      /** The player's view now, after a tick and a flush, as the screen does every 100 ms. */
      async view(): Promise<GameView> {
        const response = await tick.execute();
        await flush.execute();
        await delivered();
        if (response.kind !== 'done') throw new Error(`no view: ${response.reason}`);
        return response.view;
      },
      async step() {
        await tick.execute();
        await flush.execute();
        await delivered();
      },
    };
  });
  for (const player of players) await player.start();
  for (const player of players) await player.moveShield.execute({ lane: 0 }); // the guardians' throws (lane 0) are blocked
  const runFor = async (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      for (const player of players) await player.step();
    }
  };
  const [ann, bob, cid] = players;
  return { clock, sent, runFor, ann, bob, cid, mute: (id: string) => muted.add(id) };
}

describe('Steal the sauce: the circle', () => {
  it('shouldAttackTheNextSeat_whenMatchStarts', async () => {
    const { ann, bob, cid } = await match();

    expect([(await ann.view()).steal, (await bob.view()).steal, (await cid.view()).steal]).toMatchObject([
      { target: 'Bob', attacker: 'Cid', mySecret: all('red') },
      { target: 'Cid', attacker: 'Ann' },
      { target: 'Ann', attacker: 'Bob' },
    ]);
  });

  it('shouldGuessTheTargetSecret', async () => {
    const { ann } = await match();

    expect(await ann.guess({ guess: ['blue', 'blue', 'red', 'red'] })).toMatchObject({ view: { turns: [{ exact: 2, misplaced: 0 }] } });
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

  it('shouldWaitForTheHost_toTurnTheCircle', async () => {
    const { bob, runFor, mute } = await match();
    mute('a'); // the host's messages never arrive
    await runFor(45_000);

    expect(await bob.view()).toMatchObject({ steal: { target: 'Cid' } });
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

    expect(await ann.view()).toMatchObject({ turns: [{ guess: all('purple') }], steal: { target: 'Bob' } });
  });

  it('shouldNotSwitch_withTwoPlayers', async () => {
    const { ann, runFor } = await match(2);
    await ann.guess(MISS);
    await runFor(45_000);

    expect(await ann.view()).toMatchObject({ turns: [{ guess: all('purple') }], steal: { target: 'Bob', attacker: 'Bob', switchInMs: undefined } });
  });
});

describe('Steal the sauce: cracking', () => {
  it('shouldScoreAndSwitchEveryone_whenTargetCracked', async () => {
    const { ann, bob, cid } = await match();

    await ann.guess({ guess: all('blue') });

    expect([(await ann.view()).steal, (await bob.view()).steal, (await cid.view()).steal]).toMatchObject([
      { target: 'Cid', scores: [{ name: 'Ann', points: 1, me: true }, { points: 0 }, { points: 0 }], waiting: false },
      { target: 'Ann', scores: [{ name: 'Ann', points: 1, me: false }, { points: 0 }, { points: 0 }] },
      { target: 'Bob' },
    ]);
  });

  it('shouldDrawANewSecret_whenRobbed', async () => {
    const { ann, bob } = await match();
    bob.random.queue(5, 5, 5, 5); // orange

    await ann.guess({ guess: all('blue') });

    expect(await bob.view()).toMatchObject({ notice: 'robbed', steal: { mySecret: all('orange') } });
  });

  it('shouldFaceTheNewSecret_whenTheCircleComesBackToTheRobbed', async () => {
    const { ann, bob, runFor } = await match();
    bob.random.queue(5, 5, 5, 5);
    await ann.guess({ guess: all('blue') });
    await runFor(45_000);
    expect(await ann.view()).toMatchObject({ turns: [], steal: { target: 'Bob' } });

    expect(await ann.guess({ guess: all('orange') })).toMatchObject({ view: { steal: { scores: scoresWith(['Ann', 2]) } } });
  });

  it('shouldSwitchOnCrack_whenANonHostCracks', async () => {
    const { ann, bob, cid } = await match();

    await bob.guess({ guess: all('green') }); // Bob cracks Cid; Ann (the host) turns the circle

    expect([(await ann.view()).steal, (await bob.view()).steal, (await cid.view()).steal]).toMatchObject([
      { target: 'Cid' },
      { target: 'Ann', waiting: false, scores: scoresWith(['Bob', 1]) },
      { target: 'Bob' },
    ]);
  });

  it('shouldKeepFacingTheSameRival_withANewSecret_withTwoPlayers', async () => {
    const { ann, bob } = await match(2);
    bob.random.queue(5, 5, 5, 5);
    await ann.guess({ guess: all('blue') });

    expect(await ann.guess({ guess: all('orange') })).toMatchObject({ view: { steal: { target: 'Bob', scores: scoresWith(['Ann', 2], ['Bob', 0]) } } });
  });
});

describe('Steal the sauce: defending', () => {
  it('shouldShowTheAttackerProgress_onMySecret', async () => {
    const { bob, cid } = await match();

    await bob.guess({ guess: ['green', 'green', 'red', 'red'] });

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
    await ann.flush();

    expect(await cid.view()).toMatchObject({ attack: { kind: 'fork', lane: 2, fromName: 'Ann' } });
  });
});

describe('Steal the sauce: points and the end', () => {
  it('shouldLoseAPointAndGetLifeBack_whenKnockedOut', async () => {
    const { ann, bob } = await match();
    await ann.guess({ guess: all('blue') }); // 1 point, now after Cid
    for (let time = 0; time < 10; time += 1) await ann.guess(MISS);

    expect(await ann.view()).toMatchObject({ life: 10, notice: 'knocked-out', steal: { scores: scoresWith(['Ann', 0]) } });
    expect(await bob.view()).toMatchObject({ steal: { scores: scoresWith(['Ann', 0]) } });
  });

  it('shouldEndAfterFiveMinutes_withTheTopScorerWinning', async () => {
    const { ann, bob, clock, runFor } = await match();
    await ann.guess({ guess: all('blue') });
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
