import { ACTION_COSTS, Action, CHARGE_MS, canAfford, spend } from '../domain/actionBar';
import { COLORS } from '../domain/color';
import {
  ANSWER_MS,
  DIZZY_MS,
  DuelOutcome,
  FLIP_MS,
  GUARDIAN_ANSWER_MIN_MS,
  GUARDIAN_ANSWER_SPREAD_MS,
  GUARDIAN_ODDS,
  GUARDIAN_PENALTIES,
  GUARDIAN_TAUNT_MIN_MS,
  GUARDIAN_TAUNT_SPREAD_MS,
  INSULTS_OFFERED,
  INSULT_COUNT,
  LIFE_GIVEN,
  PEG_SHOWN_MS,
  PLAYER_PENALTIES,
  Penalty,
  SCRAMBLE_MS,
  comebacksFor,
  drawDistinct,
  drawPenalty,
  drawScramble,
  isRightComeback,
  seededDraw,
} from '../domain/duel';
import { MAX_LIFE, hiddenPegs, isOver, restoreLife } from '../domain/game';
import { distract } from '../domain/guardian';
import { RESULT_SHOWN_MS, canPick, closesAt, isFound, openShellGame } from '../domain/shellGame';
import { ask, targetOf } from '../domain/steal';
import { Duel, Session, Stakes } from './ports';

export const GUARDIAN = 'guardian';
/** How long a duel's verdict stays on screen (as long as the K.O., AC1). */
export const DUEL_RESULT_MS = 2500;
/** A match: the taunter waits this long past the answer time for the server's verdict, then asks for it. */
const VERDICT_GRACE_MS = 1500;
/** ... and gives up on it after this much more (the server never answered). */
const VERDICT_GIVE_UP_MS = 6000;
const DUELS_REMEMBERED = 10;
const VERDICT_RETRY_MS = 1000;

type Draw = (count: number) => number;

const isPlaying = (session: Session) => (session.steal !== undefined ? !session.steal.finished : !isOver(session.game));

/** AC2: whether this action can be paid now (the screen greys a button out otherwise). */
export function canUse(session: Session, action: Action, now: number): boolean {
  return canAfford(session.peekReadyAt, now, ACTION_COSTS[action]);
}

const pay = (session: Session, action: Action, now: number): Session => ({ ...session, peekReadyAt: spend(session.peekReadyAt, now, ACTION_COSTS[action]) });

/** One thing on the table at a time: a shell game or a duel. */
const isBusy = (session: Session) => session.shell !== undefined || session.duel !== undefined;

// ---------- AC3: the shell game ----------

export type ShellRefusal = 'not-enough' | 'busy' | 'game-over';

export function openShell(session: Session, now: number, draw: Draw): Session | ShellRefusal {
  if (!isPlaying(session)) return 'game-over';
  if (isBusy(session)) return 'busy';
  if (!canUse(session, 'shell', now)) return 'not-enough';
  return { ...pay(session, 'shell', now), shell: openShellGame(now, draw) };
}

/** The player taps the cup at `place`: the 🍝 refills life. Too early, too late or already picked: unchanged. */
export function pickCup(session: Session, place: number, now: number): Session {
  const { shell } = session;
  if (shell === undefined || !canPick(shell, now)) return session;
  const picked = { ...shell, picked: place, endedAt: now };
  return { ...session, shell: picked, game: isFound(picked) ? restoreLife(session.game) : session.game };
}

// ---------- AC4: the taunt ----------

export type TauntRefusal = 'not-enough' | 'busy' | 'game-over';

export function openTaunt(session: Session, now: number, draw: Draw): Session | TauntRefusal {
  if (!isPlaying(session)) return 'game-over';
  if (isBusy(session)) return 'busy';
  if (!canUse(session, 'taunt', now)) return 'not-enough';
  return { ...pay(session, 'taunt', now), duel: { phase: 'choosing', offered: drawDistinct(INSULTS_OFFERED, INSULT_COUNT, draw) } };
}

function drawStakes(session: Session, draw: Draw): Stakes {
  const hidden = hiddenPegs(session.game);
  const ifWon = drawPenalty(GUARDIAN_PENALTIES, draw);
  const ifLost = drawPenalty(PLAYER_PENALTIES, draw);
  return {
    ifWon,
    ifLost,
    pegIndex: hidden.length > 0 ? hidden[draw(hidden.length)] : draw(4),
    scrambleShift: drawScramble(COLORS.length, draw)[0],
  };
}

/** The taunter says one of the insults offered: to the guardian (solo), or to its target through the server. */
export function sayInsult(session: Session, insult: number, now: number, draw: Draw): Session {
  const { duel } = session;
  if (duel?.phase !== 'choosing' || !duel.offered.includes(insult)) return session;
  if (session.steal !== undefined) {
    const steal = ask(session.steal, { type: 'taunt', insult });
    const opponent = targetOf(session.steal).id;
    return { ...session, steal, duel: { phase: 'waiting', insult, opponent, until: now + ANSWER_MS + VERDICT_GRACE_MS } };
  }
  const right = draw(GUARDIAN_ODDS) === 0;
  const comeback = right ? insult : (insult + 1 + draw(INSULT_COUNT - 1)) % INSULT_COUNT;
  const at = now + GUARDIAN_ANSWER_MIN_MS + draw(GUARDIAN_ANSWER_SPREAD_MS);
  const stakes = drawStakes(session, draw);
  return { ...session, duel: { phase: 'waiting', insult, opponent: GUARDIAN, until: at, guardian: { at, comeback, stakes } } };
}

