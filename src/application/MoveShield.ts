import { moveShield } from '../domain/round';
import { ActionResponse, RoundAction } from './RoundAction';

export interface MoveShield {
  execute(command: { readonly lane: number }): ActionResponse;
}

export class MoveShieldImpl implements MoveShield {
  constructor(private readonly action: RoundAction) {}

  execute({ lane }: { readonly lane: number }): ActionResponse {
    return this.action.run((round) => moveShield(round, lane));
  }
}
