import { Draw, Round, isRoundOver } from '../domain/round';
import { settle } from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export type ActionResponse =
  | { readonly kind: 'done'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'gone' };

/**
 * Shared steps of the small round actions (row edits, items, shield, time):
 * refuse when there is no game or it is over, apply, settle the match rules,
 * answer with the view. The change returns undefined when its target is gone
 * (an item that expired).
 */
export class RoundAction {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  run(change: (round: Round, now: number, draw: Draw) => Round | undefined): Promise<ActionResponse> {
    return this.work.run<ActionResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      if (isRoundOver(session)) return { result: { kind: 'rejected', reason: 'game-over' } };
      const now = this.clock.now();
      const changed = change(session, now, (max) => this.random.nextInt(max));
      if (changed === undefined) return { result: { kind: 'rejected', reason: 'gone' } };
      const settled = settle(changed, now);
      return { session: settled, result: { kind: 'done', view: toGameView(settled, now) } };
    });
  }
}
