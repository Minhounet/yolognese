import { Code, Color } from './color';
import { Draft, EMPTY_DRAFT, clearSlot, filledSlots, placeColor, swapSlots } from './draft';
import { Game, heal, hurt, isOver, newGame, play, runOutOfTime } from './game';
import { IncomingAttack, Race, RaceEvent, hear, newRace, sabotage, takeOutbox } from './race';
import { Steal, sabotageAttacker } from './steal';
import { Guardian, WATCHING, blindUntil, distractUntil, isBlind, isWatching } from './guardian';

import { AttackKind, Draw, LANES } from './attack';

export type { AttackKind, Draw } from './attack';
export { LANES } from './attack';

export const GAME_MS = 180_000;
export const COOLDOWN_MS = 5_000;
export const CAUGHT_COST = 2;
export const DISTRACTION_MS = 1_500;
export const ITEM_SHOWN_MS = 4_000;
export const FOOD_LIFE = 3;
export const SMOKE_MS = 4_000;
export const XRAY_MS = 1_200;
export const HOURGLASS_MS = 30_000;
export const CHILI_COST = 2;
export const ATTACK_WINDUP_MS = 1_000;
export const ATTACK_COST = 2;
export const ATTACK_POSTPONE_MS = 1_000;
export const NOTICE_MS = 1_500;

const ITEM_DELAY_MIN_MS = 8_000;
const ITEM_DELAY_SPREAD_MS = 7_000;
const ATTACK_DELAY_MIN_MS = 10_000;
const ATTACK_DELAY_SPREAD_MS = 10_000;

/** What can appear on the screen. */
export const ITEM_KINDS = ['food', 'smoke', 'xray', 'hourglass', 'charm', 'present', 'sabotage'] as const;
export type ItemKind = (typeof ITEM_KINDS)[number];
/** Sabotage (the last kind) only shows in a race: it throws an attack at a rival. */
const SOLO_KINDS = ITEM_KINDS.length - 1;

/** What a present can hold: a good thing, or (one time in two) a bad one. */
const GOOD_GIFTS = ['food', 'smoke', 'xray', 'hourglass', 'charm'] as const;
const BAD_GIFTS = ['mixup', 'chili'] as const;
export type Effect = (typeof GOOD_GIFTS)[number] | (typeof BAD_GIFTS)[number] | 'sabotage';

export interface Item {
  readonly id: number;
  readonly kind: ItemKind;
  /** Position as a fraction of the scene, 0.1 to 0.9 on each axis. */
  readonly x: number;
  readonly y: number;
  readonly until: number;
}


export interface Attack {
  readonly kind: AttackKind;
  readonly lane: number;
  readonly landsAt: number;
  /** Race: the rival who threw it; none for the guardian's own throws. */
  readonly from?: string;
}

export type NoticeKind = Effect | 'hit' | 'blocked' | 'stolen' | 'grab-missed' | 'beaten' | 'last-standing' | 'switch' | 'robbed' | 'knocked-out' | 'scored';

export interface Notice {
  readonly kind: NoticeKind;
  readonly at: number;
}

export interface Round {
  readonly game: Game;
  readonly guardian: Guardian;
  readonly draft: Draft;
  readonly endsAt: number;
  readonly peekReadyAt: number;
  readonly xray?: { readonly index: number; readonly until: number };
  readonly items: readonly Item[];
  readonly nextItemId: number;
  readonly nextItemAt: number;
  readonly attack?: Attack;
  readonly nextAttackAt: number;
  readonly shieldLane: number;
  readonly charm: boolean;
  readonly notice?: Notice;
  /** Attacks rivals threw at this player, waiting to fly (multiplayer). */
  readonly incoming: readonly IncomingAttack[];
  /** Present in a race only. */
  readonly race?: Race;
  /** Present in "steal the sauce" only. */
  readonly steal?: Steal;
}

const itemDelay = (draw: Draw) => ITEM_DELAY_MIN_MS + draw(ITEM_DELAY_SPREAD_MS + 1);
const attackDelay = (draw: Draw) => ATTACK_DELAY_MIN_MS + draw(ATTACK_DELAY_SPREAD_MS + 1);
const spot = (draw: Draw) => (10 + draw(81)) / 100;

