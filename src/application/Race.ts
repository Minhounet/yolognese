import { COLORS, Code } from '../domain/color';
import { RaceEvent } from '../domain/race';
import { flush, newRaceRound, receive } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RaceLink, RandomSource } from './ports';
import { GameView } from './views';

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

/** Applies an event heard from the room. */
export interface ReceiveRace {
  execute(event: RaceEvent): GameView | undefined;
}

export class ReceiveRaceImpl implements ReceiveRace {
  constructor(
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(event: RaceEvent): GameView | undefined {
    const session = this.repository.load();
    if (session?.race === undefined) return undefined;
    const now = this.clock.now();
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
    if (session?.race === undefined) return;
    const { round, events } = flush(session);
    if (events.length === 0) return;
    this.repository.save(round);
    events.forEach((event) => this.link.send(event));
  }
}
