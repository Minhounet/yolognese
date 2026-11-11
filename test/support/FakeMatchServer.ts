import { GuessAnswer, MatchServer } from '../../src/application/ports';
import { COLORS, Code, Color } from '../../src/domain/color';
import { MatchState, StateCause, StealEvent } from '../../src/domain/steal';
import { FakeClock } from './FakeClock';

const SWITCH_MS = 45_000;
const MATCH_MS = 300_000;

interface Match {
  readonly id: string;
  readonly seats: { readonly id: string; readonly name: string; points: number; version: number; sauce: Code; lastPeek?: number }[];
  rotation: number;
  nextSwitchAt: number;
  endsAt: number;
  guesses: { attacker: string; target: string; version: number; exact: number }[];
}

/**
 * The match server's rules (supabase/migrations/*steal_the_sauce.sql) in memory,
 * for the application tests: same circle, scoring, points and switches. Each
 * player gets a view of it bound to its identity (`as`); what the real server
 * broadcasts to the room goes to `broadcast`.
 */
export class FakeMatchServer {
  private readonly lobby = new Map<string, Code>();
  private readonly matches = new Map<string, Match>();
  private nextMatch = 0;
  /** Sauces the server draws for robbed players, in order (then all orange). */
  readonly newSauces: Code[] = [];

  constructor(
    private readonly clock: FakeClock,
    private readonly broadcast: (event: StealEvent) => void,
  ) {}

  as(player: string): MatchServer {
    return {
      setSauce: async (code, sauce) => void this.lobby.set(`${code}/${player}`, sauce),
      start: async (code, players) => this.start(code, player, players),
      guess: async (matchId, code) => this.guess(this.seated(matchId, player), player, code),
      peek: async (matchId, index) => this.peek(this.seated(matchId, player), player, index),
      sync: async (matchId) => this.sync(this.seated(matchId, player)),
      knockout: async (matchId) => this.knockout(this.seated(matchId, player), player),
      mySauce: async (matchId) => this.seated(matchId, player).seats.find(({ id }) => id === player)!.sauce,
    };
  }

  private start(code: string, caller: string, players: readonly { readonly id: string; readonly name: string }[]): MatchState {
    if (players[0]?.id !== caller) throw new Error('only the host starts');
    const now = this.clock.now();
    const match: Match = {
      id: `m${++this.nextMatch}`,
      seats: players.map(({ id, name }) => ({ id, name, points: 0, version: 0, sauce: this.lobby.get(`${code}/${id}`) ?? ['red', 'red', 'red', 'red'] })),
      rotation: 0,
      nextSwitchAt: now + SWITCH_MS,
      endsAt: now + MATCH_MS,
      guesses: [],
    };
    this.matches.set(match.id, match);
    return this.say(match, { kind: 'start' });
  }

  private seated(matchId: string, player: string): Match {
    const match = this.matches.get(matchId);
    if (match === undefined || !match.seats.some(({ id }) => id === player)) throw new Error('not a player of this match');
    return match;
  }

  private target(match: Match, player: string) {
    const count = match.seats.length;
    const seat = match.seats.findIndex(({ id }) => id === player);
    return match.seats[(seat + 1 + (match.rotation % Math.max(1, count - 1))) % count];
  }

  private advance(match: Match): boolean {
    const now = this.clock.now();
    if (now < match.nextSwitchAt) return false;
    const due = Math.floor((Math.min(now, match.endsAt) - match.nextSwitchAt) / SWITCH_MS) + 1;
    if (match.seats.length > 2) match.rotation += due;
    match.nextSwitchAt += SWITCH_MS * due;
    return match.seats.length > 2;
  }

  private guess(match: Match, player: string, code: Code): GuessAnswer {
    const turned = this.advance(match);
    if (this.clock.now() >= match.endsAt) return { kind: 'match-over', state: this.state(match) };
    const target = this.target(match, player);
    const exact = code.filter((color, index) => color === target.sauce[index]).length;
    const shared = COLORS.reduce((n, c) => n + Math.min(target.sauce.filter((s) => s === c).length, code.filter((g) => g === c).length), 0);
    match.guesses.push({ attacker: player, target: target.id, version: target.version, exact });
    if (exact === 4) {
      match.seats.find(({ id }) => id === player)!.points += 1;
      target.sauce = this.newSauces.shift() ?? ['orange', 'orange', 'orange', 'orange'];
      target.version += 1;
      match.rotation += 1;
      match.nextSwitchAt = this.clock.now() + SWITCH_MS;
      return { kind: 'scored', exact, misplaced: 0, target: target.id, state: this.say(match, { kind: 'stolen', by: player, victim: target.id }) };
    }
    const best = Math.max(...match.guesses.filter((g) => g.attacker === player && g.target === target.id && g.version === target.version).map((g) => g.exact));
    this.broadcast({ type: 'pressure', from: player, target: target.id, bestExact: best });
    const state = turned ? this.say(match, { kind: 'switch' }) : this.state(match);
    return { kind: 'scored', exact, misplaced: shared - exact, target: target.id, state };
  }

  private peek(match: Match, player: string, index: number): Color | undefined {
    const seat = match.seats.find(({ id }) => id === player)!;
    const now = this.clock.now();
    if (seat.lastPeek !== undefined && now - seat.lastPeek < 1000) return undefined;
    seat.lastPeek = now;
    return this.target(match, player).sauce[index];
  }

  private sync(match: Match): MatchState {
    return this.advance(match) ? this.say(match, { kind: 'switch' }) : this.state(match);
  }

  private knockout(match: Match, player: string): MatchState {
    const seat = match.seats.find(({ id }) => id === player)!;
    seat.points = Math.max(0, seat.points - 1);
    return this.say(match, { kind: 'knockout', by: player });
  }

  private state(match: Match): MatchState {
    const now = this.clock.now();
    return {
      matchId: match.id,
      rotation: match.rotation,
      nextSwitchAt: match.nextSwitchAt,
      endsAt: match.endsAt,
      serverNow: now,
      finished: now >= match.endsAt,
      seats: match.seats.map(({ id, name, points, version }) => ({ id, name, points, version })),
    };
  }

  private say(match: Match, cause: StateCause): MatchState {
    const state = this.state(match);
    this.broadcast({ type: 'state', state, cause });
    return state;
  }
}
