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

export function isShake(readings: readonly Reading[]): boolean {
  return readings.some(isJolt);
}
