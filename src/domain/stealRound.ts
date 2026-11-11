import { Code, Color } from './color';
import { MAX_LIFE, newGame, record } from './game';
import { Draw, NOTICE_MS, Round, newRound, notify } from './round';
import { MatchState, StateCause, Steal, StealEvent, ServerRequest, ask, sauceKey, targetOf } from './steal';

/** Starts this player's "steal the sauce" round from the server's first state. */
export function newStealRound(me: string, state: MatchState, now: number, draw: Draw): Round {
  const steal: Steal = {
    me,
    matchId: state.matchId,
    seats: state.seats,
    rotation: state.rotation,
    nextSwitchAt: toLocal(state.nextSwitchAt, state, now),
    finished: state.finished,
    memory: {},
    pressure: {},
    syncing: false,
    requests: [{ type: 'my-sauce' }],
    outbox: [],
  };
  const round = newRound(undefined, now, draw);
  return { ...round, endsAt: toLocal(state.endsAt, state, now), steal };
}

/** A server time in this phone's clock (the network delay is ignored: under a second). */
const toLocal = (serverTime: number, state: MatchState, now: number) => serverTime - state.serverNow + now;

const fresh = (round: Round, now: number) => round.notice !== undefined && now - round.notice.at < NOTICE_MS;

/** Takes the server's state: scores, rotation, times; the game follows the target, guesses kept per sauce. */
export function applyState(round: Round, state: MatchState, cause: StateCause, now: number): Round {
  const { steal } = round;
  if (steal === undefined || state.matchId !== steal.matchId) return round;
  if (state.rotation < steal.rotation) return round; // an older answer, overtaken
  const before = targetOf(steal);
  const after: Steal = {
    ...steal,
    seats: state.seats,
    rotation: state.rotation,
    nextSwitchAt: toLocal(state.nextSwitchAt, state, now),
    finished: steal.finished || state.finished,
    memory: { ...steal.memory, [sauceKey(before)]: round.game.turns },
    syncing: false,
  };
  const target = targetOf(after);
  const sameSauce = sauceKey(target) === sauceKey(before);
  const game = sameSauce ? round.game : { ...newGame(), turns: after.memory[sauceKey(target)] ?? [], life: round.game.life };
  const turned = { ...round, steal: after, game, endsAt: toLocal(state.endsAt, state, now) };
  if (cause.kind === 'stolen' && cause.victim === steal.me) {
    return notify({ ...turned, steal: ask({ ...after, pressure: {} }, { type: 'my-sauce' }) }, 'robbed', now);
  }
  if (cause.kind === 'stolen' && cause.by === steal.me) return notify(turned, 'scored', now);
  if (!sameSauce && !fresh(round, now)) return notify(turned, 'switch', now);
  return turned;
}

/** The phone's own rules after every action and tick: the end, a knock-out, a switch that is due. */
export function settle(round: Round, now: number): Round {
  const { steal } = round;
  if (steal === undefined || steal.finished) return round;
  if (now >= round.endsAt) return { ...round, steal: ask({ ...steal, finished: true }, { type: 'sync' }) };
  if (round.game.life === 0) {
    return notify({ ...round, steal: ask(steal, { type: 'knockout' }), game: { ...round.game, life: MAX_LIFE } }, 'knocked-out', now);
  }
  if (!steal.syncing && now >= steal.nextSwitchAt && steal.seats.length > 2) {
    return { ...round, steal: ask({ ...steal, syncing: true }, { type: 'sync' }) };
  }
  return round;
}

/** The server scored the guess against the sauce it was made on. */
export function applyScore(round: Round, code: Code, exact: number, misplaced: number, target: string): Round {
  const { steal } = round;
  if (steal === undefined) return round;
  const done = { ...round, steal: { ...steal, guessing: undefined } };
  if (targetOf(steal).id !== target) return done; // the circle turned meanwhile
  return { ...done, game: record(round.game, { guess: code, exact, misplaced }) };
}

/** A peg the server showed: a peek the guardian missed, or the x-ray glasses. */
export function applyPeg(round: Round, index: number, color: Color, via: 'peek' | 'xray', now: number): Round {
  if (via === 'peek') return { ...round, reveal: { index, color, at: now } };
  return round.xray?.index === index ? { ...round, xray: { ...round.xray, color } } : round;
}

export function applyMySauce(round: Round, sauce: Code): Round {
  return round.steal === undefined ? round : { ...round, steal: { ...round.steal, mySauce: sauce } };
}

/** The server did not answer: let the player try again. */
export function serverFailed(round: Round, request: ServerRequest): Round {
  const { steal } = round;
  if (steal === undefined) return round;
  if (request.type === 'guess') return { ...round, steal: { ...steal, guessing: undefined } };
  if (request.type === 'sync') return { ...round, steal: { ...steal, syncing: false } };
  return round;
}

/** Applies what the room said: the server's state, an attacker's progress, a rival's sabotage. */
export function receiveSteal(round: Round, event: StealEvent, now: number): Round {
  const { steal } = round;
  if (steal === undefined) return round;
  switch (event.type) {
    case 'state':
      return applyState(round, event.state, event.cause, now);
    case 'pressure':
      return event.target === steal.me ? { ...round, steal: { ...steal, pressure: { ...steal.pressure, [event.from]: event.bestExact } } } : round;
    case 'attack':
      return event.to === steal.me && !steal.finished
        ? { ...round, incoming: [...round.incoming, { kind: event.kind, lane: event.lane, from: event.from }] }
        : round;
  }
}

/** Takes what must leave the phone now: messages for the room, questions for the server. */
export function flushSteal(round: Round): { readonly round: Round; readonly events: readonly StealEvent[]; readonly requests: readonly ServerRequest[] } {
  const { steal } = round;
  if (steal === undefined) return { round, events: [], requests: [] };
  return { round: { ...round, steal: { ...steal, outbox: [], requests: [] } }, events: steal.outbox, requests: steal.requests };
}
