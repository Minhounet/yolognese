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
  { type: 'start', secret: ['red', 'red', 'red', 'red'], players: [{ id: 'a', name: 'Ann' }, { id: 'b', name: 'Bob' }] },
  { type: 'progress', from: 'a', life: 9, bestExact: 2 },
  { type: 'cracked', from: 'a' },
  { type: 'out', from: 'a' },
  { type: 'attack', from: 'a', to: 'b', kind: 'fork', lane: 2 },
  { type: 'state', state: STATE, cause: { kind: 'stolen', by: 'a', victim: 'b' } },
  { type: 'state', state: STATE, cause: { kind: 'switch' } },
  { type: 'pressure', from: 'a', target: 'b', bestExact: 3 },
];

describe('roomWire', () => {
  it.each(EVENTS.map((event) => [event.type, event] as const))('shouldCarryEvent_%s', (_type, event) => {
    expect(decode(JSON.parse(JSON.stringify(encode(event))))).toEqual(event);
  });

  it('shouldUseItsOwnNames_notTheDomainOnes', () => {
    expect(encode({ type: 'pressure', from: 'a', target: 'b', bestExact: 3 })).toEqual({ v: WIRE_VERSION, t: 'steal.pressure', by: 'a', on: 'b', best: 3 });
  });

  it('shouldDropMessage_fromAnotherVersion', () => {
    expect(decode({ ...encode({ type: 'cracked', from: 'a' }), v: WIRE_VERSION + 1 })).toBeUndefined();
  });

  it.each([
    ['an unknown kind', { v: WIRE_VERSION, t: 'steal.teleport', by: 'a' }],
    ['a colour that does not exist', { v: WIRE_VERSION, t: 'match.start', mode: 'race', sauce: ['red', 'red', 'red', 'pink'], seats: [{ id: 'a', name: 'Ann' }] }],
    ['a state without seats', { v: WIRE_VERSION, t: 'srv.state', state: { ...STATE, seats: [] }, cause: { kind: 'switch' } }],
    ['a cause it does not know', { v: WIRE_VERSION, t: 'srv.state', state: STATE, cause: { kind: 'teleport' } }],
    ['an old peer message', { v: WIRE_VERSION, t: 'steal.stolen', by: 'a', victim: 'b' }],
    ['a lane off the board', { v: WIRE_VERSION, t: 'attack.thrown', by: 'a', at: 'b', weapon: 'fork', lane: 7 }],
    ['life above the maximum', { v: WIRE_VERSION, t: 'race.progress', by: 'a', life: 99, best: 1 }],
    ['no sender', { v: WIRE_VERSION, t: 'race.cracked' }],
    ['not an object', 'hello'],
  ])('shouldDropMessage_withMalformedContent: %s', (_why, message) => {
    expect(decode(message)).toBeUndefined();
  });
});
