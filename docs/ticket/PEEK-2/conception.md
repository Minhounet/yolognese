---
status: in-progress
---

# PEEK-2: Steal the sauce (multiplayer, refereed by a server)

## Context

The user asked for multiplayer ("everyone same screen? one vs one? one vs
each others?"). A race (same secret for all) was tried and judged "not funny";
the user then asked: "a mode where we are several persons but we have to guess
the secret of the others ... there must at a moment some kind of switch to
change the person's we are fighting." At the gates: a crack scores points; the
switch comes every 45 s and after each crack; Supabase holds the truth ("Yes,
apply all"); bots for testing alone; race mode removed. First built on a branch
started before rounds 4-12, then rebuilt on main ("Main is always the base").

## Decisions

- D-circle: players sit in start order (the host first); each attacks the
  player `step` seats on, `step` = 1 + rotation mod (n − 1). Two players: a duel,
  no switch.
- D-server: Supabase holds every sauce, the scores and the circle
  (`supabase/`: tables with row-level security, no write policy, no read policy
  on sauces; the rules are Postgres functions `yolo_*` called over RPC, which
  broadcast what changed to the room's Realtime channel). Phones sign in
  anonymously; the room's presence carries names only.
- D-points: a crack scores +1, the robbed player gets a new random sauce, the
  circle turns at once; life at 0 is a knock-out (−1 point, life refilled);
  most points after 5 minutes wins.
- D-phone: the phone keeps main's game (guardian, cooldown, items, meatballs,
  punches, shield, life) and asks the server only what it alone knows: a
  guess's score (shown pending until then), a peeked peg, the x-ray's peg, a
  due switch, a knock-out, its own new sauce.
- D-bots: the host can add test bots from the room, each its own identity on
  the server, easy to beat (a guess every 7-11 s, careful half the time).
- D-structure: async session storage behind `SessionWork` (one queue, and the
  match's own rules applied on load and save); ports `Room`/`RoomGateway`,
  `MatchServer`, `Scheduler`, `BotConnection`; adapters `SupabaseRoomGateway`,
  `SupabaseMatchServer` (one `SupabaseBackend` per identity), `roomWire`
  (versioned, checked messages); application `stealMatch` (rules on the
  session), `Match` (start, receive, flush), `RoomPlay`/`JoinRoom`, `SauceBot`.

## Ruled out

- Same screen: hides nothing. Race mode: "not funny", removed (user).
- Sabotage between players and the "chili" present: not ported to main.
- An Edge Function referee: Postgres functions are next to the data, no cold start.

## Known limits

- The room channel is public: a cheater could broadcast a fake state to the
  others' screens (not change the server's truth, nor read a sauce).
- The guardian lives on the phone: the server cannot tell a peek the guardian
  saw from one it missed; it only limits the pace (one peg a second).
