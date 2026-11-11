# PEEK-3: acceptance criteria

## AC1: Everyone hides a sauce and attacks another's
- Source: "we have to guess the secret of the others"
- Interpretation: each player picks a secret in the room (random by default) and, in the match, guesses the secret of the next seat, while the previous seat guesses theirs
- Evidence: test/application/Steal.test.ts shouldAttackTheNextSeat_whenMatchStarts, shouldGuessTheTargetSecret; e2e/steal.spec.js (three players, real room, a sauce changed just before the start)
- Status: verified

## AC2: The switch
- Source: "there must at a moment some kind of switch to change the person's we are fighting"; user: timer and on crack
- Interpretation: every 45 s (3 s warning) and right after a crack, the circle turns for everyone; guesses on a rival come back with them; two players: no switch
- Evidence: Steal.test.ts shouldTurnTheCircleForEveryone_after45Seconds, shouldWaitForTheHost_toTurnTheCircle, shouldWarnBeforeTheSwitch, shouldKeepGuesses_whenTheCircleComesBack, shouldNotSwitch_withTwoPlayers, shouldScoreAndSwitchEveryone_whenTargetCracked, shouldSwitchOnCrack_whenANonHostCracks; e2e/steal.spec.js
- Status: verified

## AC3: Points
- Source: user's choice "Points"
- Interpretation: a crack scores +1 and the cracked player gets a new random sauce; a knock-out (life 0) costs a point and refills life; most points after 5 minutes wins
- Evidence: Steal.test.ts shouldDrawANewSecret_whenRobbed, shouldFaceTheNewSecret_whenTheCircleComesBackToTheRobbed, shouldKeepFacingTheSameRival_withANewSecret_withTwoPlayers, shouldLoseAPointAndGetLifeBack_whenKnockedOut, shouldEndAfterFiveMinutes_withTheTopScorerWinning, shouldRejectGuesses_whenTheMatchIsOver; e2e/steal.spec.js (scores on every page, "Your sauce was stolen")
- Status: verified

## AC4: Defending
- Interpretation: a player sees who is after its sauce and their best right-place count; 😈 throws at that attacker
- Evidence: Steal.test.ts shouldShowTheAttackerProgress_onMySecret, shouldThrowAtMyAttacker_whenSabotageCollected; e2e/steal.spec.js (defence line)
- Status: verified

## AC5: The server holds the truth
- Source: "So supabase hold the truth in terms of data but also handle real time messaging ?" then "Yes, apply all"
- Interpretation: no phone can read another player's sauce; the server scores every guess, keeps the points and turns the circle; a phone only knows its own sauce
- Evidence: supabase/tests/steal_the_sauce.sql (sauces unreadable, host-only start, scoring, crack, peek pace, strangers refused, timed switch, anon refused: ALL CHECKS PASSED); test/application/Steal.test.ts shouldKnowOnlyItsOwnSauce and the 22 other tests against the in-memory rules; test/application/RoomPlay.test.ts shouldNotShowTheSauce_toTheRoom; e2e/steal.spec.js on the real project
- Status: verified

## Discrepancies

None.
