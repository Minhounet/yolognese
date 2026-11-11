import { Code } from '../domain/color';
import { RaceEvent } from '../domain/race';
import { flush, newRaceRound, receive } from '../domain/round';
import { RoomEvent, StealEvent } from '../domain/steal';
import { flushSteal, newStealRound, receiveSteal, settle } from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock, RaceLink, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { drawSecret } from './StartGame';
import { GameView } from './views';

const RACE_TYPES: readonly string[] = ['progress', 'attack', 'cracked', 'out'];
const STEAL_TYPES: readonly string[] = ['switch', 'stole', 'new-secret', 'knocked-out', 'pressure', 'attack'];
const isRaceEvent = (event: RoomEvent): event is RaceEvent => RACE_TYPES.includes(event.type);
const isStealEvent = (event: RoomEvent): event is StealEvent => STEAL_TYPES.includes(event.type);

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
  execute(command: StartRaceCommand): Promise<{ readonly view: GameView; readonly secret: Code }>;
}

export class StartRaceImpl implements StartRace {
  constructor(
    private readonly random: RandomSource,
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute({ me, players, secret }: StartRaceCommand) {
    return this.work.run(() => {
      const now = this.clock.now();
      const code = secret ?? drawSecret(this.random);
      const round = newRaceRound(code, me, players, now, (max) => this.random.nextInt(max));
      return { session: round, result: { view: toGameView(round, now), secret: code } };
    });
  }
}

export interface StartStealCommand {
  readonly me: string;
  /** Every player, in seat order (the host first), with the secret they chose. */
  readonly players: readonly (Player & { readonly secret: Code })[];
}

/** Starts this player's "steal the sauce" match. */
export interface StartSteal {
  execute(command: StartStealCommand): Promise<GameView>;
}

export class StartStealImpl implements StartSteal {
  constructor(
    private readonly random: RandomSource,
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute({ me, players }: StartStealCommand): Promise<GameView> {
    return this.work.run(() => {
      const now = this.clock.now();
      const round = newStealRound(me, players, now, (max) => this.random.nextInt(max));
      return { session: round, result: toGameView(round, now) };
    });
  }
}

/** Applies an event heard from the room (race or steal the sauce); answers the new view, if any. */
export interface ReceiveRace {
  execute(event: RoomEvent): Promise<GameView | undefined>;
}

export class ReceiveRaceImpl implements ReceiveRace {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(event: RoomEvent): Promise<GameView | undefined> {
    return this.work.run<GameView | undefined>((session) => {
      if (session === undefined) return { result: undefined };
      const now = this.clock.now();
      const draw = (max: number) => this.random.nextInt(max);
      if (session.steal !== undefined && isStealEvent(event)) {
        const changed = settle(receiveSteal(session, event, now, draw), now);
        return { session: changed, result: toGameView(changed, now) };
      }
      if (session.race !== undefined && isRaceEvent(event)) {
        const changed = receive(session, event, now);
        return { session: changed, result: toGameView(changed, now) };
      }
      return { result: undefined };
    });
  }
}

/** Sends to the room what this player's actions produced since the last call. Called after every action and tick. */
export interface FlushRace {
  execute(): Promise<void>;
}

export class FlushRaceImpl implements FlushRace {
  constructor(
    private readonly work: SessionWork,
    private readonly link: RaceLink,
  ) {}

  async execute(): Promise<void> {
    const events = await this.work.run<readonly RoomEvent[]>((session) => {
      if (session === undefined) return { result: [] };
      const flushed = session.steal !== undefined ? flushSteal(session) : flush(session);
      return flushed.events.length === 0 ? { result: [] } : { session: flushed.round, result: flushed.events };
    });
    events.forEach((event) => this.link.send(event));
  }
}
