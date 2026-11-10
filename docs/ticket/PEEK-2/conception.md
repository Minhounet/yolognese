---
status: in-progress
---

# PEEK-2: Race friends (multiplayer)

## Context

The user asked what multiplayer should look like; the orchestrator suggested a
race (each on their own phone, same secret, sabotage between players) before an
asymmetric guardian-vs-breaker mode. The user provided a dedicated Supabase
project ("I have supabase, you want a dedicated base ?").

## Decisions

- D-transport: Supabase Realtime only, no table: presence lists who is in a
  room, broadcast carries the race events. Channel `yolognese:race:<CODE>`.
  The publishable key ships in the app (`src/infrastructure/supabaseConfig.ts`);
  the secret key is never used. Auth off (`persistSession: false`): no storage
  module needed in Expo Go.
- D-room: a player types a name and a room code (4 random letters offered); the
  first one in is the host and starts the race (2 to 6 players). Late joiners
  wait for the next race.
- D-race: the host draws the secret and sends it in `start` with the player
  list; each phone runs its own round (own timer, items, guardian) with that
  secret. First to crack it wins: the others are beaten. A player out of life or
  time is out; when every rival is out, the last one wins.
- D-sabotage: a 😈 item appears only in a race; collecting it throws a meatball
  or a fork (random lane) at a random rival still playing. It reaches them as an
  attack with the usual 1 s warning, named after the thrower; their shield
  blocks it. It does not move the guardian's own schedule.
- D-progress: each phone tells the room its life and best count of pegs in the
  right place when they change; the rivals panel shows them.
- D-structure: the race rules are pure domain (`src/domain/race.ts`, `receive`
  and `flush` in `round.ts`); the room is a port (`RaceLink`) with a Supabase
  adapter (`SupabaseRaceRoom`). Use cases `StartRace`, `ReceiveRace`,
  `FlushRace` (sends the outbox after every action and tick). Unit tests wire
  several players through an in-memory room.

## Ruled out (for now)

- Same screen: hides nothing (everyone sees the peeks).
- The asymmetric mode (one player is the guardian): next step, needs tight
  timing over the network.
- Cheating protection: the secret travels to every phone; acceptable for
  friends.
