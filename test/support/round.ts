import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { RoundAction } from '../../src/application/RoundAction';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { SessionWork } from '../../src/application/SessionWork';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from './FakeClock';
import { QueuedRandomSource } from './QueuedRandomSource';

/**
 * A started round, secret red yellow green blue. With nothing queued, the first
 * item comes at 8000 ms (a food, the first kind) and the first attack at 10000 ms
 * (a meatball, lane 0). The shield starts in lane 1.
 */
export async function startedRound() {
  const clock = new FakeClock();
  const random = new QueuedRandomSource();
  const work = new SessionWork(new InMemoryGameRepository());
  random.queue(0, 1, 2, 3);
  await new StartGameImpl(random, work, clock).execute();
  const action = new RoundAction(work, clock, random);
  const tick = new TickImpl(action);
  return {
    clock,
    random,
    work,
    tick,
    /** Moves the clock, ticking every 100 ms as the screen does, and answers the last tick. */
    async runFor(milliseconds: number) {
      let last = await tick.execute();
      for (let passed = 0; passed < milliseconds; passed += 100) {
        clock.advance(Math.min(100, milliseconds - passed));
        last = await tick.execute();
      }
      return last;
    },
    submitGuess: new SubmitGuessImpl(work, clock),
    distractGuardian: new DistractGuardianImpl(work, clock),
    peekSecret: new PeekSecretImpl(work, clock),
    editDraft: new EditDraftImpl(action),
    collectItem: new CollectItemImpl(action),
    moveShield: new MoveShieldImpl(action),
  };
}

export const AWAY = { target: { x: 150, y: -60 } };
export const MISS = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
