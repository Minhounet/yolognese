import { Code, Color } from '../domain/color';
import { EMPTY_DRAFT } from '../domain/draft';
import { MAX_LIFE, isOver, newGame, record } from '../domain/game';
import { WATCHING } from '../domain/guardian';
import { MatchState, RoomEvent, ServerRequest, StateCause, Steal, StealNotice, ask, sauceKey, targetOf } from '../domain/steal';
import { Session } from './ports';

/** How long a notice ("Switch!", "Your sauce was stolen!") stays on screen. */
export const NOTICE_MS = 1500;

/** Round 14: ink left on a screen fades by itself after this long, even if never wiped. */
export const INK_MAX_MS = 20_000;
/** How many of the rivals' latest attempts on this player's sauce are kept for the screen. */
const ATTEMPTS_KEPT = 3;

/** A server time in this phone's clock (the network delay is ignored: under a second). */
const toLocal = (serverTime: number, state: MatchState, now: number) => serverTime - state.serverNow + now;

/** Over for good: in "steal the sauce" only the end of the match; otherwise the game itself. */
export function isSessionOver(session: Session): boolean {
  return session.steal !== undefined ? session.steal.finished : isOver(session.game);
}

/** This player's "steal the sauce" session, from the server's first state; the sauce it attacks is unknown here. */
export function newStealSession(me: string, state: MatchState, now: number): Session {
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
    attempts: [],
  };
  return {
    game: newGame(),
    guardian: WATCHING,
    peekReadyAt: 0,
    endsAt: toLocal(state.endsAt, state, now),
    draft: EMPTY_DRAFT,
    steal,
  };
}

const notify = (steal: Steal, kind: StealNotice, now: number): Steal => ({ ...steal, notice: { kind, at: now } });
const fresh = (steal: Steal, now: number) => steal.notice !== undefined && now - steal.notice.at < NOTICE_MS;

/** Takes the server's state: scores, rotation, times; the game follows the target, guesses kept per sauce. */
export function applyState(session: Session, state: MatchState, cause: StateCause, now: number): Session {
  const { steal } = session;
  if (steal === undefined || state.matchId !== steal.matchId) return session;
  if (state.rotation < steal.rotation) return session; // an older answer, overtaken
  const before = targetOf(steal);
  const nextSwitchAt = toLocal(state.nextSwitchAt, state, now);
  const finished = steal.finished || state.finished;
  // a sync this state already answers (the switch it waited for is done) is not asked again
  const answered = (request: ServerRequest) => request.type === 'sync' && !finished && now < nextSwitchAt;
  const after: Steal = {
    ...steal,
    seats: state.seats,
    rotation: state.rotation,
    nextSwitchAt,
    finished,
    memory: { ...steal.memory, [sauceKey(before)]: session.game.turns },
    syncing: false,
    requests: steal.requests.filter((request) => !answered(request)),
  };
  const target = targetOf(after);
  const sameSauce = sauceKey(target) === sauceKey(before);
  const game = sameSauce ? session.game : { ...newGame(), turns: after.memory[sauceKey(target)] ?? [], life: session.game.life };
  const turned = { ...session, game, endsAt: toLocal(state.endsAt, state, now), pegUp: sameSauce ? session.pegUp : undefined };
  if (cause.kind === 'stolen' && cause.victim === steal.me) {
    return { ...turned, steal: notify(ask({ ...after, pressure: {}, attempts: [] }, { type: 'my-sauce' }), 'robbed', now) };
  }
  if (cause.kind === 'stolen' && cause.by === steal.me) return { ...turned, steal: notify(after, 'scored', now) };
  if (!sameSauce && !fresh(steal, now)) return { ...turned, steal: notify(after, 'switch', now) };
  return { ...turned, steal: after };
}

/** The match's own rules after any change: the end, a knock-out (life 0: a point lost, life back), a switch that is due. */
export function settleSteal(session: Session, now: number): Session {
  const { steal } = session;
  if (steal === undefined || steal.finished) return session;
  if (now >= session.endsAt) return { ...session, steal: ask({ ...steal, finished: true, ink: undefined }, { type: 'sync' }) };
  if (steal.ink !== undefined && now - steal.ink.at >= INK_MAX_MS) return settleSteal({ ...session, steal: { ...steal, ink: undefined } }, now);
  if (session.game.life <= 0) {
    const knocked = notify(ask(steal, { type: 'knockout' }), 'knocked-out', now);
    return { ...session, steal: knocked, game: { ...session.game, life: MAX_LIFE } };
  }
  if (!steal.syncing && now >= steal.nextSwitchAt && steal.seats.length > 2) {
    return { ...session, steal: ask({ ...steal, syncing: true }, { type: 'sync' }) };
  }
  return session;
}

