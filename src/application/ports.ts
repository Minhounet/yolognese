import { Code, Color } from '../domain/color';
import { Round } from '../domain/round';
import { MatchState, RoomEvent } from '../domain/steal';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

/** The current round: the game and everything around it (guardian, row, items, attacks, match). */
export type Session = Round;

/** Where the session is kept. Asynchronous, whatever the adapter: memory, device storage or a remote table. */
export interface GameRepository {
  load(): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}

export type MatchMode = 'race' | 'steal';

/** What a player tells the room about itself. */
export interface MemberInfo {
  readonly name: string;
  readonly joinedAt: number;
  /** The mode the host picked (only the host's counts). */
  readonly mode?: MatchMode;
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

/** A room where players meet and talk. How messages travel is the adapter's business. */
export interface Room {
  readonly me: Member;
  /** Everyone in the room, first arrived first. */
  members(): readonly Member[];
  update(change: Partial<Omit<MemberInfo, 'joinedAt'>>): void;
  send(event: RoomEvent): void;
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
}

/** The part of a room a match needs: somewhere to send its events. */
export type RaceLink = Pick<Room, 'send'>;

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
