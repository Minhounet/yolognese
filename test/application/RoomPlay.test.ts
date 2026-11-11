import { JoinRoom, LobbyView, RoomPlay } from '../../src/application/RoomPlay';
import { SessionWork } from '../../src/application/SessionWork';
import { settleSteal } from '../../src/application/stealMatch';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { GameView } from '../../src/application/views';
import { COLORS, Code } from '../../src/domain/color';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { FakeMatchServer } from '../support/FakeMatchServer';
import { FakeRoomGateway } from '../support/FakeRoomGateway';
import { FakeScheduler } from '../support/FakeScheduler';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const all = (color: Code[number]): Code => [color, color, color, color];
const ROOM = 'ABCD';

/** Players on their own phones (own session, own chance), in one room, refereed by one fake match server. */
function phones() {
  const gateway = new FakeRoomGateway();
  const clock = new FakeClock();
  const server = new FakeMatchServer(clock, (event) => gateway.broadcast(ROOM, event));
  const scheduler = new FakeScheduler(clock);
  let joined = 0;
  let bots = 0;
  const botConnection = () => {
    const id = `bot${++bots}`;
    gateway.ids.push(id);
    return { gateway, server: server.as(id) };
  };
  const join = async (name: string, sauce: Code[number] = 'red') => {
    const id = `p${++joined}`;
    gateway.ids.push(id);
    const random = new QueuedRandomSource();
    random.queue(...all(sauce).map((color) => COLORS.indexOf(color)));
    const seen: { lobby?: LobbyView; match?: GameView; game?: GameView; matches: number } = { matches: 0 };
    const work = new SessionWork(new InMemoryGameRepository(), (session) => settleSteal(session, clock.now()));
    const joinRoom = new JoinRoom({ gateway, server: server.as(id), work, clock, random, scheduler, botConnection });
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
    const submitGuess = new SubmitGuessImpl(work);
    return {
      play,
      seen,
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
});

describe('RoomPlay: starting a match', () => {
  it('shouldStartStealTheSauce_onTheServer_forEveryone', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann', 'red');
    const bob = await join('Bob', 'blue');

    await ann.play.start();
    await delivered();

    expect([ann.seen.match?.steal, bob.seen.match?.steal]).toMatchObject([{ target: 'Bob' }, { target: 'Ann' }]);
    await ann.guess(all('blue'));
    expect(bob.seen.game).toMatchObject({ steal: { notice: 'robbed', scores: [{ name: 'Ann', points: 1 }, { name: 'Bob', points: 0 }] } });
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

    expect(bob.seen.game?.steal?.notice).toBe('robbed');
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

describe('RoomPlay: test bots', () => {
  it('shouldLetTheHostFillTheRoomWithBots', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann');

    await ann.play.addBot();
    await ann.play.addBot();
    await delivered();

    expect(ann.play.view()).toMatchObject({ canStart: true, members: [{ name: 'Ann' }, { name: '🤖 Bot 1' }, { name: '🤖 Bot 2' }] });
  });

  it('shouldPlayAMatch_withBotsAlone', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann');
    await ann.play.addBot();
    await delivered();

    await ann.play.start();
    await delivered();

    expect(ann.seen.match?.steal).toMatchObject({ target: '🤖 Bot 1', attacker: '🤖 Bot 1' });
  });

  it('shouldNotAddBots_whenNotTheHost_orTheRoomIsFull', async () => {
    const { join, delivered } = phones();
    const ann = await join('Ann');
    const bob = await join('Bob');
    expect(bob.play.view().canAddBot).toBe(false);
    for (let bot = 0; bot < 6; bot += 1) await ann.play.addBot();
    await delivered();

    expect(ann.play.view()).toMatchObject({ canAddBot: false });
    expect(ann.play.view().members).toHaveLength(6);
  });

  it('shouldTakeTheBotsAlong_whenTheHostLeaves', async () => {
    const { join, gateway, delivered } = phones();
    const ann = await join('Ann');
    await ann.play.addBot();
    await delivered();

    ann.play.leave();
    const watcher = await gateway.join(ROOM, { name: 'Zed' }, { onMembers: () => undefined, onStatus: () => undefined, onEvent: () => undefined });

    expect(watcher.members().map(({ name }) => name)).toEqual(['Zed']);
  });
});