/** A guess goes to the server, one at a time; the row is emptied as for a local guess. */
export function sendGuess(session: Session, steal: Steal, code: Code): Session {
  if (steal.guessing !== undefined) return session;
  return { ...session, steal: ask({ ...steal, guessing: code }, { type: 'guess', code }), draft: EMPTY_DRAFT };
}

/** The server scored the guess against the sauce it was made on. */
export function applyScore(session: Session, code: Code, exact: number, misplaced: number, target: string): Session {
  const { steal } = session;
  if (steal === undefined) return session;
  const done = { ...session, steal: { ...steal, guessing: undefined } };
  if (targetOf(steal).id !== target) return done; // the circle turned meanwhile
  return { ...done, game: record(session.game, { guess: code, exact, misplaced }) };
}

/** A peg the server showed: a peek the guardian missed (the peg stays up, AC20), or the x-ray glasses. */
export function applyPeg(session: Session, index: number, color: Color, via: 'peek' | 'xray'): Session {
  if (via === 'peek') return { ...session, pegUp: { index, color } };
  return session.xray?.index === index ? { ...session, xray: { ...session.xray, color } } : session;
}

export function applyMySauce(session: Session, sauce: Code): Session {
  return session.steal === undefined ? session : { ...session, steal: { ...session.steal, mySauce: sauce } };
}

/** The server did not answer: let the player try again. */
export function serverFailed(session: Session, request: ServerRequest): Session {
  const { steal } = session;
  if (steal === undefined) return session;
  if (request.type === 'guess') return { ...session, steal: { ...steal, guessing: undefined } };
  if (request.type === 'sync') return { ...session, steal: { ...steal, syncing: false } };
  return session;
}

/** Applies what the room said: the server's state, an attacker's guess on this player's sauce, a rival's ink. */
export function receiveSteal(session: Session, event: RoomEvent, now: number): Session {
  const { steal } = session;
  if (steal === undefined) return session;
  if (event.type === 'state') return applyState(session, event.state, event.cause, now);
  if (event.target !== steal.me || steal.finished) return session;
  if (event.type === 'ink') {
    return { ...session, steal: notify({ ...steal, ink: { by: event.from, left: 1, at: now } }, 'inked', now) };
  }
  const attempts = event.attempt === undefined ? steal.attempts : [...steal.attempts, { ...event.attempt, by: event.from }].slice(-ATTEMPTS_KEPT);
  return { ...session, steal: { ...steal, attempts, pressure: { ...steal.pressure, [event.from]: event.bestExact } } };
}

/** Round 14: the player rubs the ink off; `amount` is the share wiped (the screen measures the finger's travel). */
export function wipeInk(session: Session, amount: number): Session {
  const ink = session.steal?.ink;
  if (session.steal === undefined || ink === undefined) return session;
  const left = Math.max(0, ink.left - Math.max(0, amount));
  return { ...session, steal: { ...session.steal, ink: left === 0 ? undefined : { ...ink, left } } };
}

/** Round 14: the ink item, in "steal the sauce": thrown at the player whose sauce this player is after. */
export function throwInk(session: Session, now: number): Session {
  const { steal } = session;
  if (steal === undefined) return session;
  return { ...session, steal: notify(ask(steal, { type: 'ink' }), 'ink-thrown', now) };
}

/** Takes the questions for the server. */
export function takeRequests(session: Session): { readonly session: Session; readonly requests: readonly ServerRequest[] } {
  const { steal } = session;
  if (steal === undefined || steal.requests.length === 0) return { session, requests: [] };
  return { session: { ...session, steal: { ...steal, requests: [] } }, requests: steal.requests };
}

/** The peg a peek asks the server for. */
export function askPeg(session: Session, index: number, via: 'peek' | 'xray'): Session {
  return session.steal === undefined ? session : { ...session, steal: ask(session.steal, { type: 'peek', index, via }) };
}
