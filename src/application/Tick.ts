import {
  ATTACK_DELAY_SPREAD_MS,
  Attack,
  THROW_DRAW_SPAN,
  hasLanded,
  isAttackDue,
  isBlocked,
  scheduleAttackAt,
  windUp,
} from '../domain/attack';
import { Game, explode, isOver, penalise, punch, timeUp } from '../domain/game';
import { guardianTaunts, scheduleGuardianTaunt } from './actions';
import { isDistracted } from '../domain/guardian';
import {
  ITEM_DELAY_SPREAD_MS,
  ITEM_KINDS,
  ITEM_SPOT_SPAN,
  MATCH_ITEM_KINDS,
  Item,
  appear,
  isBombLeft,
  isInDarkness,
  isItemGone,
  isItemShown,
  scheduleItemAt,
} from '../domain/items';
import { EMPTY_DRAFT, stealOne } from '../domain/draft';
import { toGameView } from './GameMapper';
import { emptied } from '../domain/actionBar';
import { Clock, RandomSource, Session } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

const MIN_TIME_LEFT_MS = 0;

export type TickResponse =
  | {
      readonly kind: 'ticked';
      readonly view: GameView;
      readonly timeLeftMs: number;
      readonly attack?: Attack;
      readonly item?: Item;
      readonly landed?: 'hit' | 'blocked' | 'stolen';
      readonly exploded?: true;
    }
  | { readonly kind: 'rejected'; readonly reason: 'no-game' };

export interface Tick {
  execute(): Promise<TickResponse>;
}

export class TickImpl implements Tick {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
    private readonly itemRandom: RandomSource,
    /** Round 15 (AC6): the guardian's taunts in solo; none without it (the older tests' sequences stay as they were). */
    private readonly duelRandom?: RandomSource,
  ) {}

  execute(): Promise<TickResponse> {
    return this.work.run<TickResponse>((session) => (session === undefined ? { result: { kind: 'rejected', reason: 'no-game' } } : this.passTime(session)));
  }

  private passTime(session: Session): { readonly session: Session; readonly result: TickResponse } {
    const now = this.clock.now();
    const timeLeftMs = Math.max(MIN_TIME_LEFT_MS, session.endsAt - now);
    // "steal the sauce" ends the match itself (settleSteal): time never takes the life
    const timedGame = timeLeftMs === MIN_TIME_LEFT_MS && session.steal === undefined ? timeUp(session.game) : session.game;
    const landing = this.landing(session, now);
    const caughtPeeking = this.isCaughtPeeking(session, now);
    const landedGame = this.afterLanding(timedGame, landing);
    const caughtGame = caughtPeeking ? penalise(landedGame) : landedGame;
    const exploded = session.itemAt !== undefined && isBombLeft(session.item, session.itemAt, now);
    const game = exploded ? explode(caughtGame) : caughtGame;
    const pegUp = caughtPeeking ? undefined : session.pegUp;
    const attackState = this.windUpIfDue(session, now, landing.pendingLandsAt);
    const itemState = this.itemOnShow(session, now);
    const stored: Session = {
      ...this.guardianTaunt(session, now),
      ...attackState.stored,
      ...itemState,
      game,
      pegUp,
      peekReadyAt: caughtPeeking ? emptied(now) : session.peekReadyAt,
      charmed: landing.charmed,
      attackIsPunch: landing.pendingIsPunch,
      attackIsFork: attackState.isFork ?? landing.pendingIsFork,
      draft: landing.forkHits ? stealOne(session.draft ?? EMPTY_DRAFT, (count) => this.random.nextInt(count)) : session.draft,
    };
    const result: TickResponse = {
      kind: 'ticked',
      view: { ...toGameView(game, { session: stored, now }), pegUp, playerBlind: isInDarkness(session.darkUntil, now) },
      timeLeftMs,
      attack: attackState.attack,
      item: itemState.item,
      landed: landing.forkHits ? 'stolen' : this.reported(landing),
      exploded: exploded ? true : undefined,
    };
    return { session: stored, result };
  }

  /** AC6: in solo the guardian taunts every 40 to 70 s, when the table is free. */
  private guardianTaunt(session: Session, now: number): Session {
    const random = this.duelRandom;
    if (random === undefined || session.steal !== undefined || isOver(session.game)) return session;
    const draw = (count: number) => random.nextInt(count);
    if (session.guardianTauntAt === undefined) return { ...session, guardianTauntAt: scheduleGuardianTaunt(now, draw) };
    if (now < session.guardianTauntAt || session.duel !== undefined || session.shell !== undefined) return session;
    return { ...guardianTaunts(session, now, draw), guardianTauntAt: scheduleGuardianTaunt(now, draw) };
  }

  private isCaughtPeeking(session: Session, now: number): boolean {
    return session.pegUp !== undefined && !isDistracted(session.guardian, now);
  }

  private itemOnShow(session: Session, now: number) {
    const itemAt = this.itemAtFor(session, now);
    const item = isItemShown(itemAt, now) ? (session.item ?? this.showItem(session.steal !== undefined)) : undefined;
    return { itemAt, item, itemCollected: false };
  }

  private itemAtFor(session: Session, now: number): number {
    const scheduled = session.itemAt;
    return scheduled === undefined || session.itemCollected || isItemGone(scheduled, now)
      ? scheduleItemAt(now, this.itemRandom.nextInt(ITEM_DELAY_SPREAD_MS))
      : scheduled;
  }

  private showItem(inMatch: boolean): Item {
    const kinds = inMatch ? MATCH_ITEM_KINDS : ITEM_KINDS;
    return appear(
      this.itemRandom.nextInt(kinds.length),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
      this.itemRandom.nextInt(ITEM_SPOT_SPAN),
      kinds,
    );
  }

  private afterLanding(game: Game, landing: { readonly hits: boolean; readonly isPunch: boolean; readonly forkHits: boolean }): Game {
    if (!landing.hits || landing.forkHits) {
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
      forkHits: landed && !blocked && session.attackIsFork === true,
      pendingIsPunch: landed ? undefined : session.attackIsPunch,
      pendingIsFork: landed ? undefined : session.attackIsFork,
      pendingLandsAt: landed ? undefined : session.attackLandsAt,
      charmed: session.charmed === true && !landed,
    };
  }

  private windUpIfDue(session: Session, now: number, pendingLandsAt: number | undefined) {
    const attackAt = session.attackAt ?? scheduleAttackAt(now, this.random.nextInt(ATTACK_DELAY_SPREAD_MS));
    const due =
      pendingLandsAt === undefined && isAttackDue(attackAt, now) && !isDistracted(session.guardian, now);
    if (!due) {
      return { attack: undefined, isFork: undefined, stored: { attackAt, attackLandsAt: pendingLandsAt } };
    }
    const attack = windUp(this.random.nextInt(THROW_DRAW_SPAN));
    return {
      attack,
      isFork: attack.fork === true,
      stored: { attackAt: undefined, attackLandsAt: now + attack.landsInMs, attackLane: attack.lane },
    };
  }
}
