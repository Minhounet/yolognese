import { Draft } from '../domain/draft';
import { Game } from '../domain/game';
import { Guardian } from '../domain/guardian';
import { Item } from '../domain/items';
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
  /** AC32: the peg the x-ray glasses show, until when. */
  readonly xray?: { readonly index: number; readonly until: number };
}

/** Where the session is kept. Asynchronous, whatever the adapter: memory, device storage or a remote table. */
export interface GameRepository {
  load(): Promise<Session | undefined>;
  save(session: Session): Promise<void>;
}
