import { COLORS, Code } from '../domain/color';
import { newGame } from '../domain/game';
import { WATCHING } from '../domain/guardian';
import { toGameView } from './GameMapper';
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
    const game = newGame(this.drawSecret());
    this.repository.save({ game, guardian: WATCHING, hasPeeked: false });
    return toGameView(game);
  }

  private drawSecret(): Code {
    const drawColor = () => COLORS[this.random.nextInt(COLORS.length)];
    return [drawColor(), drawColor(), drawColor(), drawColor()];
  }
}
