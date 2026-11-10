import { RealtimeChannel, SupabaseClient, createClient } from '@supabase/supabase-js';
import { RaceLink } from '../application/ports';
import { RaceEvent } from '../domain/race';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

export interface Member {
  readonly id: string;
  readonly name: string;
  readonly joinedAt: number;
}

export interface RoomHandlers {
  readonly onMembers: (members: readonly Member[]) => void;
  readonly onEvent: (event: RaceEvent) => void;
  readonly onStatus: (status: 'connecting' | 'joined' | 'failed') => void;
}

let client: SupabaseClient | undefined;

const supabase = () => {
  client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
};

const newId = () => Math.random().toString(36).slice(2, 10);

/**
 * A race room on Supabase Realtime: presence says who is in the room, broadcast
 * carries the race events. No table is used. Members are sorted by arrival; the
 * first one is the host.
 */
export class SupabaseRaceRoom implements RaceLink {
  readonly me: Member;
  private readonly channel: RealtimeChannel;
  private handlers: RoomHandlers;

  constructor(code: string, name: string, handlers: RoomHandlers) {
    this.me = { id: newId(), name, joinedAt: Date.now() };
    this.handlers = handlers;
    this.channel = supabase().channel(`yolognese:race:${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.me.id } },
    });
    this.channel
      .on('presence', { event: 'sync' }, () => this.handlers.onMembers(this.members()))
      .on('broadcast', { event: 'race' }, ({ payload }) => this.handlers.onEvent(payload as RaceEvent));
    handlers.onStatus('connecting');
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.channel.track({ name: this.me.name, joinedAt: this.me.joinedAt });
        this.handlers.onStatus('joined');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.handlers.onStatus('failed');
      }
    });
  }

  /** Who handles what the room says, as screens change (lobby, then game). */
  listen(handlers: Partial<RoomHandlers>): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  members(): readonly Member[] {
    const state = this.channel.presenceState<{ name: string; joinedAt: number }>();
    return Object.entries(state)
      .map(([id, metas]) => ({ id, name: metas[0]?.name ?? '?', joinedAt: metas[0]?.joinedAt ?? 0 }))
      .sort((one, other) => one.joinedAt - other.joinedAt || one.id.localeCompare(other.id));
  }

  send(event: RaceEvent): void {
    void this.channel.send({ type: 'broadcast', event: 'race', payload: event });
  }

  leave(): void {
    void supabase().removeChannel(this.channel);
  }
}
