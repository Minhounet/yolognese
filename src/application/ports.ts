import { Game } from '../domain/game';
import { Guardian } from '../domain/guardian';

export interface RandomSource {
  nextInt(maxExclusive: number): number;
}

export interface Clock {
  now(): number;
}

export interface Session {
  readonly game: Game;
  readonly guardian: Guardian;
  readonly hasPeeked: boolean;
}

export interface GameRepository {
  load(): Session | undefined;
  save(session: Session): void;
}
