import { Code } from './color';
import { Turn } from './game';
import type { AttackKind } from './round';

/**
 * "Steal the sauce": every player hides a secret and cracks another player's.
 * Players sit in a circle; each one attacks the player `step` seats further on.
 * The circle turns (a switch) every 45 s and after every crack; the host's phone
 * decides the switches, so every phone agrees. A crack scores a point and the
 * cracked player draws a new secret. Most points after 5 minutes wins.
 */
export const MATCH_MS = 300_000;
export const SWITCH_EVERY_MS = 45_000;
export const SWITCH_WARNING_MS = 3_000;

export interface Seat {
  readonly id: string;
  readonly name: string;
}

/** Anything said in a room, whatever the mode. */
export type RoomEvent = import('./race').RaceEvent | StealEvent;

export type StealEvent =
  | { readonly type: 'switch'; readonly from: string; readonly rotation: number }
  | { readonly type: 'stole'; readonly from: string; readonly target: string }
  | { readonly type: 'new-secret'; readonly from: string; readonly secret: Code }
  | { readonly type: 'knocked-out'; readonly from: string }
  | { readonly type: 'pressure'; readonly from: string; readonly target: string; readonly bestExact: number }
  | { readonly type: 'attack'; readonly from: string; readonly to: string; readonly kind: AttackKind; readonly lane: number };

export interface Steal {
  readonly me: string;
  readonly host: boolean;
  readonly seats: readonly Seat[];
  readonly secrets: Readonly<Record<string, Code>>;
  /** Guesses made against each player, kept for when the circle brings them back. */
  readonly memory: Readonly<Record<string, readonly Turn[]>>;
  readonly rotation: number;
  readonly points: Readonly<Record<string, number>>;
  /** The best count of right-place pegs each attacker has on this player's secret. */
  readonly pressure: Readonly<Record<string, number>>;
  /** When the next switch is due (the host decides; the others show it). */
  readonly nextSwitchAt: number;
  /** This player cracked its target and waits for the switch. */
  readonly waiting: boolean;
  readonly finished: boolean;
  readonly outbox: readonly StealEvent[];
  /** What the room was last told about this player's attack, to send only changes. */
  readonly told: { readonly target: string; readonly bestExact: number };
}

const seatIndex = (steal: Steal, id: string) => steal.seats.findIndex((seat) => seat.id === id);

/** How many seats further on the target sits, for this rotation: 1 to n-1, in turn. */
const stepOf = (steal: Steal) => 1 + (steal.rotation % Math.max(1, steal.seats.length - 1));

export function targetOf(steal: Steal): Seat {
  const count = steal.seats.length;
  return steal.seats[(seatIndex(steal, steal.me) + stepOf(steal)) % count];
}

export function attackerOf(steal: Steal): Seat {
  const count = steal.seats.length;
  return steal.seats[(seatIndex(steal, steal.me) - stepOf(steal) + count) % count];
}

export function newSteal(me: string, seats: readonly Seat[], secrets: Readonly<Record<string, Code>>, now: number): Steal {
  const steal: Steal = {
    me,
    host: seats[0]?.id === me,
    seats,
    secrets,
    memory: {},
    rotation: 0,
    points: Object.fromEntries(seats.map(({ id }) => [id, 0])),
    pressure: {},
    nextSwitchAt: now + SWITCH_EVERY_MS,
    waiting: false,
    finished: false,
    outbox: [],
    told: { target: '', bestExact: 0 },
  };
  return { ...steal, told: { target: targetOf(steal).id, bestExact: 0 } };
}

export const send = (steal: Steal, event: StealEvent): Steal => ({ ...steal, outbox: [...steal.outbox, event] });

export const score = (steal: Steal, id: string, change: number): Steal => ({
  ...steal,
  points: { ...steal.points, [id]: Math.max(0, (steal.points[id] ?? 0) + change) },
});

/** The sabotage item, in this mode: a meatball or a fork at whoever is attacking this player. */
export function sabotageAttacker(steal: Steal, draw: (max: number) => number, lanes: number): Steal {
  if (steal.seats.length < 2) return steal;
  const kind: AttackKind = draw(2) === 0 ? 'meatball' : 'fork';
  return send(steal, { type: 'attack', from: steal.me, to: attackerOf(steal).id, kind, lane: draw(lanes) });
}

/** Ranking at the end: most points first. */
export function ranking(steal: Steal): readonly (Seat & { readonly points: number })[] {
  return [...steal.seats].map((seat) => ({ ...seat, points: steal.points[seat.id] ?? 0 })).sort((one, other) => other.points - one.points);
}

export function isTop(steal: Steal): boolean {
  const mine = steal.points[steal.me] ?? 0;
  return Object.values(steal.points).every((points) => points <= mine);
}
