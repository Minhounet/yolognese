import { COLORS, Code } from '../domain/color';
import { AttackKind } from '../domain/attack';
import { MatchState, RoomEvent, StateCause } from '../domain/steal';

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
      return wire('match.start', { mode: 'race', sauce: event.secret, seats: event.players.map(({ id, name }) => ({ id, name })) });
    case 'progress':
      return wire('race.progress', { by: event.from, life: event.life, best: event.bestExact });
    case 'cracked':
      return wire('race.cracked', { by: event.from });
    case 'out':
      return wire('race.out', { by: event.from });
    case 'attack':
      return wire('attack.thrown', { by: event.from, at: event.to, weapon: event.kind, lane: event.lane });
    // Sent by the match server (supabase/migrations); encoded here for tests and symmetry.
    case 'state':
      return wire('srv.state', { state: event.state, cause: event.cause });
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
  const seats = value.map((seat) => (isRecord(seat) && isText(seat.id) && isText(seat.name) ? { id: seat.id, name: seat.name } : undefined));
  return seats.every((seat) => seat !== undefined) ? seats : undefined;
}

const isTime = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;

/** The match server's state of a match, checked field by field. */
export function decodeState(value: unknown): MatchState | undefined {
  if (!isRecord(value) || !isText(value.matchId) || !isCount(value.rotation, 1_000_000)) return undefined;
  if (!isTime(value.nextSwitchAt) || !isTime(value.endsAt) || !isTime(value.serverNow) || typeof value.finished !== 'boolean') return undefined;
  if (!Array.isArray(value.seats) || value.seats.length < 2 || value.seats.length > 6) return undefined;
  const seats = value.seats.map((seat) =>
    isRecord(seat) && isText(seat.id) && isText(seat.name) && isCount(seat.points, 10_000) && isCount(seat.version, 10_000)
      ? { id: seat.id, name: seat.name, points: seat.points, version: seat.version }
      : undefined,
  );
  if (!seats.every((seat) => seat !== undefined)) return undefined;
  const { matchId, rotation, nextSwitchAt, endsAt, serverNow, finished } = value;
  return { matchId, rotation, nextSwitchAt, endsAt, serverNow, finished, seats };
}

function decodeCause(value: unknown): StateCause | undefined {
  if (!isRecord(value)) return undefined;
  if (value.kind === 'start' || value.kind === 'switch') return { kind: value.kind };
  if (value.kind === 'stolen' && isText(value.by) && isText(value.victim)) return { kind: 'stolen', by: value.by, victim: value.victim };
  if (value.kind === 'knockout' && isText(value.by)) return { kind: 'knockout', by: value.by };
  return undefined;
}

/** The event a message carries, or undefined when it is from another version, unknown or malformed. */
export function decode(message: unknown): RoomEvent | undefined {
  if (!isRecord(message) || message.v !== WIRE_VERSION || typeof message.t !== 'string') return undefined;
  const m = message;
  switch (m.t) {
    case 'match.start': {
      const players = decodeSeats(m.seats);
      return players !== undefined && m.mode === 'race' && isCode(m.sauce) ? { type: 'start', secret: m.sauce, players } : undefined;
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
    case 'srv.state': {
      const state = decodeState(m.state);
      const cause = decodeCause(m.cause);
      return state !== undefined && cause !== undefined ? { type: 'state', state, cause } : undefined;
    }
    case 'steal.pressure':
      return isText(m.by) && isText(m.on) && isCount(m.best, 4)
        ? { type: 'pressure', from: m.by, target: m.on, bestExact: m.best }
        : undefined;
    default:
      return undefined;
  }
}
