import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { PeekSecret, PeekSecretImpl } from './application/PeekSecret';
import { StartGame, StartGameImpl } from './application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from './application/SubmitGuess';
import { Tick, TickImpl } from './application/Tick';
import { InMemoryGameRepository } from './infrastructure/InMemoryGameRepository';
import { MathRandomSource } from './infrastructure/MathRandomSource';
import { SystemClock } from './infrastructure/SystemClock';

export interface UseCases {
  readonly startGame: StartGame;
  readonly submitGuess: SubmitGuess;
  readonly distractGuardian: DistractGuardian;
  readonly peekSecret: PeekSecret;
  readonly tick: Tick;
}

export function createUseCases(): UseCases {
  const repository = new InMemoryGameRepository();
  const clock = new SystemClock();
  return {
    startGame: new StartGameImpl(new MathRandomSource(), repository),
    submitGuess: new SubmitGuessImpl(repository),
    distractGuardian: new DistractGuardianImpl(repository, clock),
    peekSecret: new PeekSecretImpl(repository, clock),
    tick: new TickImpl(repository, clock),
  };
}