/** AC6: the guardian taunts the player (solo); the comebacks and the stakes are drawn now. */
export function guardianTaunts(session: Session, now: number, draw: Draw): Session {
  const insult = draw(INSULT_COUNT);
  const choices = comebacksFor(insult, draw);
  const stakes = drawStakes(session, draw);
  return { ...session, duel: { phase: 'answering', insult, from: GUARDIAN, choices, until: now + ANSWER_MS, stakes } };
}

export function scheduleGuardianTaunt(now: number, draw: Draw): number {
  return now + GUARDIAN_TAUNT_MIN_MS + draw(GUARDIAN_TAUNT_SPREAD_MS);
}

/** The taunted picks a comeback: solo, the verdict at once; a match, the comeback goes to the server. */
export function answerTaunt(session: Session, comeback: number, now: number): Session {
  const { duel } = session;
  if (duel?.phase !== 'answering' || duel.answered !== undefined || now >= duel.until || !duel.choices.includes(comeback)) return session;
  if (duel.from === GUARDIAN && duel.stakes !== undefined) {
    const won = isRightComeback(duel.insult, comeback);
    return settleDuel(session, { won, penalty: won ? duel.stakes.ifWon : duel.stakes.ifLost, opponent: GUARDIAN, stakes: duel.stakes }, now);
  }
  if (session.steal === undefined || duel.id === undefined) return session;
  return { ...session, steal: ask(session.steal, { type: 'retort', id: duel.id, comeback }), duel: { ...duel, answered: comeback } };
}

// ---------- AC5: the verdict and its penalty ----------

interface Verdict {
  readonly won: boolean;
  readonly penalty: Penalty;
  readonly opponent: string;
  readonly stakes?: Stakes;
  /** A match: the duel's id (applied once), and the peg shown to a winner of 🔍. */
  readonly id?: string;
  readonly peg?: DuelOutcome['peg'];
}

/** Applies the verdict to this player: the penalty it suffers, or what it wins; the duel closes. */
export function settleDuel(session: Session, verdict: Verdict, now: number): Session {
  const { won, penalty, opponent, stakes, id } = verdict;
  const done = id === undefined ? session.duelsDone : [...(session.duelsDone ?? []), id].slice(-DUELS_REMEMBERED);
  const closed: Session = { ...session, duel: undefined, duelsDone: done, duelResult: { won, penalty, opponent, at: now } };
  return won ? winnerGets(closed, verdict, now) : loserSuffers(closed, penalty, now, stakes?.scrambleShift ?? shiftFor(id));
}

const shiftFor = (id: string | undefined) => drawScramble(COLORS.length, seededDraw(id ?? 'duel'))[0];

function winnerGets(session: Session, { penalty, stakes, peg }: Verdict, now: number): Session {
  switch (penalty) {
    case 'life':
      return { ...session, game: { ...session.game, life: Math.min(MAX_LIFE, session.game.life + LIFE_GIVEN) } };
    case 'dizzy':
      return { ...session, guardian: distract(session.guardian, now, now + DIZZY_MS) };
    case 'peg':
      if (peg !== undefined) return { ...session, xray: { index: peg.index, color: peg.color, until: now + PEG_SHOWN_MS } };
      return stakes === undefined ? session : { ...session, xray: { index: stakes.pegIndex, until: now + PEG_SHOWN_MS } };
    default:
      return session; // the palette and the screen are the loser's
  }
}

function loserSuffers(session: Session, penalty: Penalty, now: number, shift: number): Session {
  switch (penalty) {
    case 'life':
      return { ...session, game: { ...session.game, life: Math.max(0, session.game.life - LIFE_GIVEN) } };
    case 'scramble':
      return { ...session, scramble: { until: now + SCRAMBLE_MS, map: COLORS.map((_, index) => (index + shift) % COLORS.length) } };
    case 'flip':
      return { ...session, flippedUntil: now + FLIP_MS };
    default:
      return session; // a shown peg is the winner's; dizziness is the guardian's
  }
}

/** The colour actually placed when colour `index` is tapped: the palette may lie (AC5). */
export function placedColor(session: Session, index: number, now: number): number {
  const { scramble } = session;
  return scramble !== undefined && now < scramble.until ? scramble.map[index] : index;
}

// ---------- a match: what the room and the server say ----------

