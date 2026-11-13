import { toGameView } from './GameMapper';
import { TauntRefusal, answerTaunt, openTaunt, sayInsult } from './actions';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export type TauntCommand =
  /** Pays three charges and offers three insults. */
  | { readonly kind: 'open' }
  /** Says one of the insults offered. */
  | { readonly kind: 'say'; readonly insult: number }
  /** Answers a taunt with one of the comebacks offered. */
  | { readonly kind: 'answer'; readonly comeback: number };

export type TauntResponse = { readonly kind: 'done'; readonly view: GameView } | { readonly kind: 'rejected'; readonly reason: TauntRefusal | 'no-game' };

/** Round 15 (AC4): the taunt duel, against the guardian (solo) or the player whose sauce this one is after. */
export class Taunt {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(command: TauntCommand): Promise<TauntResponse> {
    return this.work.run<TauntResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      const now = this.clock.now();
      const draw = (count: number) => this.random.nextInt(count);
      const done =
        command.kind === 'open'
          ? openTaunt(session, now, draw)
          : command.kind === 'say'
            ? sayInsult(session, command.insult, now, draw)
            : answerTaunt(session, command.comeback, now);
      if (typeof done === 'string') return { result: { kind: 'rejected', reason: done } };
      return { session: done, result: { kind: 'done', view: toGameView(done.game, { session: done, now }) } };
    });
  }
}
