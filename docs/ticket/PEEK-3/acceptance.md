# PEEK-3: acceptance criteria (round 15: the action bar)

Order: AC1 (independent), AC2, AC3 (needs AC2's charges), AC4, AC5, AC6, AC7 (need AC2; AC6-AC7 reuse AC4's duel).

Source of every AC: the user's message of round 15, and the four answers they
gave at the gate (charges; insult duel; all four penalties; a token for the
server). Interpretations not covered by an answer are the orchestrator's (yolo),
logged in the decision log.

## AC1: A knock-out is seen clearly
- Source: "When you are knock down, we must see it clearly for 2 3 seconds."
- Interpretation: in a match, when the player's life reaches 0, a large 💫 K.O. panel covers the guardian for 2.5 s ("−1 point, life refilled"), and the status line says it for as long
- Questions: none
- Covered by: D-ko
- Evidence: Steal.test.ts shouldShowTheKnockOutFor2_5Seconds, shouldKeepTheKnockOutShown_whenAnotherNoticeFollows (the K.O. has its own time, a later notice does not cut it); browser check e2e/steal.spec.js "Round 15 AC1: a knock-out is shown clearly, for 2.5 s" on the real project (the panel seen, still seen after 2 s, gone by 3.5 s); on the phone: by the user, pending (HUMAN)
- Status: verified

## AC2: The action bar
- Source: "using the existing cooling bar as action bar"; user: "Charges"
- Interpretation: the 👀 cooldown bar becomes an action bar of 3 charges, one refilled every 5 s (full in 15 s, full at the start). A peek costs 1 charge (free while the guardian is blinded by smoke, as before); being caught empties the bar; a peek with no charge is refused and throws the punch (AC11, AC19 kept). Under the bar, two action buttons: 🥤 Shell game (2 charges) and 🗯️ Taunt (3 charges); a button without enough charges is greyed out and does nothing. Amends AC11 (a revealed peek used to empty the bar)
- Questions: none
- Covered by: D-charges
- Evidence: Actions.test.ts "AC2: the action bar" (full at the start, 5 s a charge, caught empties it, a peek costs one, the shell game refused with one, the taunt with two); PeekSecret.test.ts (three peeks spend the bar, a charge back after 5 s, not at 4999 ms); browser checks e2e/round15.spec.js "AC2: ...", e2e/ac11.spec.js (rewritten for charges), e2e/end-and-cooldown.spec.js (the bar refills progressively, 15 s from empty)
- Status: verified

## AC3: The shell game refills life
- Source: "trying to refill lifebar by playing "bonneteau" to find proper item between three"
- Interpretation: 🥤 shows three cups and a 🍝 under one of them for 1 s; the cups cover it and swap places 5 times (2.5 s); then the player taps one cup within 5 s. The 🍝: +3 life (never above 10). Another cup, or too late: nothing, and the cup with the 🍝 is lifted. The game goes on meanwhile (the guardian still throws)
- Questions: none
- Covered by: D-shell
- Evidence: Actions.test.ts "AC3: the shell game" (found: +3, the 🍝 followed through the swaps, another cup nothing, no pick while the cups move, the 🍝 shown when time is up and the table cleared, one game at a time); browser checks e2e/round15.spec.js "AC3: ..." (the 🍝 shown then hidden, the cup seen moving, found +3 / missed)
- Status: verified

## AC4: The taunt duel
- Source: "another action to taunt the opponent which can counter taunt with proper thing"; user: "Insult duel"
- Interpretation: 🗯️ offers 3 insults drawn from 8 (original, pasta-themed lines); the chosen insult goes to the opponent: in a match, the player whose sauce you are after; in solo, the guardian. The taunted player sees the insult and 3 comebacks (its own comeback and 2 others) and has 5 s to pick: its own comeback wins the duel for the taunted player; another or none, for the taunter. In a match the server referees (it alone decides the winner, after the deadline). One duel at a time per player
- Questions: none
- Covered by: D-duel, D-server-duel
- Evidence: Actions.test.ts "AC4-AC5: taunting the guardian"; Steal.test.ts "Round 15: the taunt duel in a match" (the taunt reaches the target only, the right comeback wins, a verdict heard twice applied once, no answer loses, a refused taunt gives the charges back, the choice kept while choosing, the duel settled when the phones ask before the server's deadline); roomWire.test.ts (taunt and duel messages); supabase/tests/steal_the_sauce.sql on the real project (pace, open duel, only the taunted answers, no verdict before the deadline, a second answer changes nothing, a late answer loses, no phone reads the table; 6 rules broken on purpose against a local Postgres, all caught); browser checks e2e/round15.spec.js "AC4: ...", e2e/steal.spec.js "Round 15 AC4, AC7" (the phone taunts a bot; a bot taunts the phone)
- Status: verified

## AC5: The winner forces a penalty on the loser
- Source: "The one who wins can for example force the other to do one negative thing (showing a peg, give some life etc.."; user: show a peg, give life, scrambled palette, upside-down screen
- Interpretation: one penalty is drawn at random and shown to both: 🔍 a peg of the sauce the winner is after is shown to the winner for 3 s (when the taunter wins, that is the loser's own sauce); ❤️ the loser gives 2 life to the winner; 🌀 the loser's palette lies for 10 s (tapping or dragging a colour places another one); 🙃 the loser's screen is upside down for 8 s. In solo, the guardian as loser suffers a shown peg of the secret, gives the player 2 life, or is dizzy (looks away for 4 s, replacing the palette and the screen it has not got); the player as loser gives 2 life (to nobody), gets the lying palette or the upside-down screen (no sauce to show)
- Questions: none
- Covered by: D-penalties
- Evidence: Actions.test.ts (+2 life, −2 life, the secret's peg shown 3 s, the guardian dizzy 4 s, the palette lies 10 s, the screen flipped 8 s, the verdict shown 2.5 s); Steal.test.ts (life taken, scrambled, flipped, the winner's peg of the sauce it is after and not the loser's); supabase/tests (the peg told to the winner only); browser checks e2e/round15.spec.js (upside down for 8 s, the dizzy guardian looks away, red places yellow then red)
- Status: verified

## AC6: The guardian taunts too (solo)
- Source: user: "In solo, the guardian taunts you now and then"
- Interpretation: in a solo game the guardian taunts the player every 40 to 70 s (never while another duel is open); the player answers as in AC4
- Questions: none
- Covered by: D-duel
- Evidence: Actions.test.ts "AC5-AC6" (the taunt at 40 s, not at 39.999 s, its comebacks, lost at 5 s, not while a shell game is on the table); browser check e2e/round15.spec.js "AC6, AC5: the guardian taunts after 40 s"
- Status: verified

## AC7: Bots duel too
- Source: user: "Bots answer too, often wrong"
- Interpretation: a test bot taunted answers after 1.5 to 4 s, with its insult's own comeback 2 times in 5; a bot taunts its target every 35 to 60 s, so a lone tester can practise the comebacks
- Questions: none
- Covered by: D-server-duel, SauceBot
- Evidence: SauceBot.test.ts shouldAnswerATaunt_after1_5To4Seconds, shouldTauntItsTarget_every35To60Seconds_andAskTheVerdict; browser checks e2e/steal.spec.js "Round 15 AC4, AC7" (both ways, on the real project)
- Status: verified

## Discrepancies

None.

## Open minors

- The bar's refill on the phone is drawn by the native driver; its timing is checked on the web build only.
- `npx expo lint` is not set up in this project (running it installs ESLint and a config): typecheck and tests only, as in earlier rounds.
