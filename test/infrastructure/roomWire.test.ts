import { RoomEvent } from '../../src/domain/steal';
import { WIRE_VERSION, decode, encode } from '../../src/infrastructure/roomWire';

const EVENTS: readonly RoomEvent[] = [
  { type: 'start', mode: 'steal', secret: undefined, players: [{ id: 'a', name: 'Ann', secret: ['red', 'blue', 'red', 'green'] }, { id: 'b', name: 'Bob', secret: undefined }] },
  { type: 'start', mode: 'race', secret: ['red', 'red', 'red', 'red'], players: [{ id: 'a', name: 'Ann', secret: undefined }] },
  { type: 'progress', from: 'a', life: 9, bestExact: 2 },
  { type: 'cracked', from: 'a' },
  { type: 'out', from: 'a' },
  { type: 'attack', from: 'a', to: 'b', kind: 'fork', lane: 2 },
  { type: 'switch', from: 'a', rotation: 3 },
  { type: 'stole', from: 'a', target: 'b' },
  { type: 'new-secret', from: 'b', secret: ['orange', 'orange', 'purple', 'yellow'] },
  { type: 'knocked-out', from: 'c' },
  { type: 'pressure', from: 'a', target: 'b', bestExact: 3 },
];

describe('roomWire', () => {
  it.each(EVENTS.map((event) => [event.type, event] as const))('shouldCarryEvent_%s', (_type, event) => {
    expect(decode(JSON.parse(JSON.stringify(encode(event))))).toEqual(event);
  });

  it('shouldUseItsOwnNames_notTheDomainOnes', () => {
    expect(encode({ type: 'stole', from: 'a', target: 'b' })).toEqual({ v: WIRE_VERSION, t: 'steal.stolen', by: 'a', victim: 'b' });
  });

  it('shouldDropMessage_fromAnotherVersion', () => {
    expect(decode({ ...encode({ type: 'cracked', from: 'a' }), v: WIRE_VERSION + 1 })).toBeUndefined();
  });

  it.each([
    ['an unknown kind', { v: WIRE_VERSION, t: 'steal.teleport', by: 'a' }],
    ['a colour that does not exist', { v: WIRE_VERSION, t: 'steal.sauce', by: 'b', sauce: ['red', 'red', 'red', 'pink'] }],
    ['a lane off the board', { v: WIRE_VERSION, t: 'attack.thrown', by: 'a', at: 'b', weapon: 'fork', lane: 7 }],
    ['life above the maximum', { v: WIRE_VERSION, t: 'race.progress', by: 'a', life: 99, best: 1 }],
    ['no sender', { v: WIRE_VERSION, t: 'race.cracked' }],
    ['not an object', 'hello'],
  ])('shouldDropMessage_withMalformedContent: %s', (_why, message) => {
    expect(decode(message)).toBeUndefined();
  });
});
