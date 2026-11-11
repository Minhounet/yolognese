import { COLORS, Code } from '../domain/color';
import { AttackKind } from '../domain/attack';
import { RoomEvent } from '../domain/steal';

/**
 * The messages phones exchange, in a format of their own: the domain's events
 * can change shape without breaking phones still running an older version, and
 * whatever arrives is checked before the game sees it. Bump WIRE_VERSION on a
 * change the old decoder cannot read; messages from another version are dropped.
 */
export const WIRE_VERSION = 1;

type Fields = Record<string, unknown>;
export type WireMessage = { readonly v: number; readonly t: string } & Fields;

export function encode(event: RoomEvent): WireMessage {
  const wire = (t: string, fields: Fields): WireMessage => ({ v: WIRE_VERSION, t, ...fields });
  switch (event.type) {
    case 'start':
      return wire('match.start', {
        mode: event.mode ?? 'race',
        sauce: event.secret,
        seats: event.players.map(({ id, name, secret }) => ({ id, name, sauce: secret })),
      });
    case 'progress':
      return wire('race.progress', { by: event.from, life: event.life, best: event.bestExact });
    case 'cracked':
      return wire('race.cracked', { by: event.from });
    case 'out':
      return wire('race.out', { by: event.from });
    case 'attack':
      return wire('attack.thrown', { by: event.from, at: event.to, weapon: event.kind, lane: event.lane });
    case 'switch':
      return wire('steal.switch', { by: event.from, rotation: event.rotation });
    case 'stole':
      return wire('steal.stolen', { by: event.from, victim: event.target });
    case 'new-secret':
      return wire('steal.sauce', { by: event.from, sauce: event.secret });
    case 'knocked-out':
      return wire('steal.knockout', { by: event.from });
    case 'pressure':
      return wire('steal.pressure', { by: event.from, on: event.target, best: event.bestExact });
  }
}

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;
const isCount = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
const isCode = (value: unknown): value is Code =>
  Array.isArray(value) && value.length === 4 && value.every((color) => (COLORS as readonly unknown[]).includes(color));
const isWeapon = (value: unknown): value is AttackKind => value === 'meatball' || value === 'fork';

function decodeSeats(value: unknown) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 6) return undefined;
  const seats = value.map((seat) =>
    isRecord(seat) && isText(seat.id) && isText(seat.name) && (seat.sauce === undefined || isCode(seat.sauce))
      ? { id: seat.id, name: seat.name, secret: seat.sauce as Code | undefined }
      : undefined,
  );
  return seats.every((seat) => seat !== undefined) ? seats : undefined;
}

/** The event a message carries, or undefined when it is from another version, unknown or malformed. */
export function decode(message: unknown): RoomEvent | undefined {
  if (!isRecord(message) || message.v !== WIRE_VERSION || typeof message.t !== 'string') return undefined;
  const m = message;
  switch (m.t) {
    case 'match.start': {
      const players = decodeSeats(m.seats);
      if (players === undefined || (m.mode !== 'race' && m.mode !== 'steal')) return undefined;
      if (m.sauce !== undefined && !isCode(m.sauce)) return undefined;
      return { type: 'start', mode: m.mode, secret: m.sauce as Code | undefined, players };
    }
    case 'race.progress':
      return isText(m.by) && isCount(m.life, 10) && isCount(m.best, 4)
        ? { type: 'progress', from: m.by, life: m.life, bestExact: m.best }
        : undefined;
    case 'race.cracked':
      return isText(m.by) ? { type: 'cracked', from: m.by } : undefined;
    case 'race.out':
      return isText(m.by) ? { type: 'out', from: m.by } : undefined;
    case 'attack.thrown':
      return isText(m.by) && isText(m.at) && isWeapon(m.weapon) && isCount(m.lane, 2)
        ? { type: 'attack', from: m.by, to: m.at, kind: m.weapon, lane: m.lane }
        : undefined;
    case 'steal.switch':
      return isText(m.by) && isCount(m.rotation, 1_000_000) ? { type: 'switch', from: m.by, rotation: m.rotation } : undefined;
    case 'steal.stolen':
      return isText(m.by) && isText(m.victim) ? { type: 'stole', from: m.by, target: m.victim } : undefined;
    case 'steal.sauce':
      return isText(m.by) && isCode(m.sauce) ? { type: 'new-secret', from: m.by, secret: m.sauce } : undefined;
    case 'steal.knockout':
      return isText(m.by) ? { type: 'knocked-out', from: m.by } : undefined;
    case 'steal.pressure':
      return isText(m.by) && isText(m.on) && isCount(m.best, 4)
        ? { type: 'pressure', from: m.by, target: m.on, bestExact: m.best }
        : undefined;
    default:
      return undefined;
  }
}
