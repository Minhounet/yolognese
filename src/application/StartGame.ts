import { COLORS, Code } from '../domain/color';
import { newGame } from '../domain/game';
import { WATCHING } from '../domain/guardian';
import { toGameView } from './GameMapper';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

const PEEK_READY_AT_START = 0;
const GAME_DURATION_MS = 180_000;

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
      const session = { game, guardian: WATCHING, peekReadyAt: PEEK_READY_AT_START, endsAt: this.clock.now() + GAME_DURATION_MS };
      return { session, result: toGameView(game) };
    });
  }

  private drawSecret(): Code {
    const drawColor = () => COLORS[this.random.nextInt(COLORS.length)];
    return [drawColor(), drawColor(), drawColor(), drawColor()];
  }
}
