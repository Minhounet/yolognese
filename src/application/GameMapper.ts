import { Game, MAX_LIFE, isCracked, isLost, isOver, isWon } from '../domain/game';
import { NOTICE_MS, Round } from '../domain/round';
import { Steal, attackerOf, isTop, ranking, targetOf } from '../domain/steal';
import { StealView } from './views';
import { GameStatus, GameView } from './views';

function toStealView(steal: Steal, now: number): StealView {
  const attacker = attackerOf(steal);
  return {
    target: targetOf(steal).name,
    attacker: attacker.name,
    threat: steal.pressure[attacker.id] ?? 0,
    mySecret: steal.secrets[steal.me],
    scores: ranking(steal).map(({ id, name, points }) => ({ name, points, me: id === steal.me })),
    switchInMs: steal.seats.length > 2 ? Math.max(0, steal.nextSwitchAt - now) : undefined,
    waiting: steal.waiting,
    finished: steal.finished,
  };
}

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

function lostBy(game: Game): 'life' | 'time' | 'beaten' {
  if (game.beaten) return 'beaten';
  return game.outOfTime ? 'time' : 'life';
}

const nameOf = (round: Round, id: string | undefined) =>
  [...(round.race?.rivals ?? []), ...(round.steal?.seats ?? [])].find((player) => player.id === id)?.name;

const remaining = (until: number, now: number) => Math.max(0, until - now);

export function toGameView(round: Round, now: number): GameView {
  const { game, xray, attack, notice, steal } = round;
  const playing = !isOver(game) && steal?.finished !== true;
  const status: GameStatus = steal === undefined ? toStatus(game) : steal.finished ? (isTop(steal) ? 'won' : 'lost') : 'playing';
  return {
    status,
    lostBy: steal === undefined && isLost(game) ? lostBy(game) : undefined,
    lastStanding: game.lastStanding && !isCracked(game),
    life: game.life,
    maxLife: MAX_LIFE,
    secret: playing ? undefined : game.secret,
    steal: steal === undefined ? undefined : toStealView(steal, now),
    turns: game.turns.map(({ guess, exact, misplaced }) => ({ guess, exact, misplaced })),
    draft: round.draft,
    timeLeftMs: remaining(round.endsAt, now),
    cooldownMs: remaining(round.peekReadyAt, now),
    blindMs: remaining(round.guardian.blindUntil, now),
    xray: playing && xray !== undefined && now < xray.until ? { index: xray.index, color: game.secret[xray.index] } : undefined,
    items: playing ? round.items.filter((item) => now < item.until).map(({ id, kind, x, y }) => ({ id, kind, x, y })) : [],
    attack:
      playing && attack !== undefined
        ? { kind: attack.kind, lane: attack.lane, msToLand: remaining(attack.landsAt, now), fromName: nameOf(round, attack.from) }
        : undefined,
    shieldLane: round.shieldLane,
    charm: round.charm,
    notice: notice !== undefined && now - notice.at < NOTICE_MS ? notice.kind : undefined,
    race:
      round.race === undefined
        ? undefined
        : {
            rivals: round.race.rivals.map(({ name, life, bestExact, out, cracked }) => ({ name, life, bestExact, out, cracked })),
            beatenBy: nameOf(round, round.race.beatenBy),
          },
  };
}
