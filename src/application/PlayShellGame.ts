import { toGameView } from './GameMapper';
import { ShellRefusal, openShell, pickCup } from './actions';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export type ShellCommand = { readonly kind: 'open' } | { readonly kind: 'pick'; readonly place: number };

export type ShellResponse = { readonly kind: 'played'; readonly view: GameView } | { readonly kind: 'rejected'; readonly reason: ShellRefusal | 'no-game' };

/** Round 15 (AC3): the shell game, paid with two charges of the action bar: find the 🍝 for +3 life. */
export class PlayShellGame {
  constructor(
    private readonly work: SessionWork,
    private readonly clock: Clock,
    private readonly random: RandomSource,
  ) {}

  execute(command: ShellCommand): Promise<ShellResponse> {
    return this.work.run<ShellResponse>((session) => {
      if (session === undefined) return { result: { kind: 'rejected', reason: 'no-game' } };
      const now = this.clock.now();
      const played = command.kind === 'open' ? openShell(session, now, (count) => this.random.nextInt(count)) : pickCup(session, command.place, now);
      if (typeof played === 'string') return { result: { kind: 'rejected', reason: played } };
      return { session: played, result: { kind: 'played', view: toGameView(played.game, { session: played, now }) } };
    });
  }
}
