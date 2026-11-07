import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { StartGame, StartGameImpl } from './application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from './application/SubmitGuess';
import { InMemoryGameRepository } from './infrastructure/InMemoryGameRepository';
import { MathRandomSource } from './infrastructure/MathRandomSource';
import { SystemClock } from './infrastructure/SystemClock';

export interface UseCases {
  readonly startGame: StartGame;
  readonly submitGuess: SubmitGuess;
  readonly distractGuardian: DistractGuardian;
}

export function createUseCases(): UseCases {
  const repository = new InMemoryGameRepository();
  return {
    startGame: new StartGameImpl(new MathRandomSource(), repository),
    submitGuess: new SubmitGuessImpl(repository),
    distractGuardian: new DistractGuardianImpl(repository, new SystemClock()),
  };
}
