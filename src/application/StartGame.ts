import { COLORS, Code } from '../domain/color';
import { GameRepository, RandomSource } from './ports';
import { GameView } from './views';

export interface StartGame {
  execute(): GameView;
}

export class StartGameImpl implements StartGame {
  constructor(
    private readonly random: RandomSource,
    private readonly repository: GameRepository,
  ) {}

  execute(): GameView {
    this.repository.save({ game: { secret: this.drawSecret() } });
    return { turns: [] };
  }

  private drawSecret(): Code {
    const drawColor = () => COLORS[this.random.nextInt(COLORS.length)];
    return [drawColor(), drawColor(), drawColor(), drawColor()];
  }
}
