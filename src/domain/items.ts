import { Point } from './point';

export const ITEM_DELAY_SPREAD_MS = 7001;
export const ITEM_SPOT_SPAN = 101;

const MIN_ITEM_DELAY_MS = 8000;
const ITEM_SHOWN_MS = 4000;

export const SMOKE_BLIND_MS = 4000;

export const DARKNESS_MS = 4000;

export const HOURGLASS_BONUS_MS = 30000;

/** AC32: the x-ray glasses show a peg for a moment only. */
export const XRAY_SHOWN_MS = 1200;

const FIELD_GIFT_KINDS = ['food', 'smoke', 'xray', 'hourglass', 'charm'] as const;

/** A present's gift: one of the field's, or a bad one (darkness, a bomb, AC33's mix-up). */
export const GIFT_KINDS = [...FIELD_GIFT_KINDS, 'darkness', 'mixup', 'bomb'] as const;

export type GiftKind = (typeof GIFT_KINDS)[number];

export const ITEM_KINDS = [...FIELD_GIFT_KINDS, 'present', 'bomb'] as const;

/** Round 14: in "steal the sauce" the field also shows 🦑 ink, thrown at the player whose sauce you are after. */
export const MATCH_ITEM_KINDS = [...ITEM_KINDS, 'ink'] as const;

export type ItemKind = (typeof MATCH_ITEM_KINDS)[number];

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

export function appear(kindIndex: number, x: number, y: number, kinds: readonly ItemKind[] = ITEM_KINDS): Item {
  return { id: 0, kind: kinds[kindIndex], spot: { x, y } };
}

export function isBombLeft(item: Item | undefined, itemAt: number, now: number): boolean {
  return item?.kind === 'bomb' && isItemGone(itemAt, now);
}
