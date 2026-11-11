import { RandomSource } from '../application/ports';
import { LANE_COUNT, THROW_DRAW_SPAN } from '../domain/attack';

/**
 * For the browser checks: fixes the kind of every throw (all meatballs, or all
 * forks, AC34) and keeps the lane random. Other draws pass through unchanged.
 */
export class ThrowKindRandomSource implements RandomSource {
  constructor(
    private readonly random: RandomSource,
    private readonly kind: 'meatballs' | 'forks',
  ) {}

  nextInt(maxExclusive: number): number {
    if (maxExclusive !== THROW_DRAW_SPAN) return this.random.nextInt(maxExclusive);
    const lane = this.random.nextInt(LANE_COUNT);
    return this.kind === 'forks' ? THROW_DRAW_SPAN - LANE_COUNT + lane : lane;
  }
}
