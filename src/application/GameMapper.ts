import { Game, MAX_LIFE, isLost, isOver, isWon } from '../domain/game';
import { EMPTY_DRAFT } from '../domain/draft';
import { Steal, attackerOf, isTop, ranking, targetOf } from '../domain/steal';
import { Session } from './ports';
import { NOTICE_MS } from './stealMatch';
import { GameStatus, GameView, StealView } from './views';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

/** What a view needs from the session besides the game: the row being composed, the x-ray (AC32) and the time. */
export interface ViewContext {
  readonly session?: Pick<Session, 'draft' | 'xray' | 'steal' | 'endsAt'>;
  readonly now?: number;
}

function xrayed(game: Game, { session, now }: ViewContext): GameView['revealed'] {
  const xray = session?.xray;
  if (xray === undefined || now === undefined || now >= xray.until || isOver(game)) return [];
  const color = xray.color ?? game.secret?.[xray.index];
  return color === undefined ? [] : [{ index: xray.index, color }];
}

function toStealView(steal: Steal, now: number | undefined): StealView {
  const attacker = attackerOf(steal);
  const noticed = steal.notice !== undefined && now !== undefined && now - steal.notice.at < NOTICE_MS;
  return {
    target: targetOf(steal).name,
    attacker: attacker.name,
    threat: steal.pressure[attacker.id] ?? 0,
    mySecret: steal.mySauce,
    scores: ranking(steal).map(({ id, name, points }) => ({ name, points, me: id === steal.me })),
    switchInMs: steal.seats.length > 2 && now !== undefined ? Math.max(0, steal.nextSwitchAt - now) : undefined,
    finished: steal.finished,
    notice: noticed ? steal.notice?.kind : undefined,
    attempts: steal.attempts.map(({ by, guess, exact, misplaced }) => ({ by: nameOf(steal, by), guess, exact, misplaced })),
    ink: steal.ink === undefined ? undefined : { by: nameOf(steal, steal.ink.by), left: steal.ink.left },
  };
}

const nameOf = (steal: Steal, id: string) => steal.seats.find((seat) => seat.id === id)?.name ?? '?';

function stealStatus(steal: Steal): GameStatus {
  if (!steal.finished) return 'playing';
  return isTop(steal) ? 'won' : 'lost';
}

export function toGameView(game: Game, context: ViewContext = {}): GameView {
  const steal = context.session?.steal;
  return {
    status: steal === undefined ? toStatus(game) : stealStatus(steal),
    life: game.life,
    maxLife: MAX_LIFE,
    revealed: xrayed(game, context),
    draft: context.session?.draft ?? EMPTY_DRAFT,
    secret: steal === undefined && isOver(game) ? game.secret : undefined,
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
    steal: steal === undefined ? undefined : toStealView(steal, context.now),
    pendingGuess: steal?.guessing,
  };
}
