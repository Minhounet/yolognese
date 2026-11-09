import { CollectItem, CollectItemImpl } from './application/CollectItem';
import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { MoveShield, MoveShieldImpl } from './application/MoveShield';
import { PeekSecret, PeekSecretImpl } from './application/PeekSecret';
import { StartGame, StartGameImpl } from './application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from './application/SubmitGuess';
import { Tick, TickImpl } from './application/Tick';
import { InMemoryGameRepository } from './infrastructure/InMemoryGameRepository';
import { RandomSource } from './application/ports';
import { FixedRandomSource } from './infrastructure/FixedRandomSource';
import { MathRandomSource } from './infrastructure/MathRandomSource';
import { SystemClock } from './infrastructure/SystemClock';

export interface UseCases {
  readonly startGame: StartGame;
  readonly submitGuess: SubmitGuess;
  readonly distractGuardian: DistractGuardian;
  readonly peekSecret: PeekSecret;
  readonly tick: Tick;
  readonly moveShield: MoveShield;
  readonly collectItem: CollectItem;
}

/** A luck draw fixed by configuration (globalThis.yologneseLuck), used by the browser checks; none in play. */
function configuredLuck(): RandomSource | undefined {
  const value = (globalThis as { yologneseLuck?: unknown }).yologneseLuck;
  return typeof value === 'number' ? new FixedRandomSource(value) : undefined;
}

export function createUseCases(): UseCases {
  const repository = new InMemoryGameRepository();
  const clock = new SystemClock();
  const random = new MathRandomSource();
  return {
    startGame: new StartGameImpl(random, repository, clock),
    submitGuess: new SubmitGuessImpl(repository),
    distractGuardian: new DistractGuardianImpl(repository, clock, configuredLuck() ?? random),
    peekSecret: new PeekSecretImpl(repository, clock, random),
    tick: new TickImpl(repository, clock, random, random),
    moveShield: new MoveShieldImpl(repository),
    collectItem: new CollectItemImpl(repository, clock, random),
  };
}
