import { COLORS, Code } from './color';
import { MAX_LIFE, bestExact, isCracked, newGame } from './game';
import { Draw, NOTICE_MS, Round, newRound, notify } from './round';
import {
  MATCH_MS,
  SWITCH_EVERY_MS,
  Seat,
  Steal,
  StealEvent,
  newSteal,
  score,
  send,
  targetOf,
} from './steal';

/** Starts this player's "steal the sauce" round: it attacks the next seat in the circle. */
export function newStealRound(
  me: string,
  seats: readonly (Seat & { readonly secret: Code })[],
  now: number,
  draw: Draw,
): Round {
  const secrets = Object.fromEntries(seats.map(({ id, secret }) => [id, secret]));
  const steal = newSteal(me, seats.map(({ id, name }) => ({ id, name })), secrets, now);
  const round = newRound(secrets[targetOf(steal).id], now, draw);
  return { ...round, endsAt: now + MATCH_MS, steal };
}

const drawSecret = (draw: Draw): Code => [0, 1, 2, 3].map(() => COLORS[draw(COLORS.length)]) as unknown as Code;

/** Turns the circle to the given rotation: guesses on the old target are kept, the new target's come back. */
function applySwitch(round: Round, steal: Steal, rotation: number, now: number): Round {
  const old = targetOf(steal).id;
  const memory = { ...steal.memory, [old]: steal.waiting ? [] : round.game.turns };
  const turned: Steal = { ...steal, memory, rotation, waiting: false, nextSwitchAt: now + SWITCH_EVERY_MS };
  const target = targetOf(turned).id;
  const game = { ...newGame(turned.secrets[target]), turns: memory[target] ?? [], life: round.game.life };
  const turnedRound = { ...round, steal: turned, game, draft: round.draft.map(() => undefined), xray: undefined };
  const fresh = round.notice !== undefined && now - round.notice.at < NOTICE_MS;
  const keep = fresh && (round.notice?.kind === 'robbed' || round.notice?.kind === 'scored');
  return keep ? turnedRound : notify(turnedRound, 'switch', now);
}

/** The host turns the circle and tells the room. */
function hostSwitch(round: Round, steal: Steal, now: number): Round {
  const rotation = steal.rotation + 1;
  return applySwitch(round, send(steal, { type: 'switch', from: steal.me, rotation }), rotation, now);
}

/**
 * Applies this mode's rules after every action and tick: the end of the match,
 * a knock-out (life at 0: a point lost, life back), a crack (a point, then wait
 * for the switch), and the host's timed switch.
 */
export function settle(round: Round, now: number): Round {
  const { steal } = round;
  if (steal === undefined || steal.finished) return round;
  if (now >= round.endsAt) return { ...round, steal: { ...steal, finished: true } };
  if (round.game.life === 0) {
    const knocked = send(score(steal, steal.me, -1), { type: 'knocked-out', from: steal.me });
    return settle(notify({ ...round, steal: knocked, game: { ...round.game, life: MAX_LIFE } }, 'knocked-out', now), now);
  }
  if (isCracked(round.game) && !steal.waiting) {
    const target = targetOf(steal).id;
    const cracked = send({ ...score(steal, steal.me, 1), waiting: true }, { type: 'stole', from: steal.me, target });
    const scored = notify(round, 'scored', now);
    return cracked.host ? hostSwitch(scored, cracked, now) : { ...scored, steal: cracked };
  }
  if (steal.host && now >= steal.nextSwitchAt) return hostSwitch(round, steal, now);
  return round;
}

/** Applies what another player's phone said. */
export function receiveSteal(round: Round, event: StealEvent, now: number, draw: Draw): Round {
  const { steal } = round;
  if (steal === undefined || steal.finished || event.from === steal.me) return round;
  switch (event.type) {
    case 'switch':
      return event.rotation > steal.rotation ? applySwitch(round, steal, event.rotation, now) : round;
    case 'stole': {
      const scored = score(steal, event.from, 1);
      const robbed = event.target === steal.me;
      const renewed = robbed ? withNewSecret(scored, drawSecret(draw)) : scored;
      const told = robbed ? notify({ ...round, steal: renewed }, 'robbed', now) : { ...round, steal: renewed };
      return renewed.host ? hostSwitch(told, renewed, now) : told;
    }
    case 'new-secret': {
      const secrets = { ...steal.secrets, [event.from]: event.secret };
      const memory = { ...steal.memory, [event.from]: [] };
      const changed = { ...steal, secrets, memory };
      const facing = targetOf(steal).id === event.from && !steal.waiting;
      const game = facing ? { ...newGame(event.secret), life: round.game.life } : round.game;
      return { ...round, steal: changed, game };
    }
    case 'knocked-out':
      return { ...round, steal: score(steal, event.from, -1) };
    case 'pressure':
      return event.target === steal.me ? { ...round, steal: { ...steal, pressure: { ...steal.pressure, [event.from]: event.bestExact } } } : round;
    case 'attack':
      return event.to === steal.me
        ? { ...round, incoming: [...round.incoming, { kind: event.kind, lane: event.lane, from: event.from }] }
        : round;
  }
}

function withNewSecret(steal: Steal, secret: Code): Steal {
  return send({ ...steal, secrets: { ...steal.secrets, [steal.me]: secret }, pressure: {} }, { type: 'new-secret', from: steal.me, secret });
}

/** Takes the events to send now: the queued ones, plus this player's pressure on its target when it changed. */
export function flushSteal(round: Round): { readonly round: Round; readonly events: readonly StealEvent[] } {
  const { steal } = round;
  if (steal === undefined) return { round, events: [] };
  const now = { target: targetOf(steal).id, bestExact: steal.waiting ? 4 : bestExact(round.game) };
  const events: StealEvent[] = [...steal.outbox];
  if (now.target !== steal.told.target || now.bestExact !== steal.told.bestExact) {
    events.push({ type: 'pressure', from: steal.me, target: now.target, bestExact: now.bestExact });
  }
  return { round: { ...round, steal: { ...steal, outbox: [], told: now } }, events };
}
