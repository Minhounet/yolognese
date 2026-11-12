import { Game, MAX_LIFE, isLost, isOver, isWon } from '../domain/game';
import { EMPTY_DRAFT } from '../domain/draft';
import { Steal, attackerOf, isTop, ranking, targetOf } from '../domain/steal';
import { Duel, Session } from './ports';
import { noticeMs } from './stealMatch';
import { BarView, DuelView, GameStatus, GameView, ShellView, StealView } from './views';
import { ACTION_COSTS, canAfford, chargesAt, fullInMs } from '../domain/actionBar';
import { canPick, isFound, sauceAt } from '../domain/shellGame';
import { GUARDIAN, freshResult } from './actions';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

/** What a view needs from the session besides the game: the row being composed, the x-ray (AC32) and the time. */
export interface ViewContext {
  readonly session?: Pick<Session, 'draft' | 'xray' | 'steal' | 'endsAt'> &
    Partial<Pick<Session, 'peekReadyAt' | 'shell' | 'duel' | 'duelResult' | 'scramble' | 'flippedUntil'>>;
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
  const noticed = steal.notice !== undefined && now !== undefined && now - steal.notice.at < noticeMs(steal.notice.kind);
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
    ...actionViews(context),
  };
}

/** Round 15: the action bar, the shell game, the duel and its verdict, the penalties in force. */
function actionViews({ session, now }: ViewContext): Pick<GameView, 'bar' | 'shell' | 'duel' | 'duelResult' | 'scrambled' | 'flipped'> {
  if (session === undefined || now === undefined) return {};
  const nameOf = (id: string) => (id === GUARDIAN ? 'the guardian' : (session.steal?.seats.find((seat) => seat.id === id)?.name ?? '?'));
  const result = freshResult(session, now);
  return {
    bar: session.peekReadyAt === undefined ? undefined : toBar(session.peekReadyAt, now),
    shell: session.shell === undefined ? undefined : toShell(session.shell, now),
    duel: session.duel === undefined ? undefined : toDuel(session.duel, now, nameOf),
    duelResult: result === undefined ? undefined : { won: result.won, penalty: result.penalty, opponent: nameOf(result.opponent) },
    scrambled: session.scramble !== undefined && now < session.scramble.until ? true : undefined,
    flipped: session.flippedUntil !== undefined && now < session.flippedUntil ? true : undefined,
  };
}

function toBar(readyAt: number, now: number): BarView {
  return {
    charges: chargesAt(readyAt, now),
    fullInMs: fullInMs(readyAt, now),
    canShell: canAfford(readyAt, now, ACTION_COSTS.shell),
    canTaunt: canAfford(readyAt, now, ACTION_COSTS.taunt),
  };
}

function toShell(shell: NonNullable<Session['shell']>, now: number): ShellView {
  const over = shell.endedAt === undefined ? undefined : { picked: shell.picked, sauceAt: sauceAt(shell), found: isFound(shell) };
  return { start: shell.start, swaps: shell.swaps, elapsedMs: now - shell.openedAt, canPick: canPick(shell, now), over };
}

function toDuel(duel: Duel, now: number, nameOf: (id: string) => string): DuelView {
  if (duel.phase === 'choosing') return { phase: 'choosing', offered: duel.offered };
  if (duel.phase === 'waiting') return { phase: 'waiting', insult: duel.insult, opponent: nameOf(duel.opponent) };
  const { insult, from, choices, until, answered } = duel;
  return { phase: 'answering', insult, from: nameOf(from), choices, leftMs: Math.max(0, until - now), answered };
}
