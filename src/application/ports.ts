import { Game } from '../domain/game';
import { Guardian } from '../domain/guardian';
import { Item } from '../domain/items';

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
  readonly shieldLane?: number;
}

export interface GameRepository {
  load(): Session | undefined;
  save(session: Session): void;
}
