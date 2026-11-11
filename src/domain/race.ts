import { Code } from './color';
import { Game, bestExact, isCracked, isLost, isOver } from './game';
import { AttackKind, Draw, LANES } from './attack';

/** A player in a race, as everyone sees them. */
export interface Rival {
  readonly id: string;
  readonly name: string;
  readonly life: number;
  readonly bestExact: number;
  readonly out: boolean;
  readonly cracked: boolean;
}

/** What players tell each other through the room. */
export type RaceEvent =
  | { readonly type: 'start'; readonly secret: Code; readonly players: readonly { readonly id: string; readonly name: string }[] }
  | { readonly type: 'progress'; readonly from: string; readonly life: number; readonly bestExact: number }
  | { readonly type: 'attack'; readonly from: string; readonly to: string; readonly kind: AttackKind; readonly lane: number }
  | { readonly type: 'cracked'; readonly from: string }
  | { readonly type: 'out'; readonly from: string };

/** An attack a rival threw at this player, waiting to fly. */
export interface IncomingAttack {
  readonly kind: AttackKind;
  readonly lane: number;
  readonly from: string;
}

export interface Race {
  readonly me: string;
  readonly rivals: readonly Rival[];
  /** Events made by this player's actions, not yet sent. */
  readonly outbox: readonly RaceEvent[];
  /** What the room was last told about this player, to send only changes. */
  readonly told: { readonly life: number; readonly bestExact: number; readonly over: boolean };
  /** The rival who cracked the code first, when one did. */
  readonly beatenBy?: string;
}

export function newRace(me: string, players: readonly { readonly id: string; readonly name: string }[], life: number): Race {
  return {
    me,
    rivals: players
      .filter(({ id }) => id !== me)
      .map(({ id, name }) => ({ id, name, life, bestExact: 0, out: false, cracked: false })),
    outbox: [],
    told: { life, bestExact: 0, over: false },
  };
}

const inPlay = (race: Race) => race.rivals.filter((rival) => !rival.out && !rival.cracked);

/** The sabotage item: throws a meatball or a fork, in a random lane, at a random rival still playing. */
export function sabotage(race: Race, draw: Draw): Race {
  const targets = inPlay(race);
  if (targets.length === 0) return race;
  const to = targets[draw(targets.length)].id;
  const kind: AttackKind = draw(2) === 0 ? 'meatball' : 'fork';
  const attack: RaceEvent = { type: 'attack', from: race.me, to, kind, lane: draw(LANES) };
  return { ...race, outbox: [...race.outbox, attack] };
}

const updateRival = (race: Race, id: string, change: (rival: Rival) => Rival): Race => ({
  ...race,
  rivals: race.rivals.map((rival) => (rival.id === id ? change(rival) : rival)),
});

/** What this player must learn from a rival's event; `beaten` and `lastStanding` end its own game. */
export interface Heard {
  readonly race: Race;
  readonly beaten: boolean;
  readonly lastStanding: boolean;
  /** An attack a rival threw at this player. */
  readonly incoming?: IncomingAttack;
}

export function hear(race: Race, event: RaceEvent): Heard {
  const quiet = (changed: Race): Heard => ({ race: changed, beaten: false, lastStanding: false });
  if (event.type === 'start' || event.from === race.me) return quiet(race);
  switch (event.type) {
    case 'progress':
      return quiet(updateRival(race, event.from, (rival) => ({ ...rival, life: event.life, bestExact: event.bestExact })));
    case 'attack':
      if (event.to !== race.me) return quiet(race);
      return { ...quiet(race), incoming: { kind: event.kind, lane: event.lane, from: event.from } };
    case 'cracked': {
      const changed = updateRival(race, event.from, (rival) => ({ ...rival, cracked: true, bestExact: 4 }));
      return { race: { ...changed, beatenBy: changed.beatenBy ?? event.from }, beaten: true, lastStanding: false };
    }
    case 'out': {
      const changed = updateRival(race, event.from, (rival) => ({ ...rival, out: true }));
      return { race: changed, beaten: false, lastStanding: changed.rivals.every((rival) => rival.out) };
    }
  }
}

/** Takes the events to send now: the queued ones, plus this player's progress, crack or exit when they changed. */
export function takeOutbox(race: Race, game: Game): { readonly race: Race; readonly events: readonly RaceEvent[] } {
  const now = { life: game.life, bestExact: bestExact(game), over: isOver(game) };
  const events: RaceEvent[] = [...race.outbox];
  if (now.life !== race.told.life || now.bestExact !== race.told.bestExact) {
    events.push({ type: 'progress', from: race.me, life: now.life, bestExact: now.bestExact });
  }
  if (now.over && !race.told.over) {
    if (isCracked(game)) events.push({ type: 'cracked', from: race.me });
    else if (isLost(game)) events.push({ type: 'out', from: race.me });
  }
  return { race: { ...race, outbox: [], told: now }, events };
}
