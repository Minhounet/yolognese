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
- Status: designed

## AC2: The action bar
- Source: "using the existing cooling bar as action bar"; user: "Charges"
- Interpretation: the 👀 cooldown bar becomes an action bar of 3 charges, one refilled every 5 s (full in 15 s, full at the start). A peek costs 1 charge (free while the guardian is blinded by smoke, as before); being caught empties the bar; a peek with no charge is refused and throws the punch (AC11, AC19 kept). Under the bar, two action buttons: 🥤 Shell game (2 charges) and 🗯️ Taunt (3 charges); a button without enough charges is greyed out and does nothing. Amends AC11 (a revealed peek used to empty the bar)
- Questions: none
- Covered by: D-charges
- Status: designed

## AC3: The shell game refills life
- Source: "trying to refill lifebar by playing "bonneteau" to find proper item between three"
- Interpretation: 🥤 shows three cups and a 🍝 under one of them for 1 s; the cups cover it and swap places 5 times (2.5 s); then the player taps one cup within 5 s. The 🍝: +3 life (never above 10). Another cup, or too late: nothing, and the cup with the 🍝 is lifted. The game goes on meanwhile (the guardian still throws)
- Questions: none
- Covered by: D-shell
- Status: designed

## AC4: The taunt duel
- Source: "another action to taunt the opponent which can counter taunt with proper thing"; user: "Insult duel"
- Interpretation: 🗯️ offers 3 insults drawn from 8 (original, pasta-themed lines); the chosen insult goes to the opponent: in a match, the player whose sauce you are after; in solo, the guardian. The taunted player sees the insult and 3 comebacks (its own comeback and 2 others) and has 5 s to pick: its own comeback wins the duel for the taunted player; another or none, for the taunter. In a match the server referees (it alone decides the winner, after the deadline). One duel at a time per player
- Questions: none
- Covered by: D-duel, D-server-duel
- Status: designed

## AC5: The winner forces a penalty on the loser
- Source: "The one who wins can for example force the other to do one negative thing (showing a peg, give some life etc.."; user: show a peg, give life, scrambled palette, upside-down screen
- Interpretation: one penalty is drawn at random and shown to both: 🔍 a peg of the sauce the winner is after is shown to the winner for 3 s (when the taunter wins, that is the loser's own sauce); ❤️ the loser gives 2 life to the winner; 🌀 the loser's palette lies for 10 s (tapping or dragging a colour places another one); 🙃 the loser's screen is upside down for 8 s. In solo, the guardian as loser suffers a shown peg of the secret, gives the player 2 life, or is dizzy (looks away for 4 s, replacing the palette and the screen it has not got); the player as loser gives 2 life (to nobody), gets the lying palette or the upside-down screen (no sauce to show)
- Questions: none
- Covered by: D-penalties
- Status: designed

## AC6: The guardian taunts too (solo)
- Source: user: "In solo, the guardian taunts you now and then"
- Interpretation: in a solo game the guardian taunts the player every 40 to 70 s (never while another duel is open); the player answers as in AC4
- Questions: none
- Covered by: D-duel
- Status: designed

## AC7: Bots duel too
- Source: user: "Bots answer too, often wrong"
- Interpretation: a test bot taunted answers after 1.5 to 4 s, with its insult's own comeback 2 times in 5; a bot taunts its target every 35 to 60 s, so a lone tester can practise the comebacks
- Questions: none
- Covered by: D-server-duel, SauceBot
- Status: designed

## Discrepancies

None.
