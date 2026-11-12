import { MatchState, RoomEvent, ServerRequest } from '../domain/steal';
import { toGameView } from './GameMapper';
import { Clock, MatchServer, Session } from './ports';
import { SessionWork } from './SessionWork';
import {
  applyMySauce,
  applyPeg,
  applyScore,
  applyState,
  newStealSession,
  receiveSteal,
  serverFailed,
  takeRequests,
} from './stealMatch';
import { GameView } from './views';
import { hearVerdict, tauntRefused, tauntSent } from './actions';

/** Starts this player's "steal the sauce" match from the server's first state. */
export class StartSteal {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(me: string, state: MatchState): Promise<GameView> {
    return this.work.run(() => {
      const now = this.clock.now();
      const session = newStealSession(me, state, now);
      return { session, result: toGameView(session.game, { session, now }) };
    });
  }
}

/** Applies what the room heard from the match server; answers the new view. */
export class ReceiveMatch {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(event: RoomEvent): Promise<GameView | undefined> {
    return this.work.run((session) => {
      if (session?.steal === undefined) return { result: undefined };
      const now = this.clock.now();
      const changed = receiveSteal(session, event, now);
      return { session: changed, result: toGameView(changed.game, { session: changed, now }) };
    });
  }
}

/**
 * Asks the match server what only it knows (a guess's score, a peg, a due
 * switch, a knock-out, this player's new sauce) and applies the answers as they
 * come. Called after every action and tick.
 */
export class FlushMatch {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly server: MatchServer,
  ) {}

  async execute(): Promise<void> {
    const { requests, matchId } = await this.work.run<{ readonly requests: readonly ServerRequest[]; readonly matchId?: string }>((session) => {
      if (session?.steal === undefined) return { result: { requests: [] } };
      const taken = takeRequests(session);
      return { session: taken.requests.length > 0 ? taken.session : undefined, result: { requests: taken.requests, matchId: session.steal.matchId } };
    });
    if (matchId !== undefined) await Promise.all(requests.map((request) => this.ask(matchId, request)));
  }

  private apply(change: (session: Session, now: number) => Session): Promise<void> {
    return this.work.run((session) => (session?.steal === undefined ? { result: undefined } : { session: change(session, this.clock.now()), result: undefined }));
  }

  private async ask(matchId: string, request: ServerRequest): Promise<void> {
    try {
      switch (request.type) {
        case 'guess': {
          const answer = await this.server.guess(matchId, request.code);
          await this.apply((session, now) => {
            const scored =
              answer.kind === 'scored' ? applyScore(session, request.code, answer.exact, answer.misplaced, answer.target) : serverFailed(session, request);
            const cracked = answer.kind === 'scored' && answer.exact === 4;
            const cause = cracked ? { kind: 'stolen' as const, by: session.steal?.me ?? '', victim: answer.target } : { kind: 'switch' as const };
            return applyState(scored, answer.state, cause, now);
          });
          return;
        }
        case 'peek': {
          const color = await this.server.peek(matchId, request.index);
          if (color !== undefined) await this.apply((session) => applyPeg(session, request.index, color, request.via));
          return;
        }
        case 'sync':
        case 'knockout': {
          const state = request.type === 'sync' ? await this.server.sync(matchId) : await this.server.knockout(matchId);
          await this.apply((session, now) => applyState(session, state, { kind: 'switch' }, now));
          return;
        }
        case 'ink':
          await this.server.ink(matchId);
          return;
        case 'taunt': {
          const id = await this.server.taunt(matchId, request.insult);
          await this.apply((session) => (id === undefined ? tauntRefused(session) : tauntSent(session, id)));
          return;
        }
        case 'retort': {
          const outcome = await this.server.retort(request.id, request.comeback);
          await this.apply((session, now) => hearVerdict(session, outcome, now));
          return;
        }
        case 'taunt-result': {
          const outcome = await this.server.tauntResult(request.id);
          if (outcome !== undefined) await this.apply((session, now) => hearVerdict(session, outcome, now));
          return;
        }
        case 'my-sauce': {
          const sauce = await this.server.mySauce(matchId);
          await this.apply((session) => applyMySauce(session, sauce));
          return;
        }
      }
    } catch {
      await this.apply((session) => serverFailed(session, request));
    }
  }
}
