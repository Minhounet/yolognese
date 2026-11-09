import { GameRepository } from './ports';

export interface MoveShieldCommand {
  readonly lane: number;
}

export type MoveShieldResponse =
  | { readonly kind: 'moved'; readonly lane: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface MoveShield {
  execute(command: MoveShieldCommand): MoveShieldResponse;
}

export class MoveShieldImpl implements MoveShield {
  constructor(private readonly repository: GameRepository) {}

  execute(command: MoveShieldCommand): MoveShieldResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    this.repository.save({ ...session, shieldLane: command.lane });
    return { kind: 'moved', lane: command.lane };
  }
}
