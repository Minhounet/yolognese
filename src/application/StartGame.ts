import { COLORS, Code } from '../domain/color';
import { newGame } from '../domain/game';
import { WATCHING } from '../domain/guardian';
import { fullBar } from '../domain/actionBar';
import { toGameView } from './GameMapper';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

const GAME_DURATION_MS = 180_000;

export function drawSecret(random: RandomSource): Code {
  const drawColor = () => COLORS[random.nextInt(COLORS.length)];
  return [drawColor(), drawColor(), drawColor(), drawColor()];
}

export interface StartGame {
  execute(): Promise<GameView>;
}

export class StartGameImpl implements StartGame {
  constructor(
    private readonly random: RandomSource,
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(): Promise<GameView> {
    return this.work.run(() => {
      const game = newGame(this.drawSecret());
      const session = { game, guardian: WATCHING, peekReadyAt: fullBar(this.clock.now()), endsAt: this.clock.now() + GAME_DURATION_MS };
      return { session, result: toGameView(game, { session, now: this.clock.now() }) };
    });
  }

  private drawSecret(): Code {
    return drawSecret(this.random);
  }
}
