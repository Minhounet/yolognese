import { CollectItem, CollectItemImpl } from './application/CollectItem';
import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { EditDraft, EditDraftImpl } from './application/EditDraft';
import { HidePeg, HidePegImpl } from './application/HidePeg';
import { MoveShield, MoveShieldImpl } from './application/MoveShield';
import { PeekSecret, PeekSecretImpl } from './application/PeekSecret';
import { StartGame, StartGameImpl } from './application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from './application/SubmitGuess';
import { Tick, TickImpl } from './application/Tick';
import { SessionWork } from './application/SessionWork';
import { InMemoryGameRepository } from './infrastructure/InMemoryGameRepository';
import { RandomSource } from './application/ports';
import { FixedRandomSource } from './infrastructure/FixedRandomSource';
import { MathRandomSource } from './infrastructure/MathRandomSource';
import { SystemClock } from './infrastructure/SystemClock';
import { ThrowKindRandomSource } from './infrastructure/ThrowKindRandomSource';

export interface UseCases {
  readonly startGame: StartGame;
  readonly submitGuess: SubmitGuess;
  readonly distractGuardian: DistractGuardian;
  readonly peekSecret: PeekSecret;
  readonly tick: Tick;
  readonly moveShield: MoveShield;
  readonly collectItem: CollectItem;
  readonly hidePeg: HidePeg;
  readonly editDraft: EditDraft;
}

/** A luck draw fixed by configuration (globalThis.yologneseLuck), used by the browser checks; none in play. */
function configuredLuck(): RandomSource | undefined {
  return configuredDraw('yologneseLuck');
}

/** An item draw fixed by configuration (globalThis.yologneseItemDraw), used by the browser checks; none in play. */
function configuredItemDraw(): RandomSource | undefined {
  return configuredDraw('yologneseItemDraw');
}

/** The kind of every throw fixed by configuration (globalThis.yologneseThrows), used by the browser checks; none in play. */
function configuredThrows(random: RandomSource): RandomSource {
  const kind = (globalThis as { yologneseThrows?: unknown }).yologneseThrows;
  return kind === 'meatballs' || kind === 'forks' ? new ThrowKindRandomSource(random, kind) : random;
}

function configuredDraw(name: 'yologneseLuck' | 'yologneseItemDraw'): RandomSource | undefined {
  const value = (globalThis as Partial<Record<typeof name, unknown>>)[name];
  return typeof value === 'number' ? new FixedRandomSource(value) : undefined;
}

export function createUseCases(): UseCases {
  const repository = new SessionWork(new InMemoryGameRepository());
  const clock = new SystemClock();
  const random = new MathRandomSource();
  return {
    startGame: new StartGameImpl(random, repository, clock),
    submitGuess: new SubmitGuessImpl(repository),
    distractGuardian: new DistractGuardianImpl(repository, clock, configuredLuck() ?? random),
    peekSecret: new PeekSecretImpl(repository, clock, random),
    tick: new TickImpl(repository, clock, configuredThrows(random), configuredItemDraw() ?? random),
    moveShield: new MoveShieldImpl(repository),
    hidePeg: new HidePegImpl(repository),
    editDraft: new EditDraftImpl(repository, clock),
    collectItem: new CollectItemImpl(repository, clock, random),
  };
}
