import { LobbyView, JoinRoomImpl, RoomPlay } from '../../src/application/RoomPlay';
import { SessionWork } from '../../src/application/SessionWork';
import { GameView } from '../../src/application/views';
import { Code } from '../../src/domain/color';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { FakeRoomGateway } from '../support/FakeRoomGateway';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];

/** Players on their own phones (own session, own chance), joining the same room through one fake network. */
function phones() {
  const gateway = new FakeRoomGateway();
  const clock = new FakeClock();
  const join = (name: string, sauce: Code[number] = 'red') => {
    const random = new QueuedRandomSource();
    random.queue(...all(sauce).map((color) => ['red', 'yellow', 'green', 'blue', 'purple', 'orange'].indexOf(color)));
    const seen: { lobby?: LobbyView; match?: GameView; game?: GameView } = {};
    const work = new SessionWork(new InMemoryGameRepository());
    const joinRoom = new JoinRoomImpl({ gateway, work, clock, random });
    const play: RoomPlay = joinRoom.execute(
      { code: ' abcd ', name },
      {
        onLobby: (view) => (seen.lobby = view),
        onMatch: (view) => (seen.match = view),
        onGame: (view) => (seen.game = view),
      },
    );
    const submitGuess = new SubmitGuessImpl(work, clock);
    return { play, seen, random, guess: (code: Code) => submitGuess.execute({ guess: code }) };
  };
  return { join, gateway, delivered: () => gateway.delivered() };
}

describe('RoomPlay: the lobby', () => {
  it('shouldMakeTheFirstInTheHost', () => {
    const { join } = phones();
    const ann = join('Ann');
    const bob = join('Bob');

    expect([ann.play.view(), bob.play.view()]).toMatchObject([
      { code: 'ABCD', isHost: true, hostName: 'Ann', members: [{ name: 'Ann', host: true, me: true }, { name: 'Bob', me: false }] },
      { isHost: false, hostName: 'Ann', members: [{ name: 'Ann', me: false }, { name: 'Bob', me: true }] },
    ]);
  });

  it('shouldNotStart_whenNotTheHost', async () => {
    const { join, delivered } = phones();
    const ann = join('Ann');
    const bob = join('Bob');

    await bob.play.start();
    await delivered();

    expect([bob.play.view().canStart, bob.seen.match, ann.seen.match]).toEqual([false, undefined, undefined]);
  });

  it('shouldNotStart_aloneInTheRoom', () => {
    const { join } = phones();

    expect(join('Ann').play.view()).toMatchObject({ isHost: true, canStart: false });
  });

  it('shouldGiveEachPlayerARandomSauce_onJoining', () => {
    const { join } = phones();

    expect(join('Ann', 'orange').play.view()).toMatchObject({ mySauce: all('orange') });
  });

  it('shouldLetOnlyTheHostPickTheMode', () => {
    const { join } = phones();
    const ann = join('Ann');
    const bob = join('Bob');
    bob.play.pickMode('race');
    expect(ann.play.view().mode).toBe('steal');

    ann.play.pickMode('race');

    expect(bob.play.view().mode).toBe('race');
  });
});

describe('RoomPlay: starting a match', () => {
  it('shouldStartStealTheSauce_withEachPlayerSauce', async () => {
    const { join, delivered } = phones();
    const ann = join('Ann', 'red');
    const bob = join('Bob', 'blue');

    await ann.play.start();
    await delivered();

    expect([ann.seen.match?.steal, bob.seen.match?.steal]).toMatchObject([
      { target: 'Bob', mySecret: all('red') },
      { target: 'Ann', mySecret: all('blue') },
    ]);
  });

  it('shouldUseTheLatestSauce_whenTheHostStartedWithAnOlderOne', async () => {
    const { join, gateway, delivered } = phones();
    const ann = join('Ann', 'red');
    const bob = join('Bob', 'blue');
    await delivered();
    gateway.presenceHeld = true; // Bob's change does not reach Ann before she starts
    bob.play.changeSauce(all('green'));

    await ann.play.start();
    await delivered();

    expect(bob.seen.match?.steal?.mySecret).toEqual(all('green'));
    expect(await ann.guess(all('green'))).toMatchObject({ view: { steal: { scores: expect.arrayContaining([expect.objectContaining({ name: 'Ann', points: 1 })]) } } });
  });

  it('shouldStartARace_withTheHostSecretForAll', async () => {
    const { join, delivered } = phones();
    const ann = join('Ann', 'purple');
    const bob = join('Bob', 'blue');
    ann.play.pickMode('race');
    ann.random.queue(...[4, 4, 4, 4]); // the race secret: purple

    await ann.play.start();
    await delivered();

    expect([ann.seen.match?.race, bob.seen.match?.race]).toMatchObject([{ rivals: [{ name: 'Bob' }] }, { rivals: [{ name: 'Ann' }] }]);
  });

  it('shouldLeaveOutTheSeventh_andIgnoreTheirStart', async () => {
    const { join, delivered } = phones();
    const players = ['Ann', 'Bob', 'Cid', 'Dan', 'Eve', 'Fay', 'Gus'].map((name) => join(name));
    await delivered();

    await players[0].play.start();
    await delivered();

    expect(players.map(({ seen }) => seen.match !== undefined)).toEqual([true, true, true, true, true, true, false]);
  });
});
