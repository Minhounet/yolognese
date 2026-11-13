import { Code } from './color';
import { Turn } from './game';
import { DuelOutcome } from './duel';

/**
 * "Steal the sauce": every player hides a sauce and cracks another player's.
 * The server holds the sauces and the score, scores every guess, and turns the
 * circle (every 45 s and after each crack). The phone keeps a copy of the
 * server's state, asks it what only it knows, and plays the rest (guardian,
 * items, shield) itself.
 */
export interface Seat {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  /** Bumped each time this player's sauce is stolen and replaced. */
  readonly version: number;
}

/** The server's state of a match; times in the server's clock (epoch ms). */
export interface MatchState {
  readonly matchId: string;
  readonly rotation: number;
  readonly nextSwitchAt: number;
  readonly endsAt: number;
  readonly serverNow: number;
  readonly finished: boolean;
  /** In seat order. */
  readonly seats: readonly Seat[];
}

export type StateCause =
  | { readonly kind: 'start' }
  | { readonly kind: 'switch' }
  | { readonly kind: 'stolen'; readonly by: string; readonly victim: string }
  | { readonly kind: 'knockout'; readonly by: string };

/** A guess a rival made on a sauce, as the room heard it (round 14: see the others play). */
export interface Attempt {
  readonly guess: Code;
  readonly exact: number;
  readonly misplaced: number;
}

/** What the match server says to a room. */
export type RoomEvent =
  | { readonly type: 'state'; readonly state: MatchState; readonly cause: StateCause }
  | { readonly type: 'pressure'; readonly from: string; readonly target: string; readonly bestExact: number; readonly attempt?: Attempt }
  /** Round 14: `from` threw ink at `target`. */
  | { readonly type: 'ink'; readonly from: string; readonly target: string }
  /** Round 15: `from` taunted `target` with an insult (its number). */
  | { readonly type: 'taunt'; readonly id: string; readonly from: string; readonly target: string; readonly insult: number }
  /** Round 15: the server settled a duel. */
  | { readonly type: 'duel'; readonly outcome: DuelOutcome };

/** What the phone must ask the server. */
export type ServerRequest =
  | { readonly type: 'guess'; readonly code: Code }
  | { readonly type: 'peek'; readonly index: number; readonly via: 'peek' | 'xray' }
  | { readonly type: 'sync' }
  | { readonly type: 'knockout' }
  | { readonly type: 'my-sauce' }
  /** Round 14: throw ink at the player whose sauce this player is after. */
  | { readonly type: 'ink' }
  /** Round 15: the duel requests. */
  | { readonly type: 'taunt'; readonly insult: number }
  | { readonly type: 'retort'; readonly id: string; readonly comeback: number }
  | { readonly type: 'taunt-result'; readonly id: string };

export type StealNotice = 'switch' | 'robbed' | 'scored' | 'knocked-out' | 'inked' | 'ink-thrown';

export interface Steal {
  readonly me: string;
  readonly matchId: string;
  readonly seats: readonly Seat[];
  readonly rotation: number;
  /** In this phone's clock. */
  readonly nextSwitchAt: number;
  readonly finished: boolean;
  readonly mySauce?: Code;
  /** This player's guesses on each sauce (`id@version`), kept for when the circle brings it back. */
  readonly memory: Readonly<Record<string, readonly Turn[]>>;
  /** The best right-place count each attacker has on this player's sauce. */
  readonly pressure: Readonly<Record<string, number>>;
  /** A guess sent to the server, not scored yet. */
  readonly guessing?: Code;
  /** A sync was asked and not answered yet. */
  readonly syncing: boolean;
  readonly requests: readonly ServerRequest[];
  readonly notice?: { readonly kind: StealNotice; readonly at: number };
  /** Round 15 (AC1): when this player was last knocked out; shown 2.5 s whatever notice follows. */
  readonly knockedOutAt?: number;
  /** The latest guesses rivals made on this player's sauce, newest last. */
  readonly attempts: readonly (Attempt & { readonly by: string })[];
  /** Ink a rival threw on this player's screen: how much is left (1 → 0) as it is wiped. */
  readonly ink?: { readonly by: string; readonly left: number; readonly at: number };
}

const seatIndex = (steal: Steal, id: string) => steal.seats.findIndex((seat) => seat.id === id);
const stepOf = (steal: Steal) => 1 + (steal.rotation % Math.max(1, steal.seats.length - 1));

export function targetOf(steal: Steal): Seat {
  const count = steal.seats.length;
  return steal.seats[(seatIndex(steal, steal.me) + stepOf(steal)) % count];
}

export function attackerOf(steal: Steal): Seat {
  const count = steal.seats.length;
  return steal.seats[(seatIndex(steal, steal.me) - stepOf(steal) + count) % count];
}

export const sauceKey = (seat: Seat) => `${seat.id}@${seat.version}`;

export const ask = (steal: Steal, request: ServerRequest): Steal => ({ ...steal, requests: [...steal.requests, request] });

/** Highest points first. */
export function ranking(steal: Steal): readonly Seat[] {
  return [...steal.seats].sort((one, other) => other.points - one.points);
}

export function isTop(steal: Steal): boolean {
  const mine = steal.seats.find(({ id }) => id === steal.me)?.points ?? 0;
  return steal.seats.every(({ points }) => points <= mine);
}
