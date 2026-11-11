# PEEK-2: acceptance criteria

## AC1: Everyone hides a sauce and attacks another's
- Source: "we have to guess the secret of the others"
- Interpretation: each player picks a sauce in the room (random by default) and, in the match, guesses the next seat's sauce while the previous seat guesses theirs
- Evidence: test/application/Steal.test.ts (the circle), RoomPlay.test.ts (lobby, start); e2e/steal.spec.js three phones on the real project
- Status: verified

## AC2: The switch
- Source: "there must at a moment some kind of switch"; user: on a timer and after a crack
- Interpretation: every 45 s (3 s warning) and right after a crack, the circle turns for everyone; guesses on a rival come back with them; two players: no switch
- Evidence: Steal.test.ts the circle block (switch, warning, kept guesses, one sync until answered, a late older state ignored, duel); e2e/steal.spec.js
- Status: verified

## AC3: Points
- Source: the user's choice "Points"
- Interpretation: a crack scores +1 and the robbed player gets a new random sauce; a knock-out costs a point and refills life; most points after 5 minutes wins; time never takes the life
- Evidence: Steal.test.ts cracking and the end blocks; e2e/steal.spec.js (scores on every phone, "Your sauce was stolen")
- Status: verified

## AC4: The server holds the truth
- Source: "So supabase hold the truth in terms of data but also handle real time messaging ?" then "Yes, apply all"
- Interpretation: no phone can read another player's sauce; the server scores every guess, keeps the points and turns the circle
- Evidence: supabase/tests/steal_the_sauce.sql (ALL CHECKS PASSED; fails when a check is broken); Steal.test.ts shouldKnowOnlyItsOwnSauce; RoomPlay.test.ts shouldNotShowTheSauce_toTheRoom; e2e/steal.spec.js
- Status: verified

## AC5: Bots for testing alone
- Source: "I dont have multiple phone here. Can we create bot ? Just for tests it must not be too hard." and "in the application I must be able to make enter bots"
- Interpretation: in the room, the host taps "Add a bot" (up to 6 players); each bot plays like a player of its own on the server, slowly and carelessly
- Evidence: test/application/SauceBot.test.ts, test/domain/botBrain.test.ts, RoomPlay.test.ts test bots block; e2e/steal.spec.js one phone with bots (a 3-player circle; a duel the bot wins)
- Status: verified

## Discrepancies

None.
