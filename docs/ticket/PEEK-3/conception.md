---
status: in-progress
---

# PEEK-3: Steal the sauce (multiplayer, each cracks another's secret)

## Context

The user, after trying the race: "Can't we have a mode where we are several
persons but we have to guess the secret of the others ? Race mode is not funny.
If we are three, there must at a moment some kind of switch to change the
person's we are fighting." Asked at a gate: a crack gives points (not
elimination, not life), and the switch comes on a timer and after every crack.

## Decisions

- D-circle: players sit in the start order (the host first); each attacks the
  player `step` seats on, `step` = 1 + rotation mod (n − 1), so every rival comes
  round in turn. With two players there is nothing to switch to: a duel.
- D-switch: every 45 s (3 s warning on screen) and after every crack. Only the
  host's phone turns the circle and sends `switch {rotation}`; the others apply
  a higher rotation. One authority, so phones cannot drift apart.
- D-memory: the guesses made on each player are kept and come back with them;
  cleared when that player's sauce changes.
- D-points: a crack scores +1 (`stole`); the cracked player draws a new random
  sauce and sends it (`new-secret`). Life at 0 is a knock-out: −1 point (not
  below 0), life back to full. Most points after 5 minutes wins.
- D-defence: each phone sends its best right-place count on its target
  (`pressure`) when it changes; the target sees who is after it and how close.
  😈 sabotage throws at your current attacker.
- D-sauce: each player picks its sauce in the room (random by default),
  carried in presence; at the start each phone uses its own current sauce and
  sends `new-secret` if the host started with an older one (found by the
  browser check: presence lags behind a last-second change).
- D-structure: pure rules in `src/domain/steal.ts` (circle, scores) and
  `src/domain/stealRound.ts` (`settle` after every action and tick,
  `receiveSteal`, `flushSteal`); `isRoundOver` lets ticks run while a cracker
  waits for the switch. Use case `StartSteal`; `ReceiveRace` / `FlushRace` carry
  both modes. Attacks thrown by others moved from the race to the round
  (`incoming`).

## Ruled out

- Asking the target's phone to score each guess: needs a round trip per guess;
  the secrets travel to every phone instead (fine between friends).

## Clean-architecture refactor (user: "storing data on a table should not change code part from writing adapters")

- Async ports: `GameRepository.load/save` return promises, so a remote table
  can implement it; every use case is async. `SessionWork` (application)
  runs the use cases' work on the session one at a time (load, rules, save):
  with an async repository a tick and a tap could otherwise read the same
  session and the second save would drop the first change.
- A `Room` port (`RoomGateway.join` → members, update, send, leave) replaces
  the screen's direct use of Supabase. `SupabaseRoomGateway` is its adapter,
  created only in `compositionRoot.ts`.
- The lobby's rules moved from the screen into `RoomPlay` / `JoinRoom`
  (application): host, mode, sauce, start, the late-sauce correction, routing
  the room's messages to the match. The screens only show views and forward taps.
- Wire format: `roomWire.ts` (infrastructure) maps domain events to versioned
  messages with their own names and checks what arrives; a malformed or
  other-version message is dropped.
- The browser checks' chance hook is its own adapter
  (`ScriptedPageRandomSource`), chosen by the composition root only when the
  web build is made with `EXPO_PUBLIC_SCRIPTED_CHANCE=1` (`npm run e2e`).
- The domain import cycle (round ↔ race/steal) is gone (`attack.ts`).
- Found by the new tests: a gateway may report its status while `join()` is
  still running (the Supabase adapter does, "connecting"); RoomPlay read the
  room before it existed. Guarded.

## Server version: the match server holds the truth (user: "Yes, apply all")

Supersedes D-circle's host authority, D-points' sauce exchange and D-sauce above.

- Supabase holds every sauce, the scores and the circle (tables `matches`,
  `seats`, `sauces`, `guesses`, `lobby_sauces`, row-level security on, no
  write policy, no read policy on sauces). The rules are Postgres functions
  (`yolo_*`) called over RPC, not an Edge Function: they run next to the data,
  with no cold start; inside the database a guess takes under 1 ms.
  See `supabase/README.md`.
- Phones sign in anonymously (one identity per app start) and the room uses
  that identity, so the server knows who calls. The room's presence no longer
  carries the sauce.
- Port `MatchServer` (application), adapter `SupabaseMatchServer`; one shared
  `SupabaseBackend` for the sign-in. The domain keeps a copy of the server's
  state (`applyState`), asks it what only it knows (`ServerRequest`: guess,
  peek, sync, knockout, my-sauce) through the round's request list, which
  `FlushRace` sends and answers; a guess shows as pending until scored, one at a
  time. Local rules stay local: guardian, cooldown, items, shield, life.
- The peer version of "steal the sauce" is removed; the race stays peer.
- Tests: `test/support/FakeMatchServer.ts` is the SQL rules in memory for the
  application tests; `supabase/tests/steal_the_sauce.sql` checks the real
  functions; `e2e/steal.spec.js` plays a real three-player match.

## Test bots (user: "I dont have multiple phone here. Can we create bot ? Just for tests it must not be too hard.")

- The host taps "🤖 Add a bot (for testing)" in the room ("steal the sauce", up
  to 6 players). Each bot runs on the host's phone but is a player of its own:
  its own anonymous identity (`SupabaseBackend` per bot), its own room
  presence and sauce, its own calls to the match server. Bots leave with the
  host.
- `SauceBot` (application) guesses its current target every 7 to 11 s through
  `Scheduler` (port; `TimeoutScheduler` adapter). `botBrain` (domain) keeps it
  easy to beat: half the time a code that fits what it learned, otherwise any
  code; no peeks, no items, never knocked out.
- Checked: unit tests with the fake server and a fake scheduler; browser checks
  `e2e/bots.spec.js` on the real project with one page (a 3-player circle; a
  duel the bot wins in 7 s with chance scripted).
