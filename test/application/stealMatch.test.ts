import { applyScore, newStealSession } from '../../src/application/stealMatch';
import { MatchState } from '../../src/domain/steal';

const STATE: MatchState = {
  matchId: 'm1',
  rotation: 0,
  nextSwitchAt: 45_000,
  endsAt: 300_000,
  serverNow: 0,
  finished: false,
  seats: [
    { id: 'a', name: 'Ann', points: 0, version: 0 },
    { id: 'b', name: 'Bob', points: 0, version: 0 },
    { id: 'c', name: 'Cid', points: 0, version: 0 },
  ],
};

describe('stealMatch', () => {
  it('shouldRecordTheScore_onTheTargetItWasMadeOn', () => {
    const session = { ...newStealSession('a', STATE, 0), steal: { ...newStealSession('a', STATE, 0).steal!, guessing: ['red', 'red', 'red', 'red'] as const } };

    const scored = applyScore(session, ['red', 'red', 'red', 'red'], 1, 0, 'b');

    expect(scored.game.turns).toHaveLength(1);
    expect(scored.steal?.guessing).toBeUndefined();
  });

  it('shouldDropTheScore_whenTheCircleTurnedAwayFromThatTarget', () => {
    const session = newStealSession('a', STATE, 0); // Ann is after Bob

    const scored = applyScore(session, ['red', 'red', 'red', 'red'], 1, 0, 'c'); // scored on Cid, before the switch reached Ann

    expect(scored.game.turns).toHaveLength(0);
  });
});
