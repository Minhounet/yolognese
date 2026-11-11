import { Code, Color } from '../domain/color';
import { Draft } from '../domain/draft';
import { Game } from '../domain/game';
import { Guardian } from '../domain/guardian';
import { Item } from '../domain/items';
import { MatchState, RoomEvent, Steal } from '../domain/steal';
import { RevealedPegView } from './views';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

export interface Session {
  readonly game: Game;
  readonly guardian: Guardian;
  readonly peekReadyAt: number;
  readonly endsAt: number;
  readonly attackAt?: number;
  readonly itemAt?: number;
  readonly item?: Item;
  readonly itemCollected?: boolean;
  readonly attackLandsAt?: number;
  readonly attackLane?: number;
  readonly attackIsPunch?: boolean;
  readonly shieldLane?: number;
  readonly charmed?: boolean;
  readonly darkUntil?: number;
  readonly pegUp?: RevealedPegView;
  /** AC33/AC34: the row being composed, kept here so a present or the fork can change it. */
  readonly draft?: Draft;
  readonly attackIsFork?: boolean;
  /** AC32: the peg the x-ray glasses show, until when (its colour comes from the server in "steal the sauce"). */
  readonly xray?: { readonly index: number; readonly until: number; readonly color?: Color };
  /** "Steal the sauce": the match, as the server last said it. */
  readonly steal?: Steal;
}

/** Where the session is kept. Asynchronous, whatever the adapter: memory, device storage or a remote table. */
export interface GameRepository {
  load(): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}

/** What a player tells the room about itself. */
export interface MemberInfo {
  readonly name: string;
  readonly joinedAt: number;
}

export interface Member extends MemberInfo {
  readonly id: string;
}

export type RoomStatus = 'connecting' | 'joined' | 'failed';

export interface RoomListener {
  onMembers(members: readonly Member[]): void;
  onEvent(event: RoomEvent): void;
  onStatus(status: RoomStatus): void;
}

/** A room where players meet: who is in it, and what the match server says to it. */
export interface Room {
  readonly me: Member;
  /** Everyone in the room, first arrived first. */
  members(): readonly Member[];
  leave(): void;
}

export interface RoomGateway {
  /** Joins as this player's identity (the same one the match server knows). */
  join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Promise<Room>;
}

export type GuessAnswer =
  | { readonly kind: 'scored'; readonly exact: number; readonly misplaced: number; readonly target: string; readonly state: MatchState }
  | { readonly kind: 'match-over'; readonly state: MatchState };

/**
 * "Steal the sauce" is refereed by a server: it holds every sauce and the
 * scores, scores the guesses and turns the circle. It also tells the room what
 * changed; these answers are for the player who asked.
 */
export interface MatchServer {
  setSauce(roomCode: string, sauce: Code): Promise<void>;
  /** Called by the host, first in `players`. */
  start(roomCode: string, players: readonly { readonly id: string; readonly name: string }[]): Promise<MatchState>;
  guess(matchId: string, code: Code): Promise<GuessAnswer>;
  /** One peg of the current target's sauce; undefined when asked too fast. */
  peek(matchId: string, index: number): Promise<Color | undefined>;
  /** Lets due switches happen; answers the state. */
  sync(matchId: string): Promise<MatchState>;
  knockout(matchId: string): Promise<MatchState>;
  mySauce(matchId: string): Promise<Code>;
  /** Round 14: throws ink at the caller's current target; false when asked too fast. */
  ink(matchId: string): Promise<boolean>;
}

/** Runs a task later. */
export interface Scheduler {
  /** Runs `task` after `ms`; answers a function that cancels it. */
  after(ms: number, task: () => void): () => void;
}

/** A separate identity on the network, for a test bot: its own room membership and server calls. */
export interface BotConnection {
  readonly gateway: RoomGateway;
  readonly server: MatchServer;
}
