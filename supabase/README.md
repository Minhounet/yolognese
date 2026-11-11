# Supabase: the match server for "steal the sauce"

The server holds the truth: every player's sauce, the score, the circle. The
phones call the `yolo_*` Postgres functions over RPC as an anonymously
signed-in player; the functions apply the rules and broadcast what changed to
the room's Realtime channel (`yolognese:race:<CODE>`). No table can be written
by a phone, and no phone can read a sauce: `sauces` has row-level security on
and no policy.

| Function | Who | Does |
|---|---|---|
| `yolo_set_sauce(code, sauce)` | anyone signed in | keeps the sauce chosen in the room |
| `yolo_start(code, players)` | the host (first in `players`) | creates the match, seats, sauces; broadcasts the state |
| `yolo_guess(match, guess)` | a player | scores against the current target; a crack: +1, a new sauce for the robbed, the circle turns |
| `yolo_peek(match, index)` | a player | one peg of the target's sauce, at most one a second |
| `yolo_sync(match)` | a player | lets due 45 s switches happen |
| `yolo_knockout(match)` | a player | −1 point (never below 0) |
| `yolo_my_sauce(match)` | a player | the caller's own sauce (after being robbed) |

Set up a project (done once for this one):

1. Run `migrations/20261111000000_steal_the_sauce.sql` (SQL editor, or the
   Management API `POST /v1/projects/<ref>/database/query`).
2. Authentication → Sign In / Providers → allow anonymous sign-ins.
3. Put the project URL and publishable key in `src/infrastructure/supabaseConfig.ts`.

Check the rules: run `tests/steal_the_sauce.sql` the same way. It plays three
users inside a transaction that is rolled back, and ends with
`ALL CHECKS PASSED` (any failed check raises an error).

Known limits: the room channel is public, so a player could broadcast a fake
state message to the others' screens (it cannot change the server's truth or
read a sauce); a private channel with Realtime authorization would close that.
The guardian lives on the phone: the server cannot tell a peek the guardian saw
from one it missed, it only limits the pace.
