import { RealtimeChannel, SupabaseClient, createClient } from '@supabase/supabase-js';
import { Member, MemberInfo, Room, RoomGateway, RoomListener } from '../application/ports';
import { RoomEvent } from '../domain/steal';
import { decode, encode } from './roomWire';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * A room on Supabase Realtime: presence says who is in the room, broadcast
 * carries the messages (see roomWire). No table is used.
 */
class SupabaseRoom implements Room {
  readonly me: Member;
  private info: MemberInfo;
  private joined = false;
  private readonly channel: RealtimeChannel;

  constructor(
    private readonly client: SupabaseClient,
    code: string,
    info: Omit<MemberInfo, 'joinedAt'>,
    private readonly listener: RoomListener,
  ) {
    this.info = { ...info, joinedAt: Date.now() };
    this.me = { id: newId(), ...this.info };
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

  update(change: Partial<Omit<MemberInfo, 'joinedAt'>>): void {
    this.info = { ...this.info, ...change };
    if (this.joined) void this.channel.track({ ...this.info });
  }

  send(event: RoomEvent): void {
    void this.channel.send({ type: 'broadcast', event: 'race', payload: encode(event) });
  }

  leave(): void {
    void this.client.removeChannel(this.channel);
  }
}

export class SupabaseRoomGateway implements RoomGateway {
  private client: SupabaseClient | undefined;

  join(code: string, info: Omit<MemberInfo, 'joinedAt'>, listener: RoomListener): Room {
    this.client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return new SupabaseRoom(this.client, code, info, listener);
  }
}
