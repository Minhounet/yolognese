import { SessionWork } from './SessionWork';

export interface MoveShieldCommand {
  readonly lane: number;
}

export type MoveShieldResponse =
  | { readonly kind: 'moved'; readonly lane: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface MoveShield {
  execute(command: MoveShieldCommand): Promise<MoveShieldResponse>;
}

export class MoveShieldImpl implements MoveShield {
  constructor(private readonly work: SessionWork) {}

  execute(command: MoveShieldCommand): Promise<MoveShieldResponse> {
    return this.work.run<MoveShieldResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      return { session: { ...session, shieldLane: command.lane }, result: { kind: 'moved', lane: command.lane } };
    });
  }
}
