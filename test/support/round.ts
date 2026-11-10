import { CollectItemImpl } from '../../src/application/CollectItem';
import { DistractGuardianImpl } from '../../src/application/DistractGuardian';
import { EditDraftImpl } from '../../src/application/EditDraft';
import { MoveShieldImpl } from '../../src/application/MoveShield';
import { PeekSecretImpl } from '../../src/application/PeekSecret';
import { RoundAction } from '../../src/application/RoundAction';
import { StartGameImpl } from '../../src/application/StartGame';
import { SubmitGuessImpl } from '../../src/application/SubmitGuess';
import { TickImpl } from '../../src/application/Tick';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from './FakeClock';
import { QueuedRandomSource } from './QueuedRandomSource';

/**
 * A started round, secret red yellow green blue. With nothing queued, the first
 * item comes at 8000 ms (a food, the first kind) and the first attack at 10000 ms
 * (a meatball, lane 0). The shield starts in lane 1.
 */
export function startedRound() {
  const clock = new FakeClock();
  const random = new QueuedRandomSource();
  const repository = new InMemoryGameRepository();
  random.queue(0, 1, 2, 3);
  new StartGameImpl(random, repository, clock).execute();
  const action = new RoundAction(repository, clock, random);
  const tick = new TickImpl(action);
  return {
    clock,
    random,
    repository,
    tick,
    /** Moves the clock, ticking every 100 ms as the screen does, and answers the last tick. */
    runFor(milliseconds: number) {
      let last = tick.execute();
      for (let passed = 0; passed < milliseconds; passed += 100) {
        clock.advance(Math.min(100, milliseconds - passed));
        last = tick.execute();
      }
      return last;
    },
    submitGuess: new SubmitGuessImpl(repository, clock),
    distractGuardian: new DistractGuardianImpl(repository, clock),
    peekSecret: new PeekSecretImpl(repository, clock),
    editDraft: new EditDraftImpl(action),
    collectItem: new CollectItemImpl(action),
    moveShield: new MoveShieldImpl(action),
  };
}

export const AWAY = { target: { x: 150, y: -60 } };
export const MISS = { guess: ['purple', 'purple', 'orange', 'orange'] } as const;
