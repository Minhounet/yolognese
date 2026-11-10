import { CollectItem, CollectItemImpl } from './application/CollectItem';
import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { EditDraft, EditDraftImpl } from './application/EditDraft';
import { MoveShield, MoveShieldImpl } from './application/MoveShield';
import { PeekSecret, PeekSecretImpl } from './application/PeekSecret';
import { RoundAction } from './application/RoundAction';
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
  readonly editDraft: EditDraft;
  readonly collectItem: CollectItem;
  readonly moveShield: MoveShield;
  readonly tick: Tick;
}

export function createUseCases(): UseCases {
  const repository = new InMemoryGameRepository();
  const clock = new SystemClock();
  const random = new MathRandomSource();
  const action = new RoundAction(repository, clock, random);
  return {
    startGame: new StartGameImpl(random, repository, clock),
    submitGuess: new SubmitGuessImpl(repository, clock),
    distractGuardian: new DistractGuardianImpl(repository, clock),
    peekSecret: new PeekSecretImpl(repository, clock),
    editDraft: new EditDraftImpl(action),
    collectItem: new CollectItemImpl(action),
    moveShield: new MoveShieldImpl(action),
    tick: new TickImpl(action),
  };
}
