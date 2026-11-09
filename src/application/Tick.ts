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
import { Game, explode, penalise, punch, timeUp } from '../domain/game';
import { isDistracted } from '../domain/guardian';
import {
  ITEM_DELAY_SPREAD_MS,
  ITEM_KINDS,
  ITEM_SPOT_SPAN,
  Item,
  appear,
  isBombLeft,
  isItemGone,
  isItemShown,
  scheduleItemAt,
} from '../domain/items';
import { toGameView } from './GameMapper';
import { PEEK_COOLDOWN_MS } from '../domain/peek';
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
      readonly landed?: 'hit' | 'blocked';
      readonly exploded?: true;
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
    const caughtPeeking = this.isCaughtPeeking(session, now);
    const landedGame = this.afterLanding(timedGame, landing);
    const caughtGame = caughtPeeking ? penalise(landedGame) : landedGame;
    const exploded = session.itemAt !== undefined && isBombLeft(session.item, session.itemAt, now);
    const game = exploded ? explode(caughtGame) : caughtGame;
    const pegUp = caughtPeeking ? undefined : session.pegUp;
    const attackState = this.windUpIfDue(session, now, landing.pendingLandsAt);
    const itemState = this.itemOnShow(session, now);
    this.repository.save({
      ...session,
      ...attackState.stored,
      ...itemState,
      game,
      pegUp,
      peekReadyAt: caughtPeeking ? now + PEEK_COOLDOWN_MS : session.peekReadyAt,
      charmed: landing.charmed,
      attackIsPunch: landing.pendingIsPunch,
    });
    return {
      kind: 'ticked',
      view: { ...toGameView(game), pegUp, playerBlind: session.playerBlind },
      timeLeftMs,
      attack: attackState.attack,
      item: itemState.item,
      landed: this.reported(landing),
      exploded: exploded ? true : undefined,
    };
  }

  private isCaughtPeeking(session: Session, now: number): boolean {
    return session.pegUp !== undefined && !isDistracted(session.guardian, now);
  }

  private itemOnShow(session: Session, now: number) {
    const itemAt = this.itemAtFor(session, now);
    const item = isItemShown(itemAt, now) ? (session.item ?? this.showItem()) : undefined;
    return { itemAt, item, itemCollected: false };
  }

  private itemAtFor(session: Session, now: number): number {
    const scheduled = session.itemAt;
    return scheduled === undefined || session.itemCollected || isItemGone(scheduled, now)
      ? scheduleItemAt(now, this.itemRandom.nextInt(ITEM_DELAY_SPREAD_MS))
      : scheduled;
  }

  private showItem(): Item {
    return appear(
      this.itemRandom.nextInt(ITEM_KINDS.length),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
    );
  }

  private afterLanding(game: Game, landing: { readonly hits: boolean; readonly isPunch: boolean }): Game {
    if (!landing.hits) {
      return game;
    }
    return landing.isPunch ? punch(game) : penalise(game);
  }

  private reported(landing: { readonly hits: boolean; readonly blocked: boolean }): 'hit' | 'blocked' | undefined {
    if (landing.hits) {
      return 'hit';
    }
    return landing.blocked ? 'blocked' : undefined;
  }

  private landing(session: Session, now: number) {
    const landed = session.attackLandsAt !== undefined && hasLanded(session.attackLandsAt, now);
    const blocked = landed && (isBlocked(session.attackLane, session.shieldLane) || session.charmed === true);
    return {
      blocked,
      hits: landed && !blocked,
      isPunch: session.attackIsPunch === true,
      pendingIsPunch: landed ? undefined : session.attackIsPunch,
      pendingLandsAt: landed ? undefined : session.attackLandsAt,
      charmed: session.charmed === true && !landed,
    };
  }

  private windUpIfDue(session: Session, now: number, pendingLandsAt: number | undefined) {
    const attackAt = session.attackAt ?? scheduleAttackAt(now, this.random.nextInt(ATTACK_DELAY_SPREAD_MS));
    const due =
      pendingLandsAt === undefined && isAttackDue(attackAt, now) && !isDistracted(session.guardian, now);
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
