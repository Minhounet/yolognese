import { CollectItemImpl } from '../../src/application/CollectItem';
import { FlushRaceImpl, ReceiveRaceImpl, StartRaceImpl } from '../../src/application/Race';
import { RaceLink } from '../../src/application/ports';
import { RoundAction } from '../../src/application/RoundAction';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { RoomEvent } from '../../src/domain/steal';
import { ITEM_KINDS } from '../../src/domain/round';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const PLAYERS = [
  { id: 'a', name: 'Ann' },
  { id: 'b', name: 'Bob' },
  { id: 'c', name: 'Cid' },
];
const SECRET = ['red', 'yellow', 'green', 'blue'] as const;
const MISS = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;

/** A room that delivers each event to every other player, as Supabase broadcast does. */
async function race(playerCount = 2) {
  const clock = new FakeClock();
  const sent: RoomEvent[] = [];
  const inFlight: Promise<unknown>[] = [];
  /** Waits until every message sent so far has been heard. */
  const delivered = async () => {
    while (inFlight.length > 0) await inFlight.shift();
  };
  const players = PLAYERS.slice(0, playerCount).map(({ id }) => {
    const work = new SessionWork(new InMemoryGameRepository());
    const random = new QueuedRandomSource();
    const action = new RoundAction(work, clock, random);
    const link: RaceLink = {
      send: (event) => {
        sent.push(event);
        for (const other of others(id)) inFlight.push(other.receive.execute(event));
      },
    };
    return {
      id,
      random,
      start: new StartRaceImpl(random, work, clock),
      receive: new ReceiveRaceImpl(work, clock, random),
      flush: new FlushRaceImpl(work, link),
      tick: new TickImpl(action),
      submitGuess: new SubmitGuessImpl(work, clock),
      collectItem: new CollectItemImpl(action),
      moveShield: new MoveShieldImpl(action),
      editDraft: new EditDraftImpl(action),
      /** A tick then a flush, as the screen does every 100 ms. */
      async step() {
        const response = await this.tick.execute();
        await this.flush.execute();
        await delivered();
        return response;
      },
    };
  });
  const others = (id: string) => players.filter((player) => player.id !== id);
  const host = players[0];
  host.random.queue(0, 1, 2, 3);
  const { secret } = await host.start.execute({ me: host.id, players: PLAYERS.slice(0, playerCount) });
  for (const player of others(host.id)) await player.start.execute({ me: player.id, players: PLAYERS.slice(0, playerCount), secret });
  const runFor = async (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      for (const player of players) await player.step();
    }
  };
  return { clock, players, sent, runFor, delivered, ann: players[0], bob: players[1] };
}

describe('Race: same secret, same start', () => {
  it('shouldGiveEveryoneTheHostSecret', async () => {
    const { bob } = await race();

    expect(await bob.submitGuess.execute({ guess: SECRET })).toMatchObject({ view: { status: 'won' } });
  });

  it('shouldListRivals_whenRaceStarts', async () => {
    const { ann } = await race(3);

    expect(await ann.tick.execute()).toMatchObject({
      view: { race: { rivals: [{ name: 'Bob', life: 10, bestExact: 0 }, { name: 'Cid', life: 10 }] } },
    });
  });
});

describe('Race: rivals see each other progress', () => {
  it('shouldShowRivalLifeAndBestExact_whenRivalGuesses', async () => {
    const { ann, bob } = await race();
    await bob.submitGuess.execute({ guess: ['red', 'yellow', 'purple', 'purple'] });
    await bob.flush.execute();

    expect(await ann.tick.execute()).toMatchObject({ view: { race: { rivals: [{ name: 'Bob', life: 9, bestExact: 2 }] } } });
  });

  it('shouldSendNothing_whenNothingChanged', async () => {
    const { ann, sent } = await race();
    await ann.step();
    await ann.step();

    expect(sent).toEqual([]);
  });
});

