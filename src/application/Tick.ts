import { ATTACK_DELAY_SPREAD_MS, Attack, LANE_COUNT, isAttackDue, scheduleAttackAt, windUp } from '../domain/attack';
import { timeUp } from '../domain/game';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView } from './views';

const MIN_TIME_LEFT_MS = 0;

export type TickResponse =
  | { readonly kind: 'ticked'; readonly view: GameView; readonly timeLeftMs: number; readonly attack?: Attack }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface Tick {
  execute(): TickResponse;
}

export class TickImpl implements Tick {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(): TickResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    const now = this.clock.now();
    const timeLeftMs = Math.max(MIN_TIME_LEFT_MS, session.endsAt - now);
    const game = timeLeftMs === MIN_TIME_LEFT_MS ? timeUp(session.game) : session.game;
    const attackAt = session.attackAt ?? scheduleAttackAt(now, this.random.nextInt(ATTACK_DELAY_SPREAD_MS));
    const attack = isAttackDue(attackAt, now) ? windUp(this.random.nextInt(LANE_COUNT)) : undefined;
    this.repository.save({ ...session, game, attackAt });
    return { kind: 'ticked', view: toGameView(game), timeLeftMs, attack };
  }
}
