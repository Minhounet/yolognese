import { Member, MemberInfo, Room, RoomGateway, RoomListener } from '../../src/application/ports';
import { RoomEvent } from '../../src/domain/steal';

/**
 * Rooms in memory, as Supabase Realtime behaves: presence is seen by everyone
 * (the joiner included); what the match server broadcasts reaches everyone in
 * the room a moment later, like on a network: `delivered()` waits for it.
 */
export class FakeRoomGateway implements RoomGateway {
  private readonly rooms = new Map<string, { readonly member: Member; readonly listener: RoomListener }[]>();
  private readonly inFlight: Promise<unknown>[] = [];
  private nextId = 0;
  private clock = 0;
  /** Identities to give the next joiners (as the sign-in would), then p1, p2, ... */
  readonly ids: string[] = [];

  async join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Promise<Room> {
    const seats = this.rooms.get(code) ?? [];
    this.rooms.set(code, seats);
    const member: Member = { ...info, joinedAt: ++this.clock, id: this.ids.shift() ?? `p${++this.nextId}` };
    const seat = { member, listener };
    seats.push(seat);
    const members = () => seats.map((each) => each.member);
    const announce = () => seats.forEach(({ listener: each }) => each.onMembers(members()));
    listener.onStatus('connecting');
    void Promise.resolve().then(() => {
      listener.onStatus('joined');
      announce();
    });
    return {
      me: member,
      members,
      leave: () => {
        seats.splice(seats.indexOf(seat), 1);
        announce();
      },
    };
  }

  /** What the match server says to a room. */
  broadcast(code: string, event: RoomEvent): void {
    (this.rooms.get(code) ?? []).forEach(({ listener }) => this.inFlight.push(Promise.resolve().then(() => listener.onEvent(event))));
  }

  async delivered(): Promise<void> {
    while (this.inFlight.length > 0) {
      await this.inFlight.shift();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
}
