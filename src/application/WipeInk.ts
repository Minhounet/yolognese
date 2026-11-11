import { toGameView } from './GameMapper';
import { Clock } from './ports';
import { SessionWork } from './SessionWork';
import { wipeInk } from './stealMatch';
import { GameView } from './views';

/** Round 14: the player rubs a rival's ink off the screen; `amount` is the share wiped by the finger's travel. */
export class WipeInk {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(amount: number): Promise<GameView | undefined> {
    return this.work.run((session) => {
      if (session?.steal?.ink === undefined) return { result: undefined };
      const wiped = wipeInk(session, amount);
      return { session: wiped, result: toGameView(wiped.game, { session: wiped, now: this.clock.now() }) };
    });
  }
}
