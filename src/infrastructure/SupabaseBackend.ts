import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './supabaseConfig';

/**
 * The one Supabase connection of the app, signed in anonymously: the room and
 * the match server must see the same player identity (the server's access
 * rules check it). The session is not kept: a new identity per app start.
 */
export class SupabaseBackend {
  private client: SupabaseClient | undefined;
  private signedIn: Promise<string> | undefined;

  connection(): SupabaseClient {
    this.client ??= createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: true },
    });
    return this.client;
  }

  /** This player's id, signing in on first use. */
  playerId(): Promise<string> {
    this.signedIn ??= this.connection()
      .auth.signInAnonymously()
      .then(({ data, error }) => {
        if (error !== null || data.user === null) throw error ?? new Error('no player identity');
        return data.user.id;
      });
    this.signedIn.catch(() => (this.signedIn = undefined));
    return this.signedIn;
  }
}
