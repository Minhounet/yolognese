import { COLORS, Code } from '../domain/color';
import { newRound } from '../domain/round';
import { toGameView } from './GameMapper';
import { Clock, GameRepository, RandomSource } from './ports';
import { GameView } from './views';

export interface StartGame {
  execute(): GameView;
}

export class StartGameImpl implements StartGame {
  constructor(
    private readonly random: RandomSource,
    private readonly repository: GameRepository,
    private readonly clock: Clock,
  ) {}

  execute(): GameView {
    const now = this.clock.now();
    const round = newRound(this.drawSecret(), now, (max) => this.random.nextInt(max));
    this.repository.save(round);
    return toGameView(round, now);
  }

  private drawSecret(): Code {
    const drawColor = () => COLORS[this.random.nextInt(COLORS.length)];
    return [drawColor(), drawColor(), drawColor(), drawColor()];
  }
}
