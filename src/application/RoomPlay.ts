import { Code } from '../domain/color';
import { MatchState, RoomEvent } from '../domain/steal';
import { Clock, MatchMode, MatchServer, RandomSource, Room, RoomGateway, RoomStatus } from './ports';
import { FlushRaceImpl, ReceiveRaceImpl, StartRaceImpl, StartStealImpl } from './Race';
import { SessionWork } from './SessionWork';
import { drawSecret } from './StartGame';
import { GameView } from './views';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const DEFAULT_MODE: MatchMode = 'steal';

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
  readonly mode: MatchMode;
  readonly isHost: boolean;
  readonly canStart: boolean;
  readonly mySauce: Code;
}

export interface RoomPlayListener {
  onLobby(view: LobbyView): void;
  /** A match this player is in has started: its first view. */
  onMatch(view: GameView): void;
  /** The match in progress changed because of the room. */
  onGame(view: GameView): void;
}

interface Dependencies {
  readonly gateway: RoomGateway;
  readonly server: MatchServer;
  readonly work: SessionWork;
  readonly clock: Clock;
  readonly random: RandomSource;
}

/**
 * One player's life in a room: the lobby (who is in, the mode, its sauce), the
 * host's start, and the room's messages routed to the match in progress.
 * "Steal the sauce" is refereed by the match server; a race is played between
 * the phones. The screen only shows the views and forwards taps.
 */
export class RoomPlay {
  private room!: Room;
  /** A gateway may report while join() is still running: the room is not there yet. */
  private joined = false;
  private status: RoomStatus = 'connecting';
  private sauce: Code;
  private matchId?: string;
  private readonly startRace: StartRaceImpl;
  private readonly startSteal: StartStealImpl;
  private readonly receive: ReceiveRaceImpl;
  private flusher!: FlushRaceImpl;

  private constructor(
    private readonly code: string,
    private readonly listener: RoomPlayListener,
    private readonly deps: Dependencies,
  ) {
    const { work, clock, random } = deps;
    this.sauce = drawSecret(random);
    this.startRace = new StartRaceImpl(random, work, clock);
    this.startSteal = new StartStealImpl(random, work, clock);
    this.receive = new ReceiveRaceImpl(work, clock, random);
  }

  static async open(code: string, name: string, listener: RoomPlayListener, deps: Dependencies): Promise<RoomPlay> {
    const play = new RoomPlay(code, listener, deps);
    play.room = await deps.gateway.join(code, { name, mode: DEFAULT_MODE }, {
      onMembers: () => play.showLobby(),
      onStatus: (status) => {
        play.status = status;
        play.showLobby();
      },
      onEvent: (event) => void play.hear(event),
    });
    play.flusher = new FlushRaceImpl(deps.work, play.room, deps.clock, deps.server);
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
      mode: members[0]?.mode ?? DEFAULT_MODE,
      isHost,
      canStart: isHost && members.length >= MIN_PLAYERS,
      mySauce: this.sauce,
    };
  }

  /** The sauce goes to the server only: nobody else in the room sees it. */
  changeSauce(sauce: Code): void {
    this.sauce = sauce;
    void this.tellSauce();
    this.showLobby();
  }

  /** Anyone may say a mode; only the host's is read. */
  pickMode(mode: MatchMode): void {
    this.room.update({ mode });
    this.showLobby();
  }

  /** The host starts a match for everyone in the room (up to six). */
  async start(): Promise<void> {
    const lobby = this.view();
    if (!lobby.canStart) return;
    const players = this.room.members().slice(0, MAX_PLAYERS).map(({ id, name }) => ({ id, name }));
    if (lobby.mode === 'steal') {
      await this.tellSauce();
      const state = await this.deps.server.start(this.code, players);
      await this.beginSteal(state);
      return;
    }
    const started = await this.startRace.execute({ me: this.room.me.id, players });
    this.matchId = undefined;
    this.room.send({ type: 'start', secret: started.secret, players });
    this.listener.onMatch(started.view);
  }

  /** Sends what this player's actions produced; the game screen calls it after every action and tick. */
  flush(): Promise<void> {
    return this.flusher.execute();
  }

  leave(): void {
    this.room.leave();
  }

  private tellSauce(): Promise<void> {
    return this.deps.server.setSauce(this.code, this.sauce).catch(() => undefined);
  }

  private showLobby(): void {
    if (this.joined) this.listener.onLobby(this.view());
  }

  private async beginSteal(state: MatchState): Promise<void> {
    if (state.matchId === this.matchId) return;
    if (!state.seats.some(({ id }) => id === this.room.me.id)) return; // started without us
    this.matchId = state.matchId;
    this.listener.onMatch(await this.startSteal.execute({ me: this.room.me.id, state }));
    await this.flush();
  }

  private async hear(event: RoomEvent): Promise<void> {
    if (!this.joined) return;
    if (event.type === 'state' && event.cause.kind === 'start') return this.beginSteal(event.state);
    if (event.type === 'start') {
      if (!event.players.some(({ id }) => id === this.room.me.id)) return;
      this.matchId = undefined;
      this.listener.onMatch((await this.startRace.execute({ me: this.room.me.id, players: event.players, secret: event.secret })).view);
      return;
    }
    const view = await this.receive.execute(event);
    await this.flush();
    if (view !== undefined) this.listener.onGame(view);
  }
}

/** Joins a room by its code. */
export interface JoinRoom {
  /** A code to offer: four letters, no look-alikes. */
  suggestCode(): string;
  execute(command: { readonly code: string; readonly name: string }, listener: RoomPlayListener): Promise<RoomPlay>;
}

export class JoinRoomImpl implements JoinRoom {
  constructor(private readonly deps: Dependencies) {}

  suggestCode(): string {
    return Array.from({ length: 4 }, () => CODE_LETTERS[this.deps.random.nextInt(CODE_LETTERS.length)]).join('');
  }

  execute({ code, name }: { readonly code: string; readonly name: string }, listener: RoomPlayListener): Promise<RoomPlay> {
    return RoomPlay.open(code.trim().toUpperCase(), name.trim() || 'Player', listener, this.deps);
  }
}
