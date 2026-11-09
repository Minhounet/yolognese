import { Attack } from '../domain/attack';
import { Session } from './ports';

/** The session with a punch on its way: it lands like a meatball, and costs a punch's life when it hits. */
export function withPunchThrown(session: Session, now: number, punch: Attack): Session {
  return { ...session, attackLandsAt: now + punch.landsInMs, attackLane: punch.lane, attackIsPunch: true };
}
