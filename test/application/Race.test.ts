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
function race(playerCount = 2) {
  const clock = new FakeClock();
  const sent: RoomEvent[] = [];
  const players = PLAYERS.slice(0, playerCount).map(({ id }) => {
    const repository = new InMemoryGameRepository();
    const random = new QueuedRandomSource();
    const action = new RoundAction(repository, clock, random);
    const link: RaceLink = {
      send: (event) => {
        sent.push(event);
        others(id).forEach((other) => other.receive.execute(event));
      },
    };
    return {
      id,
      random,
      start: new StartRaceImpl(random, repository, clock),
      receive: new ReceiveRaceImpl(repository, clock, random),
      flush: new FlushRaceImpl(repository, link),
      tick: new TickImpl(action),
      submitGuess: new SubmitGuessImpl(repository, clock),
      collectItem: new CollectItemImpl(action),
      moveShield: new MoveShieldImpl(action),
      editDraft: new EditDraftImpl(action),
      /** A tick then a flush, as the screen does every 100 ms. */
      step() {
        const response = this.tick.execute();
        this.flush.execute();
        return response;
      },
    };
  });
  const others = (id: string) => players.filter((player) => player.id !== id);
  const host = players[0];
  host.random.queue(0, 1, 2, 3);
  const { secret } = host.start.execute({ me: host.id, players: PLAYERS.slice(0, playerCount) });
  others(host.id).forEach((player) => player.start.execute({ me: player.id, players: PLAYERS.slice(0, playerCount), secret }));
  const runFor = (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      players.forEach((player) => player.step());
    }
  };
  return { clock, players, sent, runFor, ann: players[0], bob: players[1] };
}

describe('Race: same secret, same start', () => {
  it('shouldGiveEveryoneTheHostSecret', () => {
    const { bob } = race();

    expect(bob.submitGuess.execute({ guess: SECRET })).toMatchObject({ view: { status: 'won' } });
  });

  it('shouldListRivals_whenRaceStarts', () => {
    const { ann } = race(3);

    expect(ann.tick.execute()).toMatchObject({
      view: { race: { rivals: [{ name: 'Bob', life: 10, bestExact: 0 }, { name: 'Cid', life: 10 }] } },
    });
  });
});

describe('Race: rivals see each other progress', () => {
  it('shouldShowRivalLifeAndBestExact_whenRivalGuesses', () => {
    const { ann, bob } = race();
    bob.submitGuess.execute({ guess: ['red', 'yellow', 'purple', 'purple'] });
    bob.flush.execute();

    expect(ann.tick.execute()).toMatchObject({ view: { race: { rivals: [{ name: 'Bob', life: 9, bestExact: 2 }] } } });
  });

  it('shouldSendNothing_whenNothingChanged', () => {
    const { ann, sent } = race();
    ann.step();
    ann.step();

    expect(sent).toEqual([]);
  });
});

describe('Race: the first to crack wins', () => {
  it('shouldBeatRivals_whenOneCracksTheCode', () => {
    const { ann, bob } = race();
    ann.submitGuess.execute({ guess: SECRET });
    ann.flush.execute();

    expect(bob.tick.execute()).toMatchObject({ kind: 'rejected', reason: 'game-over' });
    expect(bob.receive.execute({ type: 'progress', from: 'a', life: 10, bestExact: 4 })).toMatchObject({
      status: 'lost',
      lostBy: 'beaten',
      notice: 'beaten',
      secret: SECRET,
      race: { beatenBy: 'Ann' },
    });
  });

  it('shouldWin_whenEveryRivalIsOut', () => {
    const { ann, bob } = race();
    Array.from({ length: 10 }).forEach(() => bob.submitGuess.execute(MISS));
    bob.flush.execute();

    expect(ann.step()).toMatchObject({ kind: 'rejected', reason: 'game-over' });
    expect(ann.receive.execute({ type: 'progress', from: 'b', life: 0, bestExact: 0 })).toMatchObject({
      status: 'won',
      lastStanding: true,
    });
  });

  it('shouldKeepPlaying_whenOnlyOneOfTwoRivalsIsOut', () => {
    const { ann, bob } = race(3);
    Array.from({ length: 10 }).forEach(() => bob.submitGuess.execute(MISS));
    bob.flush.execute();

    expect(ann.tick.execute()).toMatchObject({ view: { status: 'playing', race: { rivals: [{ out: true }, { out: false }] } } });
  });
});

describe('Race: sabotage', () => {
  const SABOTAGE = ITEM_KINDS.indexOf('sabotage');

  function sabotageAppearsFor(game: ReturnType<typeof race>, player: ReturnType<typeof race>['ann']): number {
    game.runFor(7900);
    player.random.queue(SABOTAGE);
    game.runFor(100);
    const response = player.tick.execute();
    if (response.kind !== 'done') throw new Error('no game');
    return response.view.items[0].id;
  }

  it('shouldShowSabotage_onlyInARace', () => {
    const game = race();

    expect(sabotageAppearsFor(game, game.ann)).toBeDefined();
  });

  it('shouldThrowAtRival_whenSabotageCollected', () => {
    const game = race();
    const { ann, bob } = game;
    const id = sabotageAppearsFor(game, ann);
    ann.random.queue(0, 1, 2); // the first rival in play, a fork, lane 2
    ann.collectItem.execute({ id });
    ann.flush.execute();

    expect(bob.tick.execute()).toMatchObject({ view: { attack: { kind: 'fork', lane: 2, msToLand: 1000, fromName: 'Ann' } } });
  });

  it('shouldHitRival_whenTheirShieldIsElsewhere', () => {
    const game = race();
    const { ann, bob } = game;
    game.players.forEach((player) => player.moveShield.execute({ lane: 0 })); // the guardians' throws are blocked
    const id = sabotageAppearsFor(game, ann);
    ann.random.queue(0, 0, 2); // Bob, a meatball, lane 2
    ann.collectItem.execute({ id });
    ann.flush.execute();
    game.runFor(1100); // it flies on Bob's next tick, then lands 1 s later

    expect(bob.tick.execute()).toMatchObject({ view: { life: 8, notice: 'hit' } });
  });

  it('shouldNotDelayTheGuardianThrow_whenRivalThrowLands', () => {
    const game = race();
    const { ann, bob } = game;
    const id = sabotageAppearsFor(game, ann); // at 8000; the guardian throws at 10000
    ann.random.queue(0, 0, 1); // Bob, a meatball, lane 1: on Bob's shield
    ann.collectItem.execute({ id });
    ann.flush.execute();
    game.runFor(2100); // Ann's lands at 9100; the guardian's starts at 10000 as planned

    expect(bob.tick.execute()).toMatchObject({ view: { attack: { lane: 0, fromName: undefined } } });
  });
});
