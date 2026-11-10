import { Round } from '../domain/round';

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
