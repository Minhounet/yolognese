export const LANE_COUNT = 3;
export const ATTACK_DELAY_SPREAD_MS = 10001;

const MIN_ATTACK_DELAY_MS = 10000;
const ATTACK_WIND_UP_MS = 1500;
const PUNCH_WIND_UP_MS = 450;

/** AC34: one throw in three is a fork, which steals a placed peg instead of costing life. */
const THROW_KINDS = 3;
const FORK_KIND = 2;

/** One draw decides both the lane and the kind: the lane is the draw's remainder by LANE_COUNT. */
export const THROW_DRAW_SPAN = LANE_COUNT * THROW_KINDS;

export interface Attack {
  readonly lane: number;
  readonly landsInMs: number;
  readonly fork?: true;
}

export function scheduleAttackAt(now: number, drawnDelayMs: number): number {
  return now + MIN_ATTACK_DELAY_MS + drawnDelayMs;
}

export function isAttackDue(attackAt: number, now: number): boolean {
  return attackAt <= now;
}

export function windUp(throwDraw: number): Attack {
  const lane = throwDraw % LANE_COUNT;
  const fork = Math.floor(throwDraw / LANE_COUNT) === FORK_KIND;
  return fork ? { lane, landsInMs: ATTACK_WIND_UP_MS, fork: true } : { lane, landsInMs: ATTACK_WIND_UP_MS };
}

export function punchWindUp(lane: number): Attack {
  return { lane, landsInMs: PUNCH_WIND_UP_MS };
}

export function hasLanded(landsAt: number, now: number): boolean {
  return landsAt <= now;
}

export function isBlocked(attackLane: number | undefined, shieldLane: number | undefined): boolean {
  return attackLane === shieldLane;
}
