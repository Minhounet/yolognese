import { RealtimeChannel, SupabaseClient, createClient } from '@supabase/supabase-js';
import { RaceLink } from '../application/ports';
import { Code } from '../domain/color';
import { RoomEvent } from '../domain/steal';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

export type Mode = 'race' | 'steal';

/** What each player tells the room about itself (presence). */
export interface MemberInfo {
  readonly name: string;
  readonly joinedAt: number;
  /** "Steal the sauce": the secret this player hides. */
  readonly secret?: Code;
  /** The mode the host picked (only the host's counts). */
  readonly mode?: Mode;
}

export interface Member extends MemberInfo {
  readonly id: string;
}

export interface RoomHandlers {
  readonly onMembers: (members: readonly Member[]) => void;
  readonly onEvent: (event: RoomEvent) => void;
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
  private info: MemberInfo;
  private joined = false;
  private readonly channel: RealtimeChannel;
  private handlers: RoomHandlers;

  constructor(code: string, info: Omit<MemberInfo, 'joinedAt'>, handlers: RoomHandlers) {
    this.info = { ...info, joinedAt: Date.now() };
    this.me = { id: newId(), ...this.info };
    this.handlers = handlers;
    this.channel = supabase().channel(`yolognese:race:${code}`, {
      config: { broadcast: { self: false }, presence: { key: this.me.id } },
    });
    this.channel
      .on('presence', { event: 'sync' }, () => this.handlers.onMembers(this.members()))
      .on('broadcast', { event: 'race' }, ({ payload }) => this.handlers.onEvent(payload as RoomEvent));
    handlers.onStatus('connecting');
    this.channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        this.joined = true;
        await this.channel.track({ ...this.info });
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

  /** Changes what the room sees about this player (its secret, the host's mode). */
  update(change: Partial<Omit<MemberInfo, 'joinedAt'>>): void {
    this.info = { ...this.info, ...change };
    if (this.joined) void this.channel.track({ ...this.info });
  }

  members(): readonly Member[] {
    const state = this.channel.presenceState<MemberInfo>();
    return Object.entries(state)
      .map(([id, metas]) => ({ ...metas[0], name: metas[0]?.name ?? '?', joinedAt: metas[0]?.joinedAt ?? 0, id }))
      .sort((one, other) => one.joinedAt - other.joinedAt || one.id.localeCompare(other.id));
  }

  send(event: RoomEvent): void {
    void this.channel.send({ type: 'broadcast', event: 'race', payload: event });
  }

  leave(): void {
    void supabase().removeChannel(this.channel);
  }
}