/** Someone taunted: this player is the target (it answers), or the taunter (its duel learns its id). */
export function hearTaunt(session: Session, event: { readonly id: string; readonly from: string; readonly target: string; readonly insult: number }, now: number): Session {
  const me = session.steal?.me;
  if (me === undefined || session.duelsDone?.includes(event.id)) return session;
  if (event.from === me && session.duel?.phase === 'waiting' && session.duel.id === undefined) {
    // the server's target: the circle may have turned while the taunt was on its way
    return { ...session, duel: { ...session.duel, id: event.id, opponent: event.target } };
  }
  if (event.target !== me || session.duel?.phase === 'answering') return session;
  const choices = comebacksFor(event.insult, seededDraw(event.id));
  // a taunt cuts in: an unfinished shell game or insult choice is dropped
  return { ...session, shell: undefined, duel: { phase: 'answering', id: event.id, insult: event.insult, from: event.from, choices, until: now + ANSWER_MS } };
}

/** The server's verdict, from the room or in an answer: applied once; a winner of 🔍 then asks for its peg. */
export function hearVerdict(session: Session, outcome: DuelOutcome, now: number): Session {
  const me = session.steal?.me;
  if (me === undefined || (outcome.taunter !== me && outcome.target !== me)) return session;
  const won = outcome.winner === me;
  if (session.duelsDone?.includes(outcome.id)) {
    // the peg can come after the verdict (the answer to taunt-result)
    return won && outcome.peg !== undefined ? winnerGets(session, { won, penalty: 'peg', opponent: '', peg: outcome.peg }, now) : session;
  }
  const opponent = outcome.taunter === me ? outcome.target : outcome.taunter;
  const settled = settleDuel(session, { won, penalty: outcome.penalty, opponent, id: outcome.id, peg: outcome.peg }, now);
  if (!won || outcome.penalty !== 'peg' || outcome.peg !== undefined || settled.steal === undefined) return settled;
  return { ...settled, steal: ask(settled.steal, { type: 'taunt-result', id: outcome.id }) };
}

/** The server refused the taunt (too fast, or the target is in another duel): the charges come back. */
export function tauntRefused(session: Session): Session {
  if (session.duel?.phase !== 'waiting' || session.duel.id !== undefined) return session;
  return { ...session, duel: undefined, peekReadyAt: session.peekReadyAt - ACTION_COSTS.taunt * CHARGE_MS };
}

/** The server said the duel is still open (this phone's clock ran ahead of its deadline): ask again a second later. */
export function verdictPending(session: Session, id: string, now: number): Session {
  const { duel } = session;
  if (duel === undefined || duel.phase === 'choosing' || duel.id !== id) return session;
  return { ...session, duel: { ...duel, asked: false, until: Math.max(duel.until, now + VERDICT_RETRY_MS) } };
}

export function tauntSent(session: Session, id: string): Session {
  const { duel } = session;
  return duel?.phase === 'waiting' && duel.id === undefined ? { ...session, duel: { ...duel, id } } : session;
}

// ---------- the rules time applies (SessionWork's settle) ----------

/** Shell games and duels that time ends; the guardian's answer when due; the verdict asked for when late. */
export function settleActions(session: Session, now: number): Session {
  return settleDuelTime(settleShellTime(session, now), now);
}

function settleShellTime(session: Session, now: number): Session {
  const { shell } = session;
  if (shell === undefined) return session;
  const endedAt = shell.endedAt ?? (now >= closesAt(shell) ? closesAt(shell) : undefined);
  if (endedAt === undefined) return session;
  if (now >= endedAt + RESULT_SHOWN_MS) return { ...session, shell: undefined };
  return shell.endedAt === undefined ? { ...session, shell: { ...shell, endedAt } } : session;
}

function settleDuelTime(session: Session, now: number): Session {
  const { duel } = session;
  if (duel === undefined || duel.phase === 'choosing') return session;
  if (duel.phase === 'waiting' && duel.guardian !== undefined) {
    if (now < duel.guardian.at) return session;
    const won = !isRightComeback(duel.insult, duel.guardian.comeback);
    const { stakes } = duel.guardian;
    return settleDuel(session, { won, penalty: won ? stakes.ifWon : stakes.ifLost, opponent: GUARDIAN, stakes }, now);
  }
  if (duel.phase === 'answering' && duel.from === GUARDIAN && duel.stakes !== undefined) {
    if (now < duel.until) return session;
    return settleDuel(session, { won: false, penalty: duel.stakes.ifLost, opponent: GUARDIAN, stakes: duel.stakes }, now);
  }
  return settleMatchDuelTime(session, duel, now);
}

/** A match: past the answer time, either side asks the server for the verdict once; it gives up later. */
function settleMatchDuelTime(session: Session, duel: Exclude<Duel, { phase: 'choosing' }>, now: number): Session {
  const { steal } = session;
  if (steal === undefined || now < duel.until) return session;
  if (now >= duel.until + VERDICT_GIVE_UP_MS) return { ...session, duel: undefined };
  if (duel.asked === true || duel.id === undefined) return session;
  return { ...session, steal: ask(steal, { type: 'taunt-result', id: duel.id }), duel: { ...duel, asked: true } };
}

/** What the screen shows of a duel's verdict, while it is fresh. */
export function freshResult(session: Pick<Session, 'duelResult'>, now: number) {
  const result = session.duelResult;
  return result !== undefined && now - result.at < DUEL_RESULT_MS ? result : undefined;
}
