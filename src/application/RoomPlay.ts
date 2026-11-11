import { Code } from '../domain/color';
import { MatchState, RoomEvent } from '../domain/steal';
import { FlushMatch, ReceiveMatch, StartSteal } from './Match';
import { BotConnection, Clock, MatchServer, RandomSource, Room, RoomGateway, RoomStatus, Scheduler } from './ports';
import { SauceBot } from './SauceBot';
import { SessionWork } from './SessionWork';
import { drawSecret } from './StartGame';
import { GameView } from './views';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

export interface LobbyMemberView {
  readonly name: string;
  readonly host: boolean;
  readonly me: boolean;
}

export interface LobbyView {
  readonly code: string;
  readonly status: RoomStatus;
  readonly members: readonly LobbyMemberView[];
  readonly hostName?: string;
  readonly isHost: boolean;
  readonly canStart: boolean;
  /** The host can fill the room with test bots. */
  readonly canAddBot: boolean;
  readonly mySauce: Code;
}

export interface RoomPlayListener {
  onLobby(view: LobbyView): void;
  /** A match this player is in has started: its first view. */
  onMatch(view: GameView): void;
  /** The match in progress changed because of the room. */
  onGame(view: GameView): void;
}

export interface Dependencies {
  readonly gateway: RoomGateway;
  readonly server: MatchServer;
  readonly work: SessionWork;
  readonly clock: Clock;
  readonly random: RandomSource;
  readonly scheduler: Scheduler;
  /** A new network identity for a test bot. */
  readonly botConnection: () => BotConnection;
}

/**
 * One player's life in a room: the lobby (who is in, its sauce, test bots), the
 * host's start, and what the match server says routed to the match in progress.
 * The screen only shows the views and forwards taps.
 */
export class RoomPlay {
  private room!: Room;
  /** A gateway may report while join() is still running: the room is not there yet. */
  private joined = false;
  private status: RoomStatus = 'connecting';
  private sauce: Code;
  private matchId?: string;
  private readonly bots: SauceBot[] = [];
  private readonly startSteal: StartSteal;
  private readonly receive: ReceiveMatch;
  private readonly flusher: FlushMatch;

  private constructor(
    private readonly code: string,
    private readonly listener: RoomPlayListener,
    private readonly deps: Dependencies,
  ) {
    this.sauce = drawSecret(deps.random);
    this.startSteal = new StartSteal(deps.work, deps.clock);
    this.receive = new ReceiveMatch(deps.work, deps.clock);
    this.flusher = new FlushMatch(deps.work, deps.clock, deps.server);
  }

  static async open(code: string, name: string, listener: RoomPlayListener, deps: Dependencies): Promise<RoomPlay> {
    const play = new RoomPlay(code, listener, deps);
    play.room = await deps.gateway.join(code, { name }, {
      onMembers: () => play.showLobby(),
      onStatus: (status) => {
        play.status = status;
        play.showLobby();
      },
      onEvent: (event) => void play.hear(event),
    });
    play.joined = true;
    void play.tellSauce();
    return play;
  }

  view(): LobbyView {
    const members = this.room.members();
    const host = members[0];
    const isHost = host?.id === this.room.me.id;
    return {
      code: this.code,
      status: this.status,
      members: members.map((member, index) => ({ name: member.name, host: index === 0, me: member.id === this.room.me.id })),
      hostName: host?.name,
      isHost,
      canStart: isHost && members.length >= MIN_PLAYERS,
      canAddBot: isHost && members.length < MAX_PLAYERS,
      mySauce: this.sauce,
    };
  }

  /** The sauce goes to the server only: nobody else in the room sees it. */
  changeSauce(sauce: Code): void {
    this.sauce = sauce;
    void this.tellSauce();
    this.showLobby();
  }

  /** The host starts a match for everyone in the room (up to six), refereed by the server. */
  async start(): Promise<void> {
    if (!this.view().canStart) return;
    const players = this.room.members().slice(0, MAX_PLAYERS).map(({ id, name }) => ({ id, name }));
    await this.tellSauce();
    await this.begin(await this.deps.server.start(this.code, players));
  }

  /** The host adds a test bot to the room; it plays the next matches like any player. */
  async addBot(): Promise<void> {
    if (!this.view().canAddBot) return;
    const bot = new SauceBot(this.deps.botConnection(), this.deps.random, this.deps.scheduler);
    this.bots.push(bot);
    await bot.join(this.code, `🤖 Bot ${this.bots.length}`);
  }

  /** Asks the server what only it knows; the game screen calls it after every action and tick. */
  flush(): Promise<void> {
    return this.flusher.execute();
  }

  leave(): void {
    this.bots.forEach((bot) => bot.leave());
    this.room.leave();
  }

  private tellSauce(): Promise<void> {
    return this.deps.server.setSauce(this.code, this.sauce).catch(() => undefined);
  }

  private showLobby(): void {
    if (this.joined) this.listener.onLobby(this.view());
  }

  private async begin(state: MatchState): Promise<void> {
    if (state.matchId === this.matchId) return;
    if (!state.seats.some(({ id }) => id === this.room.me.id)) return; // started without us
    this.matchId = state.matchId;
    this.listener.onMatch(await this.startSteal.execute(this.room.me.id, state));
    await this.flush();
  }

  private async hear(event: RoomEvent): Promise<void> {
    if (!this.joined) return;
    if (event.type === 'state' && event.cause.kind === 'start') return this.begin(event.state);
    const view = await this.receive.execute(event);
    await this.flush();
    if (view !== undefined) this.listener.onGame(view);
  }
}

/** Joins a room by its code. */
export class JoinRoom {
  constructor(private readonly deps: Dependencies) {}

  /** A code to offer: four letters, no look-alikes. */
  suggestCode(): string {
    return Array.from({ length: 4 }, () => CODE_LETTERS[this.deps.random.nextInt(CODE_LETTERS.length)]).join('');
  }

  execute({ code, name }: { readonly code: string; readonly name: string }, listener: RoomPlayListener): Promise<RoomPlay> {
    return RoomPlay.open(code.trim().toUpperCase(), name.trim() || 'Player', listener, this.deps);
  }
}
