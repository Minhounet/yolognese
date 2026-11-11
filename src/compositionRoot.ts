import { CollectItem, CollectItemImpl } from './application/CollectItem';
import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { EditDraft, EditDraftImpl } from './application/EditDraft';
import { JoinRoom } from './application/RoomPlay';
import { settleSteal } from './application/stealMatch';
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
import { SupabaseBackend } from './infrastructure/SupabaseBackend';
import { SupabaseMatchServer } from './infrastructure/SupabaseMatchServer';
import { SupabaseRoomGateway } from './infrastructure/SupabaseRoomGateway';
import { TimeoutScheduler } from './infrastructure/TimeoutScheduler';

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
  /** "Steal the sauce": rooms, the match server, test bots. */
  readonly joinRoom: JoinRoom;
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

/** The match's draws (sauces, room codes, bots) fixed by configuration (globalThis.yologneseMatchDraw), used by the browser checks; none in play. */
function configuredMatchDraw(): RandomSource | undefined {
  return configuredDraw('yologneseMatchDraw');
}

function configuredDraw(name: 'yologneseLuck' | 'yologneseItemDraw' | 'yologneseMatchDraw'): RandomSource | undefined {
  const value = (globalThis as Partial<Record<typeof name, unknown>>)[name];
  return typeof value === 'number' ? new FixedRandomSource(value) : undefined;
}

export function createUseCases(): UseCases {
  const clock = new SystemClock();
  const repository = new SessionWork(new InMemoryGameRepository(), (session) => settleSteal(session, clock.now()));
  const random = new MathRandomSource();
  const supabase = new SupabaseBackend('yolognese-player');
  let bots = 0;
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
    joinRoom: new JoinRoom({
      gateway: new SupabaseRoomGateway(supabase),
      server: new SupabaseMatchServer(supabase),
      work: repository,
      clock,
      random: configuredMatchDraw() ?? random,
      scheduler: new TimeoutScheduler(),
      botConnection: () => {
        const bot = new SupabaseBackend(`yolognese-bot-${++bots}`);
        return { gateway: new SupabaseRoomGateway(bot), server: new SupabaseMatchServer(bot) };
      },
    }),
  };
}
