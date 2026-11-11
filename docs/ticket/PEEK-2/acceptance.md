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

## AC6: See the others play (round 14)
- Source: "I would like in certain manner see the other person doing that"
- Interpretation: the player sees, live, the latest guesses the rival after its sauce makes on it: the pegs tried and their score (the last three kept, the newest shown)
- Evidence: Steal.test.ts shouldSeeTheAttackersGuesses_onMySauceLive, shouldKeepOnlyTheLatestThreeAttempts; roomWire.test.ts (the attempt in the progress message, optional for an older server); e2e/steal.spec.js "Round 14" (the bot's attempts show)
- Status: verified

## AC7: Ink a rival (round 14)
- Source: "I could counter attack when somebody is blinding me"; user: "The one you're after", "From items"
- Interpretation: in a match the field also shows 🦑 ink (never in solo); tapping it throws ink at the player whose sauce you are after; the server checks the thrower is seated and allows one ink every 10 s; bots throw ink too (every 12-35 s)
- Evidence: Steal.test.ts shouldInkThePlayerWhoseSauceIAmAfter_whenInkCollected, shouldNotShowInk_inASoloGame; SauceBot.test.ts shouldThrowInkAtItsTarget_every12To35Seconds; supabase/tests/steal_the_sauce.sql (ink to the current target, a second within 10 s refused); e2e/steal.spec.js "Round 14"
- Status: verified

## AC8: Rub the ink off (round 14)
- Source: "(I must erase the screen)"; user: "Wipe the screen"
- Interpretation: ink covers the guardian, the secret and the guesses (the row, the palette and the shield stay free); rubbing it with the finger clears it as the finger travels (about five swipes); left alone it fades after 20 s
- Evidence: Steal.test.ts shouldClearTheInk_asItIsWiped, shouldFadeTheInk_after20SecondsEvenIfNotWiped; e2e/steal.spec.js "Round 14" (inked by the bot, rubbed off with drags)
- Status: verified

## Discrepancies

None.
