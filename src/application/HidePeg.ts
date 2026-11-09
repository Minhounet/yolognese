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

  execute(_command: HidePegCommand): HidePegResponse {
    return { kind: 'rejected', reason: 'no-game' };
  }
}
