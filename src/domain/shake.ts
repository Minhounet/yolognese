/** One accelerometer reading, in g (gravity alone is 1), at a time in milliseconds. */
export interface Reading {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly at: number;
}

export function isShake(readings: readonly Reading[]): boolean {
  return false;
}
