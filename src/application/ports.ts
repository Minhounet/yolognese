import { Game } from '../domain/game';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

export interface Session {
  readonly game: Game;
}

export interface GameRepository {
  load(): Session | undefined;
  save(session: Session): void;
}
