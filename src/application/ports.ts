import { Code } from '../domain/color';
import { Round } from '../domain/round';
import { RoomEvent } from '../domain/steal';

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
  /** "Steal the sauce": the secret this player hides. */
  readonly secret?: Code;
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
  join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Room;
}

/** The part of a room a match needs: somewhere to send its events. */
export type RaceLink = Pick<Room, 'send'>;
