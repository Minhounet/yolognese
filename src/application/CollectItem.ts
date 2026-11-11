import { EMPTY_DRAFT, switchTwo } from '../domain/draft';
import { explode, isOver, restoreLife } from '../domain/game';
import { blindUntil } from '../domain/guardian';
import { DARKNESS_MS, GIFT_KINDS, GiftKind, HOURGLASS_BONUS_MS, ItemKind, SMOKE_BLIND_MS, XRAY_SHOWN_MS, isItemShown } from '../domain/items';

const SECRET_LENGTH = 4;
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource, Session } from './ports';
import { GameView } from './views';

export interface CollectItemCommand {
  readonly id: number;
}

export type CollectItemResponse =
  | {
      readonly kind: 'collected';
      readonly item: ItemKind;
      readonly gift?: GiftKind;
      readonly view: GameView;
    }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'no-item' | 'game-over' };

export interface CollectItem {
  execute(command: CollectItemCommand): CollectItemResponse;
}

export class CollectItemImpl implements CollectItem {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(_command: CollectItemCommand): CollectItemResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    if (isOver(session.game)) {
      return { kind: 'rejected', reason: 'game-over' };
    }
    const { item, itemAt } = session;
    const now = this.clock.now();
    if (item === undefined || itemAt === undefined || !isItemShown(itemAt, now)) {
      return { kind: 'rejected', reason: 'no-item' };
    }
    const received = item.kind === 'present' ? this.drawGift() : item.kind;
    const affected = item.kind === 'bomb' ? session : this.effectOf(received, session, now);
    this.repository.save({ ...affected, item: undefined, itemCollected: true });
    return {
      kind: 'collected',
      item: item.kind,
      gift: item.kind === 'present' ? received : undefined,
      view: toGameView(affected.game, { session: affected, now }),
    };
  }

  private effectOf(kind: GiftKind, session: Session, now: number): Session {
    switch (kind) {
      case 'food':
        return { ...session, game: restoreLife(session.game) };
      case 'smoke':
        return { ...session, guardian: blindUntil(now + SMOKE_BLIND_MS) };
      case 'xray':
        return { ...session, xray: { index: this.random.nextInt(SECRET_LENGTH), until: now + XRAY_SHOWN_MS } };
      case 'hourglass':
        return { ...session, endsAt: session.endsAt + HOURGLASS_BONUS_MS };
      case 'charm':
        return { ...session, charmed: true };
      case 'darkness':
        return { ...session, darkUntil: now + DARKNESS_MS };
      case 'bomb':
        return { ...session, game: explode(session.game) };
      case 'mixup':
        return { ...session, draft: switchTwo(session.draft ?? EMPTY_DRAFT, (count) => this.random.nextInt(count)) };
    }
  }

  private drawGift(): GiftKind {
    return GIFT_KINDS[this.random.nextInt(GIFT_KINDS.length)];
  }

}