describe('Race: the first to crack wins', () => {
  it('shouldBeatRivals_whenOneCracksTheCode', async () => {
    const { ann, bob } = await race();
    await ann.submitGuess.execute({ guess: SECRET });
    await ann.flush.execute();

    expect(await bob.tick.execute()).toMatchObject({ kind: 'rejected', reason: 'game-over' });
    expect(await bob.receive.execute({ type: 'progress', from: 'a', life: 10, bestExact: 4 })).toMatchObject({
      status: 'lost',
      lostBy: 'beaten',
      notice: 'beaten',
      secret: SECRET,
      race: { beatenBy: 'Ann' },
    });
  });

  it('shouldWin_whenEveryRivalIsOut', async () => {
    const { ann, bob } = await race();
    for (let time = 0; time < 10; time += 1) await bob.submitGuess.execute(MISS);
    await bob.flush.execute();

    expect(await ann.step()).toMatchObject({ kind: 'rejected', reason: 'game-over' });
    expect(await ann.receive.execute({ type: 'progress', from: 'b', life: 0, bestExact: 0 })).toMatchObject({
      status: 'won',
      lastStanding: true,
    });
  });

  it('shouldKeepPlaying_whenOnlyOneOfTwoRivalsIsOut', async () => {
    const { ann, bob } = await race(3);
    for (let time = 0; time < 10; time += 1) await bob.submitGuess.execute(MISS);
    await bob.flush.execute();

    expect(await ann.tick.execute()).toMatchObject({ view: { status: 'playing', race: { rivals: [{ out: true }, { out: false }] } } });
  });
});

describe('Race: sabotage', () => {
  const SABOTAGE = ITEM_KINDS.indexOf('sabotage');

  async function sabotageAppearsFor(game: Awaited<ReturnType<typeof race>>, player: Awaited<ReturnType<typeof race>>['ann']): Promise<number> {
    await game.runFor(7900);
    player.random.queue(SABOTAGE);
    await game.runFor(100);
    const response = await player.tick.execute();
    if (response.kind !== 'done') throw new Error('no game');
    return response.view.items[0].id;
  }

  it('shouldShowSabotage_onlyInARace', async () => {
    const game = await race();

    expect(await sabotageAppearsFor(game, game.ann)).toBeDefined();
  });

  it('shouldThrowAtRival_whenSabotageCollected', async () => {
    const game = await race();
    const { ann, bob } = game;
    const id = await sabotageAppearsFor(game, ann);
    ann.random.queue(0, 1, 2); // the first rival in play, a fork, lane 2
    await ann.collectItem.execute({ id });
    await ann.flush.execute();

    expect(await bob.tick.execute()).toMatchObject({ view: { attack: { kind: 'fork', lane: 2, msToLand: 1000, fromName: 'Ann' } } });
  });

  it('shouldHitRival_whenTheirShieldIsElsewhere', async () => {
    const game = await race();
    const { ann, bob } = game;
    for (const player of game.players) await player.moveShield.execute({ lane: 0 }); // the guardians' throws are blocked
    const id = await sabotageAppearsFor(game, ann);
    ann.random.queue(0, 0, 2); // Bob, a meatball, lane 2
    await ann.collectItem.execute({ id });
    await ann.flush.execute();
    await game.runFor(1100); // it flies on Bob's next tick, then lands 1 s later

    expect(await bob.tick.execute()).toMatchObject({ view: { life: 8, notice: 'hit' } });
  });

  it('shouldNotDelayTheGuardianThrow_whenRivalThrowLands', async () => {
    const game = await race();
    const { ann, bob } = game;
    const id = await sabotageAppearsFor(game, ann); // at 8000; the guardian throws at 10000
    ann.random.queue(0, 0, 1); // Bob, a meatball, lane 1: on Bob's shield
    await ann.collectItem.execute({ id });
    await ann.flush.execute();
    await game.runFor(2100); // Ann's lands at 9100; the guardian's starts at 10000 as planned

    expect(await bob.tick.execute()).toMatchObject({ view: { attack: { lane: 0, fromName: undefined } } });
  });
});