export function newRound(secret: Code, now: number, draw: Draw): Round {
  return {
    game: newGame(secret),
    guardian: WATCHING,
    draft: EMPTY_DRAFT,
    endsAt: now + GAME_MS,
    peekReadyAt: now,
    items: [],
    nextItemId: 0,
    nextItemAt: now + itemDelay(draw),
    nextAttackAt: now + attackDelay(draw),
    shieldLane: 1,
    charm: false,
    incoming: [],
  };
}

export const notify = (round: Round, kind: NoticeKind, now: number): Round => ({ ...round, notice: { kind, at: now } });

// ---- the row being composed

export function place(round: Round, color: Color): Round {
  return { ...round, draft: placeColor(round.draft, color) };
}

export function clear(round: Round, slot: number): Round {
  return { ...round, draft: clearSlot(round.draft, slot) };
}

export function guess(round: Round, code: Code): Round {
  return { ...round, game: play(round.game, code), draft: EMPTY_DRAFT };
}

// ---- peeking

export type PeekOutcome = 'cooling-down' | 'revealed' | 'caught';

export function peek(round: Round, now: number): { readonly round: Round; readonly outcome: PeekOutcome } {
  if (now < round.peekReadyAt) return { round, outcome: 'cooling-down' };
  if (isBlind(round.guardian, now)) return { round, outcome: 'revealed' };
  const cooled = { ...round, peekReadyAt: now + COOLDOWN_MS };
  if (isWatching(round.guardian, now)) {
    return { round: { ...cooled, game: hurt(round.game, CAUGHT_COST) }, outcome: 'caught' };
  }
  return { round: cooled, outcome: 'revealed' };
}

export function distract(round: Round, now: number): Round {
  return { ...round, guardian: distractUntil(round.guardian, now + DISTRACTION_MS) };
}

// ---- items

export function collect(round: Round, id: number, now: number, draw: Draw): Round | undefined {
  const item = round.items.find((candidate) => candidate.id === id && now < candidate.until);
  if (item === undefined) return undefined;
  const without = { ...round, items: round.items.filter((candidate) => candidate.id !== id) };
  return applyEffect(without, item.kind === 'present' ? unwrap(draw) : item.kind, now, draw);
}

function unwrap(draw: Draw): Effect {
  return draw(2) === 0 ? GOOD_GIFTS[draw(GOOD_GIFTS.length)] : BAD_GIFTS[draw(BAD_GIFTS.length)];
}

function applyEffect(round: Round, effect: Effect, now: number, draw: Draw): Round {
  return notify(EFFECTS[effect](round, now, draw), effect, now);
}

const EFFECTS: Readonly<Record<Effect, (round: Round, now: number, draw: Draw) => Round>> = {
  food: (round) => ({ ...round, game: heal(round.game, FOOD_LIFE) }),
  smoke: (round, now) => ({
    ...round,
    guardian: blindUntil(round.guardian, now + SMOKE_MS),
    attack: undefined,
    nextAttackAt: Math.max(round.nextAttackAt, now + SMOKE_MS),
  }),
  xray: (round, now, draw) => ({ ...round, xray: { index: draw(4), until: now + XRAY_MS } }),
  hourglass: (round) => ({ ...round, endsAt: round.endsAt + HOURGLASS_MS }),
  charm: (round) => ({ ...round, charm: true }),
  mixup: (round, _now, draw) => ({ ...round, draft: switchTwo(round.draft, draw) }),
  chili: (round) => ({ ...round, game: hurt(round.game, CHILI_COST) }),
  sabotage: (round, _now, draw) => {
    if (round.steal !== undefined) return { ...round, steal: sabotageAttacker(round.steal, draw, LANES) };
    return round.race === undefined ? round : { ...round, race: sabotage(round.race, draw) };
  },
};

/** Swaps two placed pegs chosen at random; fewer than two placed: unchanged. */
function switchTwo(draft: Draft, draw: Draw): Draft {
  const filled = filledSlots(draft);
  if (filled.length < 2) return draft;
  const first = draw(filled.length);
  const second = (first + 1 + draw(filled.length - 1)) % filled.length;
  return swapSlots(draft, filled[first], filled[second]);
}

// ---- the shield

export function moveShield(round: Round, lane: number): Round {
  return { ...round, shieldLane: Math.max(0, Math.min(LANES - 1, lane)) };
}

// ---- time passing

