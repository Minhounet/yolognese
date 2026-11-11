// Measuring function for Yolognese: the server-authoritative path of one guess.
// Scores a guess against a secret, does one database round trip, broadcasts the
// result to the room through Realtime, then answers. No table is written.
import postgres from 'npm:postgres@3.4.5';

const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const bootedAt = Date.now();

function score(secret: string[], guess: string[]) {
  const exact = guess.filter((c, i) => c === secret[i]).length;
  const shared = [...new Set(secret)].reduce((n, c) => n + Math.min(secret.filter((s) => s === c).length, guess.filter((g) => g === c).length), 0);
  return { exact, misplaced: shared - exact };
}

Deno.serve(async (req) => {
  const started = performance.now();
  const { room, guess, secret, i } = await req.json();
  const result = score(secret, guess);
  const t0 = performance.now();
  await sql`select now()`;
  const dbMs = performance.now() - t0;
  const t1 = performance.now();
  await fetch(`${url}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ topic: room, event: 'scored', payload: { i, ...result }, private: false }] }),
  });
  const broadcastMs = performance.now() - t1;
  return Response.json({ ...result, dbMs, broadcastMs, serverMs: performance.now() - started, warm: Date.now() - bootedAt > 2000 });
});
