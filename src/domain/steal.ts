import { Code } from './color';
import { Turn } from './game';
import { AttackKind, Draw, LANES } from './attack';
import { RaceEvent } from './race';

/**
 * "Steal the sauce": every player hides a sauce and cracks another player's.
 * The server holds the sauces and the score, scores every guess, and turns the
 * circle (every 45 s and after each crack). The phone keeps a copy of the
 * server's state, asks it for what only it knows, and plays the rest (guardian,
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

export type StealEvent =
  | { readonly type: 'state'; readonly state: MatchState; readonly cause: StateCause }
  | { readonly type: 'pressure'; readonly from: string; readonly target: string; readonly bestExact: number }
  | { readonly type: 'attack'; readonly from: string; readonly to: string; readonly kind: AttackKind; readonly lane: number };

/** Anything said in a room, whatever the mode. */
export type RoomEvent = RaceEvent | StealEvent;

/** What the phone must ask the server. */
export type ServerRequest =
  | { readonly type: 'guess'; readonly code: Code }
  | { readonly type: 'peek'; readonly index: number; readonly via: 'peek' | 'xray' }
  | { readonly type: 'sync' }
  | { readonly type: 'knockout' }
  | { readonly type: 'my-sauce' };

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
  /** Messages for the room (sabotage). */
  readonly outbox: readonly StealEvent[];
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

/** The sabotage item, in this mode: a meatball or a fork at whoever is attacking this player. */
export function sabotageAttacker(steal: Steal, draw: Draw): Steal {
  if (steal.seats.length < 2) return steal;
  const kind: AttackKind = draw(2) === 0 ? 'meatball' : 'fork';
  const attack: StealEvent = { type: 'attack', from: steal.me, to: attackerOf(steal).id, kind, lane: draw(LANES) };
  return { ...steal, outbox: [...steal.outbox, attack] };
}

/** Highest points first. */
export function ranking(steal: Steal): readonly Seat[] {
  return [...steal.seats].sort((one, other) => other.points - one.points);
}

export function isTop(steal: Steal): boolean {
  const mine = steal.seats.find(({ id }) => id === steal.me)?.points ?? 0;
  return steal.seats.every(({ points }) => points <= mine);
}
