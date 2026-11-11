import { COLORS, Code } from '../domain/color';
import { newRound } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, RandomSource } from './ports';
import { SessionWork } from './SessionWork';
import { GameView } from './views';

export interface StartGame {
  execute(): Promise<GameView>;
}

export function drawSecret(random: RandomSource): Code {
  const drawColor = () => COLORS[random.nextInt(COLORS.length)];
  return [drawColor(), drawColor(), drawColor(), drawColor()];
}

export class StartGameImpl implements StartGame {
  constructor(
    private readonly random: RandomSource,
    private readonly work: SessionWork,
    private readonly clock: Clock,
  ) {}

  execute(): Promise<GameView> {
    return this.work.run(() => {
      const now = this.clock.now();
      const round = newRound(drawSecret(this.random), now, (max) => this.random.nextInt(max));
      return { session: round, result: toGameView(round, now) };
    });
  }
}
