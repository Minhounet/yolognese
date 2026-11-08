import { restoreLife } from '../domain/game';
import { blindUntil } from '../domain/guardian';
import { ItemKind, SMOKE_BLIND_MS, isItemShown } from '../domain/items';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, Session } from './ports';
import { GameView } from './views';

export interface CollectItemCommand {
  readonly id: number;
}

export type CollectItemResponse =
  | { readonly kind: 'collected'; readonly item: ItemKind; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'no-item' };

export interface CollectItem {
  execute(command: CollectItemCommand): CollectItemResponse;
}

export class CollectItemImpl implements CollectItem {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(_command: CollectItemCommand): CollectItemResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    const { item, itemAt } = session;
    const now = this.clock.now();
    if (item === undefined || itemAt === undefined || !isItemShown(itemAt, now)) {
      return { kind: 'rejected', reason: 'no-item' };
    }
    const { game, guardian } = this.effectOf(item.kind, session, now);
    this.repository.save({ ...session, game, guardian, item: undefined, itemCollected: true });
    return { kind: 'collected', item: item.kind, view: toGameView(game) };
  }

  private effectOf(kind: ItemKind, session: Session, now: number): Pick<Session, 'game' | 'guardian'> {
    switch (kind) {
      case 'food':
        return { game: restoreLife(session.game), guardian: session.guardian };
      case 'smoke':
        return { game: session.game, guardian: blindUntil(now + SMOKE_BLIND_MS) };
    }
  }
}
