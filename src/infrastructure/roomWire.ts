import { Code } from '../domain/color';
import { Attempt, MatchState, RoomEvent, StateCause } from '../domain/steal';

/**
 * The messages the match server broadcasts to a room (supabase/migrations), in
 * a format of their own, checked before the game sees them. Bump WIRE_VERSION
 * on a change the old decoder cannot read; messages from another version are dropped.
 */
export const WIRE_VERSION = 1;

type Fields = Record<string, unknown>;
export type WireMessage = { readonly v: number; readonly t: string } & Fields;

/** The message for an event, as the server writes it (used by the tests). */
export function encode(event: RoomEvent): WireMessage {
  if (event.type === 'state') return { v: WIRE_VERSION, t: 'srv.state', state: event.state, cause: event.cause };
  if (event.type === 'ink') return { v: WIRE_VERSION, t: 'steal.ink', by: event.from, on: event.target };
  const attempt = event.attempt === undefined ? {} : { guess: event.attempt.guess, exact: event.attempt.exact, misplaced: event.attempt.misplaced };
  return { v: WIRE_VERSION, t: 'steal.pressure', by: event.from, on: event.target, best: event.bestExact, ...attempt };
}

const COLOR_NAMES: readonly unknown[] = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'];
const isCode = (value: unknown): value is Code => Array.isArray(value) && value.length === 4 && value.every((color) => COLOR_NAMES.includes(color));

const isRecord = (value: unknown): value is Fields => typeof value === 'object' && value !== null;
const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 64;
const isCount = (value: unknown, max: number): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= max;
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
  if (!isRecord(message) || message.v !== WIRE_VERSION) return undefined;
  if (message.t === 'srv.state') {
    const state = decodeState(message.state);
    const cause = decodeCause(message.cause);
    return state !== undefined && cause !== undefined ? { type: 'state', state, cause } : undefined;
  }
  if (message.t === 'steal.pressure') {
    const { by, on, best, guess, exact, misplaced } = message;
    if (!isText(by) || !isText(on) || !isCount(best, 4)) return undefined;
    // the attempt (round 14) is optional: a server from before it sends only the best count
    const attempt: Attempt | undefined = isCode(guess) && isCount(exact, 4) && isCount(misplaced, 4) ? { guess, exact, misplaced } : undefined;
    return { type: 'pressure', from: by, target: on, bestExact: best, attempt };
  }
  if (message.t === 'steal.ink') {
    const { by, on } = message;
    return isText(by) && isText(on) ? { type: 'ink', from: by, target: on } : undefined;
  }
  return undefined;
}
