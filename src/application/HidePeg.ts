import { SessionWork } from './SessionWork';

export interface HidePegCommand {
  readonly index: number;
}

export type HidePegResponse =
  | { readonly kind: 'hidden'; readonly index: number }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'not-up' };

export interface HidePeg {
  execute(command: HidePegCommand): Promise<HidePegResponse>;
}

export class HidePegImpl implements HidePeg {
  constructor(private readonly work: SessionWork) {}

  execute(command: HidePegCommand): Promise<HidePegResponse> {
    return this.work.run<HidePegResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      return { session: { ...session, pegUp: undefined }, result: { kind: 'hidden', index: command.index } };
    });
  }
}
