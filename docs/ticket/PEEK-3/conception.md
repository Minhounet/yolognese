---
status: in-progress
---

# PEEK-3: the action bar (round 15)

## Context

The user: "When you are knock down, we must see it clearly for 2 3 seconds. I
want to add more action. Can we create action bar to perform a few action? I
think we can finally using the existing cooling bar as action bar. Action like
trying to refill lifebar by playing "bonneteau" to find proper item between
three. I imagine also another action to taunt the opponent which can counter
taunt with proper thing. The one who wins can for example force the other to do
one negative thing (showing a peg, give some life etc.. if you have other funny
ideas)". At the gate: charges (peek 1, shell game 2, taunt 3); an insult duel
(matches: the player whose sauce you are after; solo: the guardian; bots answer
too); all four penalties; a personal access token asked through the secure form
for the server function.

## Decisions

- D-ko: the knock-out notice lasts 2.5 s (the other notices keep 1.5 s) and is
  drawn as a large panel over the guardian (`KnockOutPanel`).
- D-charges: `domain/actionBar.ts`. The session's `peekReadyAt` keeps its
  meaning ("the first charge is ready at"): charges at `now` =
  min(3, (now − peekReadyAt) / 5 s + 1). Spending k charges moves it to
  max(peekReadyAt, now − 10 s) + k × 5 s; being caught sets it to now + 5 s (an
  empty bar). The view carries the bar (`GameView.bar`: charges as a fraction,
  and the time to full) so the screen animates it on the native driver.
- D-shell: `domain/shellGame.ts`: the 🍝's cup and 5 swaps drawn from the
  RandomSource; the cup tapped is followed back through the swaps. Session
  `shell`; use cases `PlayShellGame` (open, pick). Tick closes it 5 s after the
  shuffle.
- D-duel: `domain/duel.ts`: 8 insults, each with its own comeback (the lines
  live in the screen, `ui/insults.ts`; the rules only know numbers). Session
  `duel`: `choosing` (3 insults offered), `waiting` (the taunter, until the
  answer), `answering` (the taunted: insult, 3 comebacks, until). Use case
  `Taunt` (open, say, answer). Solo: the guardian answers (right 1 time in 3,
  after 1 to 3 s) and taunts every 40-70 s (Tick).
- D-penalties: `duel.ts` draws the penalty for a solo duel; the server draws it
  in a match. Session `scramble` (until, a permutation of the colours, applied
  by EditDraft) and `flippedUntil`; the guardian's dizziness is a distraction
  of 4 s; a shown peg is the x-ray's brief peg (3 s).
- D-server-duel: table `taunts` and functions `yolo_taunt` (seated, current
  target, no duel open for either, one taunt every 15 s), `yolo_retort` (the
  taunted, before the deadline), `yolo_taunt_result` (the taunter: settles a
  duel past its deadline); the server broadcasts `steal.taunt` and
  `steal.duel` (winner, penalty) and answers the winner of a 🔍 its peg
  privately. Each phone applies the penalty to itself; a duel is applied once
  (by id).

## Ruled out

- One full bar per action (user chose charges); a bar per action.
- Rock-paper-scissors (user chose the insult duel).
- Insults copied from a commercial game: original lines only.

## Known limits

- The insults and comebacks are in the app: a cheater reading its code knows
  every comeback (as the guardian lives on the phone).
- Life lives on each phone: "give 2 life" is applied by each phone to itself.
