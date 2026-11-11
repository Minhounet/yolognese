import { RoomEvent } from '../../src/domain/steal';
import { WIRE_VERSION, decode, encode } from '../../src/infrastructure/roomWire';

const STATE = {
  matchId: '7f0c2a9e-0000-4000-8000-000000000001',
  rotation: 2,
  nextSwitchAt: 1_794_388_200_000,
  endsAt: 1_794_388_500_000,
  serverNow: 1_794_388_190_000,
  finished: false,
  seats: [
    { id: 'a', name: 'Ann', points: 1, version: 0 },
    { id: 'b', name: 'Bob', points: 0, version: 1 },
  ],
};

const EVENTS: readonly RoomEvent[] = [
  { type: 'state', state: STATE, cause: { kind: 'stolen', by: 'a', victim: 'b' } },
  { type: 'state', state: STATE, cause: { kind: 'switch' } },
  { type: 'state', state: STATE, cause: { kind: 'knockout', by: 'b' } },
  { type: 'pressure', from: 'a', target: 'b', bestExact: 3, attempt: undefined },
  { type: 'pressure', from: 'a', target: 'b', bestExact: 2, attempt: { guess: ['red', 'blue', 'red', 'green'], exact: 2, misplaced: 1 } },
  { type: 'ink', from: 'a', target: 'b' },
];

describe('roomWire', () => {
  it.each(EVENTS.map((event) => [event.type, event] as const))('shouldCarryEvent_%s', (_type, event) => {
    expect(decode(JSON.parse(JSON.stringify(encode(event))))).toEqual(event);
  });

  it('shouldUseItsOwnNames_notTheDomainOnes', () => {
    expect(encode({ type: 'pressure', from: 'a', target: 'b', bestExact: 3 })).toEqual({ v: WIRE_VERSION, t: 'steal.pressure', by: 'a', on: 'b', best: 3 });
  });

  it('shouldReadAProgressMessage_fromAServerBeforeRound14_withoutTheAttempt', () => {
    expect(decode({ v: WIRE_VERSION, t: 'steal.pressure', by: 'a', on: 'b', best: 2 })).toEqual({
      type: 'pressure', from: 'a', target: 'b', bestExact: 2, attempt: undefined,
    });
  });

  it('shouldDropMessage_fromAnotherVersion', () => {
    expect(decode({ ...encode({ type: 'pressure', from: 'a', target: 'b', bestExact: 1 }), v: WIRE_VERSION + 1 })).toBeUndefined();
  });

  it.each([
    ['an unknown kind', { v: WIRE_VERSION, t: 'steal.teleport', by: 'a' }],
    ['a state without seats', { v: WIRE_VERSION, t: 'srv.state', state: { ...STATE, seats: [] }, cause: { kind: 'switch' } }],
    ['a cause it does not know', { v: WIRE_VERSION, t: 'srv.state', state: STATE, cause: { kind: 'teleport' } }],
    ['an old peer message', { v: WIRE_VERSION, t: 'steal.stolen', by: 'a', victim: 'b' }],
    ['a best above four', { v: WIRE_VERSION, t: 'steal.pressure', by: 'a', on: 'b', best: 9 }],
    ['no sender', { v: WIRE_VERSION, t: 'steal.pressure', on: 'b', best: 1 }],
    ['ink with no target', { v: WIRE_VERSION, t: 'steal.ink', by: 'a' }],
    ['not an object', 'hello'],
  ])('shouldDropMessage_withMalformedContent: %s', (_why, message) => {
    expect(decode(message)).toBeUndefined();
  });
});
