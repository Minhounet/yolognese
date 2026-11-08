export const LANE_COUNT = 3;
export const ATTACK_DELAY_SPREAD_MS = 10001;

const MIN_ATTACK_DELAY_MS = 10000;
const ATTACK_WIND_UP_MS = 1000;

export interface Attack {
  readonly lane: number;
  readonly landsInMs: number;
}

export function scheduleAttackAt(now: number, drawnDelayMs: number): number {
  return now + MIN_ATTACK_DELAY_MS + drawnDelayMs;
}

export function isAttackDue(attackAt: number, now: number): boolean {
  return attackAt <= now;
}

export function windUp(lane: number): Attack {
  return { lane, landsInMs: ATTACK_WIND_UP_MS };
}

export function hasLanded(landsAt: number, now: number): boolean {
  return landsAt <= now;
}

export function isBlocked(attackLane: number | undefined, shieldLane: number | undefined): boolean {
  return attackLane === shieldLane;
}
