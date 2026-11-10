import { isOver } from '../domain/game';
import { Draw, Round } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView } from './views';

export type ActionResponse =
  | { readonly kind: 'done'; readonly view: GameView }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' | 'game-over' | 'gone' };

/**
 * Shared steps of the small round actions (row edits, items, shield, time):
 * load, refuse when there is no game or it is over, apply, save, answer with the view.
 * The change returns undefined when its target is gone (an item that expired).
 */
export class RoundAction {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  run(change: (round: Round, now: number, draw: Draw) => Round | undefined): ActionResponse {
    const session = this.repository.load();
    if (session === undefined) return { kind: 'rejected', reason: 'no-game' };
    const now = this.clock.now();
    if (isOver(session.game)) return { kind: 'rejected', reason: 'game-over' };
    const changed = change(session, now, (max) => this.random.nextInt(max));
    if (changed === undefined) return { kind: 'rejected', reason: 'gone' };
    this.repository.save(changed);
    return { kind: 'done', view: toGameView(changed, now) };
  }
}
