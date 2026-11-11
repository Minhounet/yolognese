import { Code } from '../domain/color';
import { RaceEvent } from '../domain/race';
import { Round, flush, newRaceRound, receive } from '../domain/round';
import { MatchState, RoomEvent, ServerRequest, StealEvent } from '../domain/steal';
import {
  applyMySauce,
  applyPeg,
  applyScore,
  applyState,
  flushSteal,
  newStealRound,
  receiveSteal,
  serverFailed,
  settle,
} from '../domain/stealRound';
import { toGameView } from './GameMapper';
import { Clock, MatchServer, RaceLink, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { drawSecret } from './StartGame';
import { GameView } from './views';

const RACE_TYPES: readonly string[] = ['progress', 'attack', 'cracked', 'out'];
const STEAL_TYPES: readonly string[] = ['state', 'pressure', 'attack'];
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
  /** The server's first state of the match. */
  readonly state: MatchState;
}

/** Starts this player's "steal the sauce" match from the server's state. */
export interface StartSteal {
  execute(command: StartStealCommand): Promise<GameView>;
}

export class StartStealImpl implements StartSteal {
  constructor(
    private readonly random: RandomSource,
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute({ me, state }: StartStealCommand): Promise<GameView> {
    return this.work.run(() => {
      const now = this.clock.now();
      const round = newStealRound(me, state, now, (max) => this.random.nextInt(max));
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
        const changed = settle(receiveSteal(session, event, now), now);
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

/**
 * Sends what this player's actions produced since the last call: messages to
 * the room, and in "steal the sauce" the questions only the server can answer,
 * whose answers are applied as they come. Called after every action and tick.
 */
export interface FlushRace {
  execute(): Promise<void>;
}

export class FlushRaceImpl implements FlushRace {
  constructor(
    private readonly work: SessionWork,
    private readonly link: RaceLink,
    private readonly clock: Clock,
    private readonly server?: MatchServer,
  ) {}

  async execute(): Promise<void> {
    const { events, requests, matchId } = await this.work.run<{
      readonly events: readonly RoomEvent[];
      readonly requests: readonly ServerRequest[];
      readonly matchId?: string;
    }>((session) => {
      if (session === undefined) return { result: { events: [], requests: [] } };
      if (session.steal !== undefined) {
        const flushed = flushSteal(session);
        const nothing = flushed.events.length === 0 && flushed.requests.length === 0;
        return { session: nothing ? undefined : flushed.round, result: { ...flushed, matchId: session.steal.matchId } };
      }
      const flushed = flush(session);
      return { session: flushed.events.length === 0 ? undefined : flushed.round, result: { events: flushed.events, requests: [] } };
    });
    events.forEach((event) => this.link.send(event));
    if (matchId !== undefined) await Promise.all(requests.map((request) => this.ask(matchId, request)));
  }

  private async ask(matchId: string, request: ServerRequest): Promise<void> {
    const apply = (change: (round: Round, now: number) => Round) =>
      this.work.run((session) => (session === undefined ? { result: undefined } : { session: settle(change(session, this.clock.now()), this.clock.now()), result: undefined }));
    const server = this.server;
    if (server === undefined) return;
    try {
      switch (request.type) {
        case 'guess': {
          const answer = await server.guess(matchId, request.code);
          await apply((round, now) => {
            const scored = answer.kind === 'scored' ? applyScore(round, request.code, answer.exact, answer.misplaced, answer.target) : serverFailed(round, request);
            const cracked = answer.kind === 'scored' && answer.exact === 4;
            const cause = cracked ? { kind: 'stolen' as const, by: round.steal?.me ?? '', victim: answer.target } : { kind: 'switch' as const };
            return applyState(scored, answer.state, cause, now);
          });
          return;
        }
        case 'peek': {
          const color = await server.peek(matchId, request.index);
          if (color !== undefined) await apply((round, now) => applyPeg(round, request.index, color, request.via, now));
          return;
        }
        case 'sync':
          await apply(applyStateFrom(await server.sync(matchId)));
          return;
        case 'knockout':
          await apply(applyStateFrom(await server.knockout(matchId)));
          return;
        case 'my-sauce': {
          const sauce = await server.mySauce(matchId);
          await apply((round) => applyMySauce(round, sauce));
          return;
        }
      }
    } catch {
      await apply((round) => serverFailed(round, request));
    }
  }
}

const applyStateFrom = (state: MatchState) => (round: Round, now: number) =>
  applyState(round, state, { kind: 'switch' }, now);
