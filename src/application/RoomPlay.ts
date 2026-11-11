import { Code } from '../domain/color';
import { RoomEvent } from '../domain/steal';
import { Clock, MatchMode, Member, RandomSource, Room, RoomGateway, RoomStatus } from './ports';
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
  readonly work: SessionWork;
  readonly clock: Clock;
  readonly random: RandomSource;
}

/**
 * One player's life in a room: the lobby (who is in, the mode, its sauce), the
 * host's start, and the room's events routed to the match in progress.
 * The screen only shows the views and forwards taps.
 */
export class RoomPlay {
  private readonly room: Room;
  /** A gateway may report while join() is still running: the room is not there yet. */
  private joined = false;
  private status: RoomStatus = 'connecting';
  private sauce: Code;
  private readonly startRace: StartRaceImpl;
  private readonly startSteal: StartStealImpl;
  private readonly receive: ReceiveRaceImpl;
  private readonly flusher: FlushRaceImpl;

  constructor(
    private readonly code: string,
    name: string,
    private readonly listener: RoomPlayListener,
    private readonly deps: Dependencies,
  ) {
    const { gateway, work, clock, random } = deps;
    this.sauce = drawSecret(random);
    this.startRace = new StartRaceImpl(random, work, clock);
    this.startSteal = new StartStealImpl(random, work, clock);
    this.receive = new ReceiveRaceImpl(work, clock, random);
    this.room = gateway.join(code, { name, secret: this.sauce, mode: DEFAULT_MODE }, {
      onMembers: () => this.showLobby(),
      onStatus: (status) => {
        this.status = status;
        this.showLobby();
      },
      onEvent: (event) => void this.hear(event),
    });
    this.flusher = new FlushRaceImpl(work, this.room);
    this.joined = true;
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
      mode: this.mode(members),
      isHost,
      canStart: isHost && members.length >= MIN_PLAYERS,
      mySauce: this.sauce,
    };
  }

  changeSauce(sauce: Code): void {
    this.sauce = sauce;
    this.room.update({ secret: sauce });
    this.showLobby();
  }

  /** Anyone may say a mode; only the host's is read (see mode()). */
  pickMode(mode: MatchMode): void {
    this.room.update({ mode });
    this.showLobby();
  }

  /** The host starts a match for everyone in the room (up to six). */
  async start(): Promise<void> {
    const lobby = this.view();
    if (!lobby.canStart) return;
    const seated = this.room.members().slice(0, MAX_PLAYERS);
    if (lobby.mode === 'steal') {
      const players = seated.map((member) => ({ id: member.id, name: member.name, secret: this.sauceOf(member) }));
      this.room.send({ type: 'start', mode: 'steal', players });
      this.listener.onMatch(await this.startSteal.execute({ me: this.room.me.id, players }));
      return;
    }
    const players = seated.map(({ id, name }) => ({ id, name }));
    const started = await this.startRace.execute({ me: this.room.me.id, players });
    this.room.send({ type: 'start', mode: 'race', secret: started.secret, players });
    this.listener.onMatch(started.view);
  }

  /** Sends what this player's actions produced; the game screen calls it after every action and tick. */
  flush(): Promise<void> {
    return this.flusher.execute();
  }

  leave(): void {
    this.room.leave();
  }

  private mode(members: readonly Member[]): MatchMode {
    return members[0]?.mode ?? DEFAULT_MODE;
  }

  private sauceOf(member: Member): Code {
    if (member.id === this.room.me.id) return this.sauce;
    return member.secret ?? drawSecret(this.deps.random);
  }

  private showLobby(): void {
    if (this.joined) this.listener.onLobby(this.view());
  }

  private async hear(event: RoomEvent): Promise<void> {
    if (!this.joined) return;
    if (event.type === 'start') return this.begin(event);
    const view = await this.receive.execute(event);
    await this.flush();
    if (view !== undefined) this.listener.onGame(view);
  }

  private async begin(event: Extract<RoomEvent, { type: 'start' }>): Promise<void> {
    const me = this.room.me.id;
    const seat = event.players.find(({ id }) => id === me);
    if (seat === undefined) return; // started without us
    if (event.mode === 'steal') {
      // This phone owns its sauce: the host may have started with an older one (presence lags).
      const players = event.players.map((player) => ({
        ...player,
        secret: player.id === me ? this.sauce : (player.secret ?? drawSecret(this.deps.random)),
      }));
      this.listener.onMatch(await this.startSteal.execute({ me, players }));
      if (seat.secret?.join() !== this.sauce.join()) this.room.send({ type: 'new-secret', from: me, secret: this.sauce });
      return;
    }
    if (event.secret !== undefined) {
      this.listener.onMatch((await this.startRace.execute({ me, players: event.players, secret: event.secret })).view);
    }
  }
}

/** Joins a room by its code. */
export interface JoinRoom {
  /** A code to offer: four letters, no look-alikes. */
  suggestCode(): string;
  execute(command: { readonly code: string; readonly name: string }, listener: RoomPlayListener): RoomPlay;
}

export class JoinRoomImpl implements JoinRoom {
  constructor(private readonly deps: Dependencies) {}

  suggestCode(): string {
    return Array.from({ length: 4 }, () => CODE_LETTERS[this.deps.random.nextInt(CODE_LETTERS.length)]).join('');
  }

  execute({ code, name }: { readonly code: string; readonly name: string }, listener: RoomPlayListener): RoomPlay {
    return new RoomPlay(code.trim().toUpperCase(), name.trim() || 'Player', listener, this.deps);
  }
}
