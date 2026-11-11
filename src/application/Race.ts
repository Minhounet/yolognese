import { COLORS, Code } from '../domain/color';
import { RaceEvent } from '../domain/race';
import { flush, newRaceRound, receive } from '../domain/round';
import { RoomEvent, StealEvent } from '../domain/steal';
import { flushSteal, newStealRound, receiveSteal, settle } from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RaceLink, RandomSource } from './ports';
import { GameView } from './views';

const RACE_TYPES = ['progress', 'attack', 'cracked', 'out'];
const isRaceEvent = (event: RoomEvent): event is RaceEvent => RACE_TYPES.includes(event.type);

export interface Player {
  readonly id: string;
  readonly name: string;
}

export interface StartRaceCommand {
  readonly me: string;
  readonly players: readonly Player[];
  /** The secret the host drew; absent for the host, who draws it. */
  readonly secret?: Code;
}

/** Starts this player's race round; answers the secret, which the host sends to the room. */
export interface StartRace {
  execute(command: StartRaceCommand): { readonly view: GameView; readonly secret: Code };
}

export class StartRaceImpl implements StartRace {
  constructor(
    private readonly random: RandomSource,
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute({ me, players, secret }: StartRaceCommand) {
    const now = this.clock.now();
    const code = secret ?? this.drawSecret();
    const round = newRaceRound(code, me, players, now, (max) => this.random.nextInt(max));
    this.repository.save(round);
    return { view: toGameView(round, now), secret: code };
  }

  private drawSecret(): Code {
    const drawColor = () => COLORS[this.random.nextInt(COLORS.length)];
    return [drawColor(), drawColor(), drawColor(), drawColor()];
  }
}

export interface StartStealCommand {
  readonly me: string;
  /** Every player, in seat order (the host first), with the secret they chose. */
  readonly players: readonly (Player & { readonly secret: Code })[];
}

/** Starts this player's "steal the sauce" match. */
export interface StartSteal {
  execute(command: StartStealCommand): GameView;
}

export class StartStealImpl implements StartSteal {
  constructor(
    private readonly random: RandomSource,
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute({ me, players }: StartStealCommand): GameView {
    const now = this.clock.now();
    const round = newStealRound(me, players, now, (max) => this.random.nextInt(max));
    this.repository.save(round);
    return toGameView(round, now);
  }
}

/** Applies an event heard from the room (race or steal the sauce). */
export interface ReceiveRace {
  execute(event: RoomEvent): GameView | undefined;
}

export class ReceiveRaceImpl implements ReceiveRace {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(event: RoomEvent): GameView | undefined {
    const session = this.repository.load();
    if (session === undefined || event.type === 'start') return undefined;
    const now = this.clock.now();
    const draw = (max: number) => this.random.nextInt(max);
    if (session.steal !== undefined) {
      const changed = settle(receiveSteal(session, event as StealEvent, now, draw), now);
      this.repository.save(changed);
      return toGameView(changed, now);
    }
    if (session.race === undefined || !isRaceEvent(event)) return undefined;
    const changed = receive(session, event, now);
    this.repository.save(changed);
    return toGameView(changed, now);
  }
}

/** Sends to the room what this player's actions produced since the last call. Called after every tick. */
export interface FlushRace {
  execute(): void;
}

export class FlushRaceImpl implements FlushRace {
  constructor(
    private readonly repository: GameRepository,
    private readonly link: RaceLink,
  ) {}

  execute(): void {
    const session = this.repository.load();
    if (session === undefined) return;
    const { round, events } = session.steal !== undefined ? flushSteal(session) : flush(session);
    if (events.length === 0) return;
    this.repository.save(round);
    events.forEach((event) => this.link.send(event));
  }
}