/** Applies everything that happens with no player action, up to now. */
export function advance(round: Round, now: number, draw: Draw): Round {
  if (isOver(round.game)) return round;
  if (now >= round.endsAt) return { ...round, game: runOutOfTime(round.game) };
  return [expire, resolveAttack, startAttack, spawnItem].reduce((current, step) => step(current, now, draw), round);
}

function expire(round: Round, now: number): Round {
  return {
    ...round,
    items: round.items.filter((item) => now < item.until),
    xray: round.xray !== undefined && now < round.xray.until ? round.xray : undefined,
  };
}

function spawnItem(round: Round, now: number, draw: Draw): Round {
  if (now < round.nextItemAt) return round;
  const item: Item = {
    id: round.nextItemId,
    kind: ITEM_KINDS[draw(round.race === undefined && round.steal === undefined ? SOLO_KINDS : ITEM_KINDS.length)],
    x: spot(draw),
    y: spot(draw),
    until: now + ITEM_SHOWN_MS,
  };
  return { ...round, items: [...round.items, item], nextItemId: item.id + 1, nextItemAt: now + itemDelay(draw) };
}

function startAttack(round: Round, now: number, draw: Draw): Round {
  if (round.attack !== undefined) return round;
  const thrown = round.incoming[0];
  if (thrown !== undefined) {
    const incoming = round.incoming.slice(1);
    return { ...round, incoming, attack: { kind: thrown.kind, lane: thrown.lane, from: thrown.from, landsAt: now + ATTACK_WINDUP_MS } };
  }
  if (now < round.nextAttackAt) return round;
  if (!isWatching(round.guardian, now)) return { ...round, nextAttackAt: now + ATTACK_POSTPONE_MS };
  const kind: AttackKind = draw(3) === 2 ? 'fork' : 'meatball';
  return { ...round, attack: { kind, lane: draw(LANES), landsAt: now + ATTACK_WINDUP_MS } };
}

function resolveAttack(round: Round, now: number, draw: Draw): Round {
  const { attack } = round;
  if (attack === undefined || now < attack.landsAt) return round;
  const nextAttackAt = attack.from === undefined ? now + attackDelay(draw) : round.nextAttackAt;
  const done = { ...round, attack: undefined, nextAttackAt };
  if (attack.lane === round.shieldLane) return notify(done, 'blocked', now);
  if (round.charm) return notify({ ...done, charm: false }, 'blocked', now);
  if (attack.kind === 'meatball') return notify({ ...done, game: hurt(done.game, ATTACK_COST) }, 'hit', now);
  const filled = filledSlots(round.draft);
  if (filled.length === 0) return notify(done, 'grab-missed', now);
  return notify({ ...done, draft: clearSlot(round.draft, filled[draw(filled.length)]) }, 'stolen', now);
}

// ---- racing

/** Starts a race round: the same secret for everyone, the other players as rivals. */
export function newRaceRound(
  secret: Code,
  me: string,
  players: readonly { readonly id: string; readonly name: string }[],
  now: number,
  draw: Draw,
): Round {
  const round = newRound(secret, now, draw);
  return { ...round, race: newRace(me, players, round.game.life) };
}

/** Applies a rival's event: their progress, an attack thrown at this player, their crack or their exit. */
export function receive(round: Round, event: RaceEvent, now: number): Round {
  if (round.race === undefined) return round;
  const heard = hear(round.race, event);
  const incoming = heard.incoming === undefined ? round.incoming : [...round.incoming, heard.incoming];
  const changed = { ...round, race: heard.race, incoming };
  if (isOver(round.game)) return changed;
  if (heard.beaten) return notify({ ...changed, game: { ...changed.game, beaten: true } }, 'beaten', now);
  if (heard.lastStanding) return notify({ ...changed, game: { ...changed.game, lastStanding: true } }, 'last-standing', now);
  return changed;
}

/** Takes the events this player must send to the room now. */
export function flush(round: Round): { readonly round: Round; readonly events: readonly RaceEvent[] } {
  if (round.race === undefined) return { round, events: [] };
  const { race, events } = takeOutbox(round.race, round.game);
  return { round: { ...round, race }, events };
}

/** Over for good: in "steal the sauce" only the end of the match; otherwise the game itself. */
export function isRoundOver(round: Round): boolean {
  return round.steal !== undefined ? round.steal.finished : isOver(round.game);
}
