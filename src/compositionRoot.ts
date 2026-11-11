import { CollectItem, CollectItemImpl } from './application/CollectItem';
import { DistractGuardian, DistractGuardianImpl } from './application/DistractGuardian';
import { EditDraft, EditDraftImpl } from './application/EditDraft';
import { MoveShield, MoveShieldImpl } from './application/MoveShield';
import { PeekSecret, PeekSecretImpl } from './application/PeekSecret';
import { RandomSource } from './application/ports';
import { JoinRoom, JoinRoomImpl } from './application/RoomPlay';
import { RoundAction } from './application/RoundAction';
import { SessionWork } from './application/SessionWork';
import { StartGame, StartGameImpl } from './application/StartGame';
import { SubmitGuess, SubmitGuessImpl } from './application/SubmitGuess';
import { Tick, TickImpl } from './application/Tick';
import { InMemoryGameRepository } from './infrastructure/InMemoryGameRepository';
import { MathRandomSource } from './infrastructure/MathRandomSource';
import { ScriptedPageRandomSource } from './infrastructure/ScriptedPageRandomSource';
import { SupabaseBackend } from './infrastructure/SupabaseBackend';
import { SupabaseMatchServer } from './infrastructure/SupabaseMatchServer';
import { SupabaseRoomGateway } from './infrastructure/SupabaseRoomGateway';
import { SystemClock } from './infrastructure/SystemClock';
import { TimeoutScheduler } from './infrastructure/TimeoutScheduler';

export interface UseCases {
  readonly startGame: StartGame;
  readonly submitGuess: SubmitGuess;
  readonly distractGuardian: DistractGuardian;
  readonly peekSecret: PeekSecret;
  readonly editDraft: EditDraft;
  readonly collectItem: CollectItem;
  readonly moveShield: MoveShield;
  readonly tick: Tick;
  readonly joinRoom: JoinRoom;
}

/** The only place that knows the adapters: swap one here, nothing else changes. */
export function createUseCases(): UseCases {
  const work = new SessionWork(new InMemoryGameRepository());
  const clock = new SystemClock();
  const random: RandomSource =
    process.env.EXPO_PUBLIC_SCRIPTED_CHANCE === '1' ? new ScriptedPageRandomSource() : new MathRandomSource();
  const supabase = new SupabaseBackend('yolognese-player');
  let bots = 0;
  const action = new RoundAction(work, clock, random);
  return {
    startGame: new StartGameImpl(random, work, clock),
    submitGuess: new SubmitGuessImpl(work, clock),
    distractGuardian: new DistractGuardianImpl(work, clock),
    peekSecret: new PeekSecretImpl(work, clock),
    editDraft: new EditDraftImpl(action),
    collectItem: new CollectItemImpl(action),
    moveShield: new MoveShieldImpl(action),
    tick: new TickImpl(action),
    joinRoom: new JoinRoomImpl({
      gateway: new SupabaseRoomGateway(supabase),
      server: new SupabaseMatchServer(supabase),
      work,
      clock,
      random,
      scheduler: new TimeoutScheduler(),
      botConnection: () => {
        const bot = new SupabaseBackend(`yolognese-bot-${++bots}`);
        return { gateway: new SupabaseRoomGateway(bot), server: new SupabaseMatchServer(bot) };
      },
    }),
  };
}
