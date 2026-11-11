import { GuessAnswer, MatchServer } from '../application/ports';
import { COLORS, Code, Color } from '../domain/color';
import { MatchState } from '../domain/steal';
import { SupabaseBackend } from './SupabaseBackend';
import { decodeState } from './roomWire';

/** The match server as Postgres functions (supabase/migrations), called over RPC as the signed-in player. */
export class SupabaseMatchServer implements MatchServer {
  constructor(private readonly backend: SupabaseBackend) {}

  async setSauce(roomCode: string, sauce: Code): Promise<void> {
    await this.call('yolo_set_sauce', { p_code: roomCode, p_secret: sauce });
  }

  async start(roomCode: string, players: readonly { readonly id: string; readonly name: string }[]): Promise<MatchState> {
    return this.state(await this.call('yolo_start', { p_code: roomCode, p_players: players }));
  }

  async guess(matchId: string, code: Code): Promise<GuessAnswer> {
    const answer = (await this.call('yolo_guess', { p_match: matchId, p_guess: code })) as Record<string, unknown>;
    const state = this.state(answer.state);
    if (answer.rejected === 'match-over') return { kind: 'match-over', state };
    const { exact, misplaced, target } = answer;
    if (typeof exact !== 'number' || typeof misplaced !== 'number' || typeof target !== 'string') throw new Error('bad score');
    return { kind: 'scored', exact, misplaced, target, state };
  }

  async peek(matchId: string, index: number): Promise<Color | undefined> {
    try {
      const color = await this.call('yolo_peek', { p_match: matchId, p_index: index });
      return (COLORS as readonly unknown[]).includes(color) ? (color as Color) : undefined;
    } catch {
      return undefined; // asked too fast
    }
  }

  async sync(matchId: string): Promise<MatchState> {
    return this.state(await this.call('yolo_sync', { p_match: matchId }));
  }

  async knockout(matchId: string): Promise<MatchState> {
    return this.state(await this.call('yolo_knockout', { p_match: matchId }));
  }

  async mySauce(matchId: string): Promise<Code> {
    const sauce = await this.call('yolo_my_sauce', { p_match: matchId });
    if (!Array.isArray(sauce) || sauce.length !== 4) throw new Error('bad sauce');
    return sauce as unknown as Code;
  }

  async ink(matchId: string): Promise<boolean> {
    try {
      await this.call('yolo_ink', { p_match: matchId });
      return true;
    } catch {
      return false; // asked too fast, or the match is over
    }
  }

  private async call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    await this.backend.playerId();
    const { data, error } = await this.backend.connection().rpc(fn, args);
    if (error !== null) throw new Error(`${fn}: ${error.message}`);
    return data;
  }

  private state(raw: unknown): MatchState {
    const state = decodeState(raw);
    if (state === undefined) throw new Error('bad match state');
    return state;
  }
}
