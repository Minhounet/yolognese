/** One accelerometer reading, in g (gravity alone is 1), at a time in milliseconds. */
export interface Reading {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly at: number;
}

const JOLT_THRESHOLD_G = 2;

const magnitude = ({ x, y, z }: Reading): number => Math.sqrt(x * x + y * y + z * z);

const isJolt = (reading: Reading): boolean => magnitude(reading) > JOLT_THRESHOLD_G;

const MIN_GAP_BETWEEN_JOLTS_MS = 100;

const startsNewJolt = (at: number, index: number, readingTimes: readonly number[]): boolean => {
  const previousAt = readingTimes[index - 1];
  return previousAt === undefined || at - previousAt >= MIN_GAP_BETWEEN_JOLTS_MS;
};

const SHAKE_WINDOW_MS = 1000;
const JOLTS_FOR_SHAKE = 3;

export function isShake(readings: readonly Reading[]): boolean {
  const joltTimes = readings
    .filter(isJolt)
    .map(({ at }) => at)
    .filter(startsNewJolt);
  return joltTimes.some((firstJoltAt, index) => {
    const lastJoltAt = joltTimes[index + JOLTS_FOR_SHAKE - 1];
    return lastJoltAt !== undefined && lastJoltAt - firstJoltAt <= SHAKE_WINDOW_MS;
  });
}
