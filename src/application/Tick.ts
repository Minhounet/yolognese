import {
  ATTACK_DELAY_SPREAD_MS,
  Attack,
  LANE_COUNT,
  hasLanded,
  isAttackDue,
  isBlocked,
  scheduleAttackAt,
  windUp,
} from '../domain/attack';
import { penalise, timeUp } from '../domain/game';
import { isDistracted } from '../domain/guardian';
import {
  ITEM_DELAY_SPREAD_MS,
  ITEM_KINDS,
  ITEM_SPOT_SPAN,
  Item,
  appear,
  isItemShown,
  scheduleItemAt,
} from '../domain/items';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource, Session } from './ports';
import { GameView } from './views';

const MIN_TIME_LEFT_MS = 0;

export type TickResponse =
  | {
      readonly kind: 'ticked';
      readonly view: GameView;
      readonly timeLeftMs: number;
      readonly attack?: Attack;
      readonly item?: Item;
    }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface Tick {
  execute(): TickResponse;
}

export class TickImpl implements Tick {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly itemRandom: RandomSource,
  ) {}

  execute(): TickResponse {
    const session = this.repository.load();
    if (session === undefined) {
      return { kind: 'rejected', reason: 'no-game' };
    }
    const now = this.clock.now();
    const timeLeftMs = Math.max(MIN_TIME_LEFT_MS, session.endsAt - now);
    const timedGame = timeLeftMs === MIN_TIME_LEFT_MS ? timeUp(session.game) : session.game;
    const landing = this.landing(session, now);
    const game = landing.hits ? penalise(timedGame) : timedGame;
    const attackState = this.windUpIfDue(session, now, landing.pendingLandsAt);
    const itemAt = session.itemAt ?? scheduleItemAt(now, this.itemRandom.nextInt(ITEM_DELAY_SPREAD_MS));
    const item = isItemShown(itemAt, now) ? this.showItem() : undefined;
    this.repository.save({ ...session, ...attackState.stored, itemAt, game });
    return { kind: 'ticked', view: toGameView(game), timeLeftMs, attack: attackState.attack, item };
  }

  private showItem(): Item {
    return appear(
      this.itemRandom.nextInt(ITEM_KINDS.length),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
    );
  }

  private landing(session: Session, now: number) {
    const landed = session.attackLandsAt !== undefined && hasLanded(session.attackLandsAt, now);
    return {
      hits: landed && !isBlocked(session.attackLane, session.shieldLane),
      pendingLandsAt: landed ? undefined : session.attackLandsAt,
    };
  }

  private windUpIfDue(session: Session, now: number, pendingLandsAt: number | undefined) {
    const attackAt = session.attackAt ?? scheduleAttackAt(now, this.random.nextInt(ATTACK_DELAY_SPREAD_MS));
    const due = isAttackDue(attackAt, now) && !isDistracted(session.guardian, now);
    if (!due) {
      return { attack: undefined, stored: { attackAt, attackLandsAt: pendingLandsAt } };
    }
    const attack = windUp(this.random.nextInt(LANE_COUNT));
    return {
      attack,
      stored: { attackAt: undefined, attackLandsAt: now + attack.landsInMs, attackLane: attack.lane },
    };
  }
}
