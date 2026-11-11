import { MatchServer } from '../../src/application/ports';
import { SauceBot } from '../../src/application/SauceBot';
import { RoomEvent } from '../../src/domain/steal';
import { FakeClock } from '../support/FakeClock';
import { FakeMatchServer } from '../support/FakeMatchServer';
import { FakeRoomGateway } from '../support/FakeRoomGateway';
import { FakeScheduler } from '../support/FakeScheduler';
import { QueuedRandomSource } from '../support/QueuedRandomSource';

const ROOM = 'BOTS';

/** A host (no phone screen: just its server calls) and bots, in one room. */
async function roomWithBots(botCount: number, care = 0.5, wrap = (server: MatchServer, _bot: () => SauceBot) => server) {
  const clock = new FakeClock();
  const gateway = new FakeRoomGateway();
  const heard: RoomEvent[] = [];
  const server = new FakeMatchServer(clock, (event) => {
    heard.push(event);
    gateway.broadcast(ROOM, event);
  });
  const scheduler = new FakeScheduler(clock);
  gateway.ids.push('host');
  await gateway.join(ROOM, { name: 'Ann' }, { onMembers: () => undefined, onStatus: () => undefined, onEvent: () => undefined });
  await server.as('host').setSauce(ROOM, ['red', 'yellow', 'green', 'blue']);
  const bots: SauceBot[] = [];
  for (let n = 1; n <= botCount; n += 1) {
    gateway.ids.push(`bot${n}`);
    const bot: SauceBot = new SauceBot({ gateway, server: wrap(server.as(`bot${n}`), () => bot) }, new QueuedRandomSource(), scheduler, care);
    await bot.join(ROOM, `Bot ${n}`);
    bots.push(bot);
  }
  await gateway.delivered();
  const start = async (seated = botCount) => {
    const players = [{ id: 'host', name: 'Ann' }, ...bots.slice(0, seated).map((_, index) => ({ id: `bot${index + 1}`, name: `Bot ${index + 1}` }))];
    const state = await server.as('host').start(ROOM, players);
    await gateway.delivered();
    return state;
  };
  /** Guesses the server announced: progress on a sauce, or a crack. */
  const guessesBy = (id: string) =>
    heard.filter(
      (event) => (event.type === 'pressure' && event.from === id) || (event.type === 'state' && event.cause.kind === 'stolen' && event.cause.by === id),
    ).length;
  return { server, scheduler, gateway, bots, start, heard, guessesBy, settle: () => gateway.delivered() };
}

describe('SauceBot', () => {
  it('shouldWait_untilAMatchStarts', async () => {
    const { scheduler } = await roomWithBots(1);

    expect(scheduler.pending).toBe(0);
  });

  it('shouldGuessEvery7To11Seconds_onceTheMatchStarts', async () => {
    const { scheduler, start, guessesBy, settle } = await roomWithBots(2);
    await start();

    await scheduler.advance(6_900, settle);
    expect(guessesBy('bot1')).toBe(0);
    await scheduler.advance(100, settle); // nothing queued, so the wait is the shortest: 7 s

    expect(guessesBy('bot1')).toBe(1);
    expect(guessesBy('bot2')).toBe(1);
  });

  it('shouldCrackTheHost_whenCarefulEnough', async () => {
    const { scheduler, start, server, settle } = await roomWithBots(1, 1);
    const { matchId } = await start();

    await scheduler.advance(120_000, settle);

    const ann = await server.as('host').sync(matchId);
    expect(ann.seats.find(({ id }) => id === 'bot1')?.points).toBeGreaterThan(0);
  });

  it('shouldStop_whenItLeaves', async () => {
    const { scheduler, start, bots, guessesBy, settle } = await roomWithBots(1);
    await start();

    bots[0].leave();
    await scheduler.advance(30_000, settle);

    expect(guessesBy('bot1')).toBe(0);
  });

  it('shouldStop_whenItLeavesWhileAGuessIsOnItsWay', async () => {
    const leavingMidGuess = (server: MatchServer, bot: () => SauceBot): MatchServer => ({
      ...server,
      guess: async (matchId, code) => {
        bot().leave();
        return server.guess(matchId, code);
      },
    });
    const { scheduler, start, settle } = await roomWithBots(1, 0.5, leavingMidGuess);
    await start();

    await scheduler.advance(7_000, settle);

    expect(scheduler.pending).toBe(0);
  });

  it('shouldNotPlay_aMatchStartedWithoutIt', async () => {
    const calls: string[] = [];
    const counting = (server: MatchServer): MatchServer => ({
      ...server,
      guess: (matchId, code) => {
        calls.push(matchId);
        return server.guess(matchId, code);
      },
    });
    const { scheduler, start, settle } = await roomWithBots(2, 0.5, counting);
    await start(1); // Ann and Bot 1 only

    await scheduler.advance(7_000, settle);

    expect(calls).toHaveLength(1); // Bot 1's, none from Bot 2
  });

  it('shouldStop_whenTheMatchIsOver', async () => {
    const { scheduler, start, settle } = await roomWithBots(1);
    await start();

    await scheduler.advance(320_000, settle);

    expect(scheduler.pending).toBe(0);
  });
});
