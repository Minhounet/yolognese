import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { Member, MemberInfo, Room, RoomGateway, RoomListener } from '../application/ports';
import { decode } from './roomWire';
import { SupabaseBackend } from './SupabaseBackend';

/**
 * A room on Supabase Realtime: presence says who is in the room, broadcast
 * carries the match server's messages (see roomWire).
 */
class SupabaseRoom implements Room {
  readonly me: Member;
  private info: MemberInfo;
  private joined = false;
  private readonly channel: RealtimeChannel;

  constructor(
    private readonly client: SupabaseClient,
    playerId: string,
    code: string,
    info: Omit<MemberInfo, 'joinedAt'>,
    private readonly listener: RoomListener,
  ) {
    this.info = { ...info, joinedAt: Date.now() };
    this.me = { id: playerId, ...this.info };
    // the channel name is the one the match server broadcasts to (yolo_broadcast)
    this.channel = client.channel(`yolognese:race:${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.me.id } },
    });
    this.channel
      .on('presence', { event: 'sync' }, () => this.listener.onMembers(this.members()))
      .on('broadcast', { event: 'race' }, ({ payload }) => {
        const event = decode(payload);
        if (event !== undefined) this.listener.onEvent(event);
      });
    listener.onStatus('connecting');
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.joined = true;
        await this.channel.track({ ...this.info });
        this.listener.onStatus('joined');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.listener.onStatus('failed');
      }
    });
  }

  members(): readonly Member[] {
    const state = this.channel.presenceState<MemberInfo>();
    return Object.entries(state)
      .map(([id, metas]) => ({ ...metas[0], name: metas[0]?.name ?? '?', joinedAt: metas[0]?.joinedAt ?? 0, id }))
      .sort((one, other) => one.joinedAt - other.joinedAt || one.id.localeCompare(other.id));
  }



  leave(): void {
    void this.client.removeChannel(this.channel);
  }
}

export class SupabaseRoomGateway implements RoomGateway {
  constructor(private readonly backend: SupabaseBackend) {}

  async join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Promise<Room> {
    const playerId = await this.backend.playerId();
    return new SupabaseRoom(this.backend.connection(), playerId, code, info, listener);
  }
}
