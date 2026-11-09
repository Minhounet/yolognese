import { Point } from './point';

export const ITEM_DELAY_SPREAD_MS = 7001;
export const ITEM_SPOT_SPAN = 101;

const MIN_ITEM_DELAY_MS = 8000;
const ITEM_SHOWN_MS = 4000;

export const SMOKE_BLIND_MS = 4000;

export const DARKNESS_MS = 4000;

export const HOURGLASS_BONUS_MS = 30000;

const FIELD_GIFT_KINDS = ['food', 'smoke', 'xray', 'hourglass', 'charm'] as const;

export const GIFT_KINDS = [...FIELD_GIFT_KINDS, 'darkness', 'bomb'] as const;

export type GiftKind = (typeof GIFT_KINDS)[number];

export const ITEM_KINDS = [...FIELD_GIFT_KINDS, 'present', 'bomb'] as const;

export type ItemKind = (typeof ITEM_KINDS)[number];

export interface Item {
  readonly id: number;
  readonly kind: ItemKind;
  readonly spot: Point;
}

export function scheduleItemAt(now: number, drawnDelayMs: number): number {
  return now + MIN_ITEM_DELAY_MS + drawnDelayMs;
}

export function isItemShown(itemAt: number, now: number): boolean {
  return itemAt <= now && now < itemAt + ITEM_SHOWN_MS;
}

export function isItemGone(itemAt: number, now: number): boolean {
  return itemAt + ITEM_SHOWN_MS <= now;
}

export function isInDarkness(darkUntil: number | undefined, now: number): boolean {
  return darkUntil !== undefined && now < darkUntil;
}

export function appear(kindIndex: number, x: number, y: number): Item {
  return { id: 0, kind: ITEM_KINDS[kindIndex], spot: { x, y } };
}

export function isBombLeft(item: Item | undefined, itemAt: number, now: number): boolean {
  return item?.kind === 'bomb' && isItemGone(itemAt, now);
}
