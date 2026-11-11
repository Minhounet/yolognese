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
function match(seatCount = 3) {
  const clock = new FakeClock();
  const seats = SEATS.slice(0, seatCount);
  const sent: RoomEvent[] = [];
  const muted = new Set<string>();
  const players = seats.map(({ id }) => {
    const repository = new InMemoryGameRepository();
    const random = new QueuedRandomSource();
    const action = new RoundAction(repository, clock, random);
    const link: RaceLink = {
      send: (event) => {
        sent.push(event);
        if (muted.has(id)) return; // lost on the way
        players.filter((other) => other.id !== id).forEach((other) => other.hear(event));
      },
    };
    const receive = new ReceiveRaceImpl(repository, clock, random);
    const flush = new FlushRaceImpl(repository, link);
    const tick = new TickImpl(action);
    const submitGuess = new SubmitGuessImpl(repository, clock);
    return {
      id,
      random,
      hear: (event: RoomEvent) => {
        receive.execute(event);
        flush.execute();
      },
      start: () => new StartStealImpl(random, repository, clock).execute({ me: id, players: seats }),
      guess: (code: { guess: Code }) => {
        const response = submitGuess.execute(code);
        flush.execute();
        return response;
      },
      collectItem: new CollectItemImpl(action),
      moveShield: new MoveShieldImpl(action),
      flush,
      /** The player's view now, after a tick and a flush, as the screen does every 100 ms. */
      view(): GameView {
        const response = tick.execute();
        flush.execute();
        if (response.kind !== 'done') throw new Error(`no view: ${response.reason}`);
        return response.view;
      },
      step() {
        tick.execute();
        flush.execute();
      },
    };
  });
  players.forEach((player) => player.start());
  players.forEach((player) => player.moveShield.execute({ lane: 0 })); // the guardians' throws (lane 0) are blocked
  const runFor = (milliseconds: number) => {
    for (let passed = 0; passed < milliseconds; passed += 100) {
      clock.advance(100);
      players.forEach((player) => player.step());
    }
  };
  const [ann, bob, cid] = players;
  return { clock, sent, runFor, ann, bob, cid, mute: (id: string) => muted.add(id) };
}

describe('Steal the sauce: the circle', () => {
  it('shouldAttackTheNextSeat_whenMatchStarts', () => {
    const { ann, bob, cid } = match();

    expect([ann.view().steal, bob.view().steal, cid.view().steal]).toMatchObject([
      { target: 'Bob', attacker: 'Cid', mySecret: all('red') },
      { target: 'Cid', attacker: 'Ann' },
      { target: 'Ann', attacker: 'Bob' },
    ]);
  });

  it('shouldGuessTheTargetSecret', () => {
    const { ann } = match();

    expect(ann.guess({ guess: ['blue', 'blue', 'red', 'red'] })).toMatchObject({ view: { turns: [{ exact: 2, misplaced: 0 }] } });
  });

  it('shouldTurnTheCircleForEveryone_after45Seconds', () => {
    const { ann, bob, cid, runFor } = match();
    runFor(45_000);

    expect([ann.view().steal, bob.view().steal, cid.view().steal]).toMatchObject([
      { target: 'Cid', attacker: 'Bob' },
      { target: 'Ann', attacker: 'Cid' },
      { target: 'Bob', attacker: 'Ann' },
    ]);
  });

  it('shouldWaitForTheHost_toTurnTheCircle', () => {
    const { bob, runFor, mute } = match();
    mute('a'); // the host's messages never arrive
    runFor(45_000);

    expect(bob.view()).toMatchObject({ steal: { target: 'Cid' } });
  });

  it('shouldWarnBeforeTheSwitch', () => {
    const { bob, runFor } = match();
    runFor(42_000);

    expect(bob.view()).toMatchObject({ steal: { switchInMs: 3000 } });
  });

  it('shouldKeepGuesses_whenTheCircleComesBack', () => {
    const { ann, runFor } = match();
    ann.guess(MISS);
    runFor(45_000);
    expect(ann.view()).toMatchObject({ turns: [], steal: { target: 'Cid' } });

    runFor(45_000);

    expect(ann.view()).toMatchObject({ turns: [{ guess: all('purple') }], steal: { target: 'Bob' } });
  });

  it('shouldNotSwitch_withTwoPlayers', () => {
    const { ann, runFor } = match(2);
    ann.guess(MISS);
    runFor(45_000);

    expect(ann.view()).toMatchObject({ turns: [{ guess: all('purple') }], steal: { target: 'Bob', attacker: 'Bob', switchInMs: undefined } });
  });
});

