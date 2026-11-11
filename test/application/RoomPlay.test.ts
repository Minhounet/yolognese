import { LobbyView, JoinRoomImpl, RoomPlay } from '../../src/application/RoomPlay';
import { SessionWork } from '../../src/application/SessionWork';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { GameView } from '../../src/application/views';
import { COLORS, Code } from '../../src/domain/color';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { FakeMatchServer } from '../support/FakeMatchServer';
import { FakeRoomGateway } from '../support/FakeRoomGateway';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];
const ROOM = 'ABCD';

/** Players on their own phones (own session, own chance), in one room, refereed by one fake match server. */
function phones() {
  const gateway = new FakeRoomGateway();
  const clock = new FakeClock();
  const server = new FakeMatchServer(clock, (event) => gateway.broadcast(ROOM, event));
  let joined = 0;
  const join = async (name: string, sauce: Code[number] = 'red') => {
    const id = `p${++joined}`;
    gateway.ids.push(id);
    const random = new QueuedRandomSource();
    random.queue(...all(sauce).map((color) => COLORS.indexOf(color)));
    const seen: { lobby?: LobbyView; match?: GameView; game?: GameView; matches: number } = { matches: 0 };
    const work = new SessionWork(new InMemoryGameRepository());
    const joinRoom = new JoinRoomImpl({ gateway, server: server.as(id), work, clock, random });
    const play: RoomPlay = await joinRoom.execute(
      { code: ' abcd ', name },
      {
        onLobby: (view) => (seen.lobby = view),
        onMatch: (view) => {
          seen.match = view;
          seen.matches += 1;
        },
        onGame: (view) => (seen.game = view),
      },
    );
    const submitGuess = new SubmitGuessImpl(work, clock);
    return {
      play,
      seen,
      random,
      async guess(code: Code) {
        await submitGuess.execute({ guess: code });
        await play.flush();
        await gateway.delivered();
      },
    };
  };
  return { join, gateway, delivered: () => gateway.delivered() };
}

describe('RoomPlay: the lobby', () => {
  it('shouldMakeTheFirstInTheHost', async () => {
    const { join } = phones();
    const ann = await join('Ann');
    const bob = await join('Bob');

    expect([ann.play.view(), bob.play.view()]).toMatchObject([
      { code: ROOM, isHost: true, hostName: 'Ann', members: [{ name: 'Ann', host: true, me: true }, { name: 'Bob', me: false }] },
      { isHost: false, hostName: 'Ann', members: [{ name: 'Ann', me: false }, { name: 'Bob', me: true }] },
    ]);
  });

  it('shouldNotStart_whenNotTheHost', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann');
    const bob = await join('Bob');

    await bob.play.start();
    await delivered();

    expect([bob.play.view().canStart, bob.seen.match, ann.seen.match]).toEqual([false, undefined, undefined]);
  });

  it('shouldNotStart_aloneInTheRoom', async () => {
    const { join } = phones();

    expect((await join('Ann')).play.view()).toMatchObject({ isHost: true, canStart: false });
  });

  it('shouldGiveEachPlayerARandomSauce_onJoining', async () => {
    const { join } = phones();

    expect((await join('Ann', 'orange')).play.view()).toMatchObject({ mySauce: all('orange') });
  });

  it('shouldNotShowTheSauce_toTheRoom', async () => {
    const { join } = phones();
    const ann = await join('Ann', 'orange');
    await join('Bob');

    expect(JSON.stringify((ann.play as unknown as { room: { members(): unknown } }).room.members())).not.toContain('orange');
  });

  it('shouldLetOnlyTheHostPickTheMode', async () => {
    const { join } = phones();
    const ann = await join('Ann');
    const bob = await join('Bob');
    bob.play.pickMode('race');
    expect(ann.play.view().mode).toBe('steal');

    ann.play.pickMode('race');

    expect(bob.play.view().mode).toBe('race');
  });
});

describe('RoomPlay: starting a match', () => {
  it('shouldStartStealTheSauce_onTheServer_forEveryone', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann', 'red');
    const bob = await join('Bob', 'blue');

    await ann.play.start();
    await delivered();
    await bob.play.flush();

    expect([ann.seen.match?.steal, bob.seen.match?.steal]).toMatchObject([{ target: 'Bob' }, { target: 'Ann' }]);
    await ann.guess(all('blue'));
    expect(bob.seen.game).toMatchObject({ notice: 'robbed', steal: { scores: [{ name: 'Ann', points: 1 }, { name: 'Bob', points: 0 }] } });
  });

  it('shouldStartOnce_whenTheHostAlsoHearsTheStart', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann');
    const bob = await join('Bob');

    await ann.play.start();
    await delivered();

    expect([ann.seen.matches, bob.seen.matches]).toEqual([1, 1]);
  });

  it('shouldPlayTheSauceChosenLast', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann', 'red');
    const bob = await join('Bob', 'blue');
    bob.play.changeSauce(all('green'));
    await delivered();

    await ann.play.start();
    await delivered();
    await ann.guess(all('green'));

    expect(bob.seen.game?.notice).toBe('robbed');
  });

  it('shouldStartARace_withTheHostSecretForAll', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann', 'purple');
    const bob = await join('Bob', 'blue');
    ann.play.pickMode('race');
    ann.random.queue(4, 4, 4, 4);

    await ann.play.start();
    await delivered();

    expect([ann.seen.match?.race, bob.seen.match?.race]).toMatchObject([{ rivals: [{ name: 'Bob' }] }, { rivals: [{ name: 'Ann' }] }]);
  });

  it('shouldLeaveOutTheSeventh_andIgnoreTheirStart', async () => {
    const { join, delivered } = phones();
    const players = [];
    for (const name of ['Ann', 'Bob', 'Cid', 'Dan', 'Eve', 'Fay', 'Gus']) players.push(await join(name));
    await delivered();

    await players[0].play.start();
    await delivered();

    expect(players.map(({ seen }) => seen.match !== undefined)).toEqual([true, true, true, true, true, true, false]);
  });
});
