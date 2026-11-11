import { ALL_CODES, nextGuess, stillPossible, targetSeat } from '../../src/domain/botBrain';

describe('botBrain', () => {
  it('shouldKnowEveryCode', () => {
    expect(ALL_CODES).toHaveLength(1296);
  });

  it('shouldKeepOnlyCodesThatFitTheAnswers', () => {
    const possible = stillPossible([{ guess: ['red', 'red', 'blue', 'blue'], exact: 4, misplaced: 0 }]);

    expect(possible).toEqual([['red', 'red', 'blue', 'blue']]);
  });

  it('shouldPlayAFittingCode_whenCareful', () => {
    const turns = [{ guess: ['red', 'red', 'blue', 'blue'], exact: 0, misplaced: 0 }] as const;

    const guess = nextGuess(turns, (max) => (max === 100 ? 0 : max - 1), 1);

    expect(guess).not.toContain('red');
    expect(guess).not.toContain('blue');
  });

  it('shouldPlayAnyCode_whenCareless', () => {
    const turns = [{ guess: ['red', 'red', 'blue', 'blue'], exact: 0, misplaced: 0 }] as const;

    expect(nextGuess(turns, (max) => (max === 100 ? 99 : 0), 0.5)).toEqual(['red', 'red', 'red', 'red']);
  });

  it('shouldFindTheSameTargetAsTheServer', () => {
    expect([0, 1, 2].map((seat) => targetSeat(seat, 0, 3))).toEqual([1, 2, 0]);
    expect([0, 1, 2].map((seat) => targetSeat(seat, 1, 3))).toEqual([2, 0, 1]);
    expect(targetSeat(0, 5, 2)).toBe(1);
  });
});
