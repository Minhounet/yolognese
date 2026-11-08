import { Point } from './point';

export const ITEM_DELAY_SPREAD_MS = 7001;
export const ITEM_SPOT_SPAN = 101;

const MIN_ITEM_DELAY_MS = 8000;

export const ITEM_KINDS = ['food'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export interface Item {
  readonly kind: ItemKind;
  readonly spot: Point;
}

export function scheduleItemAt(now: number, drawnDelayMs: number): number {
  return now + MIN_ITEM_DELAY_MS + drawnDelayMs;
}

export function isItemDue(itemAt: number, now: number): boolean {
  return itemAt <= now;
}

export function appear(kindIndex: number, x: number, y: number): Item {
  return { kind: ITEM_KINDS[kindIndex], spot: { x, y } };
}
