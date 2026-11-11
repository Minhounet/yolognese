import { Round } from '../domain/round';
import { RoomEvent } from '../domain/steal';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

/** The current round: the game and everything around it (guardian, row, items, attacks). */
export type Session = Round;

export interface GameRepository {
  load(): Session | undefined;
  save(session: Session): void;
}

/** The room, seen from the game (race or steal the sauce): where this player's events go. */
export interface RaceLink {
  send(event: RoomEvent): void;
}