describe('Steal the sauce: cracking', () => {
  it('shouldScoreAndSwitchEveryone_whenTargetCracked', () => {
    const { ann, bob, cid } = match();

    ann.guess({ guess: all('blue') });

    expect([ann.view().steal, bob.view().steal, cid.view().steal]).toMatchObject([
      { target: 'Cid', scores: [{ name: 'Ann', points: 1, me: true }, { points: 0 }, { points: 0 }], waiting: false },
      { target: 'Ann', scores: [{ name: 'Ann', points: 1, me: false }, { points: 0 }, { points: 0 }] },
      { target: 'Bob' },
    ]);
  });

  it('shouldDrawANewSecret_whenRobbed', () => {
    const { ann, bob } = match();
    bob.random.queue(5, 5, 5, 5); // orange

    ann.guess({ guess: all('blue') });

    expect(bob.view()).toMatchObject({ notice: 'robbed', steal: { mySecret: all('orange') } });
  });

  it('shouldFaceTheNewSecret_whenTheCircleComesBackToTheRobbed', () => {
    const { ann, bob, runFor } = match();
    bob.random.queue(5, 5, 5, 5);
    ann.guess({ guess: all('blue') });
    runFor(45_000);
    expect(ann.view()).toMatchObject({ turns: [], steal: { target: 'Bob' } });

    expect(ann.guess({ guess: all('orange') })).toMatchObject({ view: { steal: { scores: scoresWith(['Ann', 2]) } } });
  });

  it('shouldSwitchOnCrack_whenANonHostCracks', () => {
    const { ann, bob, cid } = match();

    bob.guess({ guess: all('green') }); // Bob cracks Cid; Ann (the host) turns the circle

    expect([ann.view().steal, bob.view().steal, cid.view().steal]).toMatchObject([
      { target: 'Cid' },
      { target: 'Ann', waiting: false, scores: scoresWith(['Bob', 1]) },
      { target: 'Bob' },
    ]);
  });

  it('shouldKeepFacingTheSameRival_withANewSecret_withTwoPlayers', () => {
    const { ann, bob } = match(2);
    bob.random.queue(5, 5, 5, 5);
    ann.guess({ guess: all('blue') });

    expect(ann.guess({ guess: all('orange') })).toMatchObject({ view: { steal: { target: 'Bob', scores: scoresWith(['Ann', 2], ['Bob', 0]) } } });
  });
});

describe('Steal the sauce: defending', () => {
  it('shouldShowTheAttackerProgress_onMySecret', () => {
    const { bob, cid } = match();

    bob.guess({ guess: ['green', 'green', 'red', 'red'] });

    expect(cid.view()).toMatchObject({ steal: { attacker: 'Bob', threat: 2 } });
  });

  it('shouldThrowAtMyAttacker_whenSabotageCollected', () => {
    const { ann, cid, runFor } = match();
    runFor(7900);
    ann.random.queue(ITEM_KINDS.indexOf('sabotage'));
    runFor(100);
    const id = ann.view().items[0].id;
    ann.random.queue(1, 2); // a fork, lane 2

    ann.collectItem.execute({ id });
    ann.flush.execute();

    expect(cid.view()).toMatchObject({ attack: { kind: 'fork', lane: 2, fromName: 'Ann' } });
  });
});

describe('Steal the sauce: points and the end', () => {
  it('shouldLoseAPointAndGetLifeBack_whenKnockedOut', () => {
    const { ann, bob } = match();
    ann.guess({ guess: all('blue') }); // 1 point, now after Cid
    Array.from({ length: 10 }).forEach(() => ann.guess(MISS));

    expect(ann.view()).toMatchObject({ life: 10, notice: 'knocked-out', steal: { scores: scoresWith(['Ann', 0]) } });
    expect(bob.view()).toMatchObject({ steal: { scores: scoresWith(['Ann', 0]) } });
  });

  it('shouldEndAfterFiveMinutes_withTheTopScorerWinning', () => {
    const { ann, bob, clock, runFor } = match();
    ann.guess({ guess: all('blue') });
    runFor(299_900);
    expect(ann.view()).toMatchObject({ status: 'playing' });
    clock.advance(100);

    expect([ann.view(), bob.view()]).toMatchObject([
      { status: 'won', steal: { finished: true, scores: scoresWith(['Ann', 1]) } },
      { status: 'lost', steal: { finished: true } },
    ]);
  });

  it('shouldRejectGuesses_whenTheMatchIsOver', () => {
    const { ann, runFor } = match();
    runFor(300_000);

    expect(ann.guess(MISS)).toMatchObject({ kind: 'rejected', reason: 'game-over' });
  });
});
