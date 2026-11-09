import { GameRepository } from './ports';

export interface HidePegCommand {
  readonly index: number;
}

export type HidePegResponse =
  | { readonly kind: 'hidden'; readonly index: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'not-up' };

export interface HidePeg {
  execute(command: HidePegCommand): HidePegResponse;
}

export class HidePegImpl implements HidePeg {
  constructor(private readonly repository: GameRepository) {}

  execute(command: HidePegCommand): HidePegResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    this.repository.save({ ...session, pegUp: undefined });
    return { kind: 'hidden', index: command.index };
  }
}
