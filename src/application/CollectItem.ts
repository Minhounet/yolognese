import { ItemKind } from '../domain/items';
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
    return { kind: 'rejected', reason: 'no-game' };
  }
}
