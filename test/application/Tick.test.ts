import { StartGameImpl } from '../../src/application/StartGame';
import { TickImpl } from '../../src/application/Tick';
import { InMemoryGameRepository } from '../../src/infrastructure/InMemoryGameRepository';
import { FakeClock } from '../support/FakeClock';
import { ScriptedRandomSource } from '../support/ScriptedRandomSource';

// secret: red yellow green blue
function startedGame() {
  const clock = new FakeClock();
  const repository = new InMemoryGameRepository();
  new StartGameImpl(new ScriptedRandomSource([0, 1, 2, 3]), repository, clock).execute();
  return { clock, tick: new TickImpl(repository, clock) };
}

describe('Tick', () => {
  it('shouldCountDownTimeLeft_whenTicked', () => {
    const { clock, tick } = startedGame();
    clock.advance(1000);

    const response = tick.execute();

    expect(response).toMatchObject({ kind: 'ticked', timeLeftMs: 179000 });
  });
});
