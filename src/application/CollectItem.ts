import { collect } from '../domain/round';
import { ActionResponse, RoundAction } from './RoundAction';

export interface CollectItem {
  execute(command: { readonly id: number }): ActionResponse;
}

export class CollectItemImpl implements CollectItem {
  constructor(private readonly action: RoundAction) {}

  execute({ id }: { readonly id: number }): ActionResponse {
    return this.action.run((round, now, draw) => collect(round, id, now, draw));
  }
}
