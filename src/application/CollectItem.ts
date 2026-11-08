import { restoreLife } from '../domain/game';
import { ItemKind, isItemShown } from '../domain/items';
import { toGameView } from './GameMapper';
import { Clock, GameRepository } from './ports';
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
    if (item === undefined || itemAt === undefined || !isItemShown(itemAt, this.clock.now())) {
      return { kind: 'rejected', reason: 'no-item' };
    }
    const game = restoreLife(session.game);
    this.repository.save({ ...session, game });
    return { kind: 'collected', item: item.kind, view: toGameView(game) };
  }
}
