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
    return { turns: [] };
  }
}
