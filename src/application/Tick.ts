import { ATTACK_DELAY_SPREAD_MS, Attack, LANE_COUNT, hasLanded, isAttackDue, isBlocked, scheduleAttackAt, windUp } from '../domain/attack';
import { penalise, timeUp } from '../domain/game';
import { isDistracted } from '../domain/guardian';
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
    const timedGame = timeLeftMs === MIN_TIME_LEFT_MS ? timeUp(session.game) : session.game;
    const attackLanded = session.attackLandsAt !== undefined && hasLanded(session.attackLandsAt, now);
    const attackHits = attackLanded && !isBlocked(session.attackLane, session.shieldLane);
    const game = attackHits ? penalise(timedGame) : timedGame;
    const attackAt = session.attackAt ?? scheduleAttackAt(now, this.random.nextInt(ATTACK_DELAY_SPREAD_MS));
    const attackDue = isAttackDue(attackAt, now) && !isDistracted(session.guardian, now);
    const attack = attackDue ? windUp(this.random.nextInt(LANE_COUNT)) : undefined;
    const nextAttackAt = attack === undefined ? attackAt : undefined;
    const pendingLandsAt = attackLanded ? undefined : session.attackLandsAt;
    const attackLandsAt = attack === undefined ? pendingLandsAt : now + attack.landsInMs;
    const attackLane = attack === undefined ? session.attackLane : attack.lane;
    this.repository.save({ ...session, game, attackAt: nextAttackAt, attackLandsAt, attackLane });
    return { kind: 'ticked', view: toGameView(game), timeLeftMs, attack };
  }
}
