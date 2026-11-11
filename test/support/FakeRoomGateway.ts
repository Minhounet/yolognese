import { Member, MemberInfo, Room, RoomGateway, RoomListener } from '../../src/application/ports';
import { RoomEvent } from '../../src/domain/steal';

/**
 * Rooms in memory, as Supabase Realtime behaves: presence is seen by everyone
 * (the joiner included), a broadcast reaches everyone but the sender. Messages
 * are delivered later, like on a network: `delivered()` waits for them.
 */
interface Seat {
  /** What this phone knows about itself. */
  member: Member;
  /** What the others see of it: lags behind while presence is held. */
  published: Member;
  readonly listener: RoomListener;
}

export class FakeRoomGateway implements RoomGateway {
  private readonly rooms = new Map<string, Seat[]>();
  /** While true, presence changes stay on the phone that made them (a slow network). */
  presenceHeld = false;
  private readonly inFlight: Promise<unknown>[] = [];
  private nextId = 0;
  /** Identities to give the next joiners (as the sign-in would), then p1, p2, ... */
  readonly ids: string[] = [];
  /** Messages from outside the room (the match server) go to everyone. */
  broadcast(code: string, event: RoomEvent): void {
    (this.rooms.get(code) ?? []).forEach(({ listener }) => this.inFlight.push(Promise.resolve().then(() => listener.onEvent(event))));
  }
  private clock = 0;

  async join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Promise<Room> {
    const seats = this.rooms.get(code) ?? [];
    this.rooms.set(code, seats);
    const member: Member = { ...info, joinedAt: ++this.clock, id: this.ids.shift() ?? `p${++this.nextId}` };
    const seat: Seat = { member, published: member, listener };
    seats.push(seat);
    const members = () => seats.map((each) => (each === seat ? each.member : each.published));
    const announce = () => seats.forEach(({ listener: each }) => each.onMembers(members()));
    listener.onStatus('connecting');
    Promise.resolve().then(() => {
      listener.onStatus('joined');
      announce();
    });
    return {
      me: member,
      members,
      update: (change) => {
        seat.member = { ...seat.member, ...change };
        if (!this.presenceHeld) seat.published = seat.member;
        announce();
      },
      send: (event: RoomEvent) => {
        seats
          .filter((other) => other !== seat)
          .forEach(({ listener: other }) => this.inFlight.push(Promise.resolve().then(() => other.onEvent(event))));
      },
      leave: () => {
        seats.splice(seats.indexOf(seat), 1);
        announce();
      },
    };
  }

  async delivered(): Promise<void> {
    while (this.inFlight.length > 0) {
      await this.inFlight.shift();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
