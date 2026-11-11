# Latency of a server-authoritative guess (measured 2026-11-11)

Question: if Supabase holds the truth (an Edge Function scores each guess and
broadcasts it), is it still real-time enough? Measured from the cloud dev
container (through its HTTPS proxy), not from a phone.

| Path | Median | p90 | Notes |
|---|---|---|---|
| Today: Realtime broadcast, client → client → back (`broadcast-rtt.js`) | 78 ms round trip | 83 ms | ≈ 40 ms one way |
| Guesser sends a guess, gets the score (`measure.js`, warm) | 174 ms | 212 ms | 30 guesses |
| A rival sees the scored guess (broadcast from the function) | 167 ms | 205 ms | after the guess is sent |
| Inside the function | 115 ms | 130 ms | of which one `select now()` 85 ms, broadcast call 30 ms |
| First call (cold start) | 1.7 s | | 1.1 s of it opening the database connection |

Reading:
- Warm, a guess is scored and seen by everyone in under ¼ s. The game's
  real-time feel (guardian, shield, items) stays on the phone, so this is enough.
- 85 ms for a trivial query means the function ran far from the database:
  Edge Functions run near the caller by default. Running them in the
  database's region (regional invocation) should cut that to a few ms; to try.
- The cold start (≈ 1.7 s) would hit the first guess of a match: warm the
  function when the room is created (a call at "Start").

Re-run: deploy `edge-function.ts` as `yolognese-measure` (verify_jwt off),
then `NODE_USE_ENV_PROXY=1 node measure.js` (the proxy variable only in the
cloud container).
