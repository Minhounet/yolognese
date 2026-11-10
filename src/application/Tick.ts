import { advance } from '../domain/round';
import { ActionResponse, RoundAction } from './RoundAction';

/** Lets time pass: the clock runs out, items come and go, the guardian attacks. Called by the screen every 100 ms. */
export interface Tick {
  execute(): ActionResponse;
}

export class TickImpl implements Tick {
  constructor(private readonly action: RoundAction) {}

  execute(): ActionResponse {
    return this.action.run(advance);
  }
}
