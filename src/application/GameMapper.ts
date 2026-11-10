import { Game, MAX_LIFE, isCracked, isLost, isOver, isWon } from '../domain/game';
import { NOTICE_MS, Round } from '../domain/round';
import { GameStatus, GameView } from './views';

function toStatus(game: Game): GameStatus {
  if (isWon(game)) return 'won';
  return isLost(game) ? 'lost' : 'playing';
}

function lostBy(game: Game): 'life' | 'time' | 'beaten' {
  if (game.beaten) return 'beaten';
  return game.outOfTime ? 'time' : 'life';
}

const nameOf = (round: Round, id: string | undefined) => round.race?.rivals.find((rival) => rival.id === id)?.name;

const remaining = (until: number, now: number) => Math.max(0, until - now);

export function toGameView(round: Round, now: number): GameView {
  const { game, xray, attack, notice } = round;
  const playing = !isOver(game);
  return {
    status: toStatus(game),
    lostBy: isLost(game) ? lostBy(game) : undefined,
    lastStanding: game.lastStanding && !isCracked(game),
    life: game.life,
    maxLife: MAX_LIFE,
    secret: playing ? undefined : game.secret,
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
