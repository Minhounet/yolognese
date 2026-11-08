# PEEK-1: acceptance criteria

Order: AC1, AC2, AC3, AC4, AC5 (AC2 needs AC1's game; AC4 needs AC3's guardian; AC5 reuses AC3's distraction)

There is no ticket: each Source quotes the user's request, and the
Interpretation is the orchestrator's (yolo), logged in the decision log.

## AC1: Guess feedback
- Source: "a simple master mind game"
- Interpretation: submitting a guess of 4 colours returns, for that guess,
  the number of pegs of the right colour in the right place and the number
  of the right colour in the wrong place, each colour counted at most as
  often as it appears in the secret; the guesses played stay listed.
- Questions: none
- Covered by: D-rules, D-structure (SubmitGuess)
- Evidence: browser check e2e/ac1-ac2.spec.js "AC1: a guess shows exact and misplaced feedback and stays listed" passed on the web build; test/application/SubmitGuess.test.ts — shouldReportFourExact_whenGuessEqualsSecret, shouldReportNothing_whenGuessSharesNoColour, shouldReportMisplaced_whenColoursAreInWrongPlaces, shouldCountColourOnce_whenSecretHoldsItOnce, shouldListGuessesInOrder_whenTwoGuessesPlayed (guard: shouldMatchRepeatedColour_whenSecretHoldsItTwice); full build `npx jest && npx tsc --noEmit`: 6 passed, tsc clean; kenji-reviewer: 6 minor, none blocking
- Status: verified

## AC2: End of game
- Source: "a simple master mind game"
- Interpretation: the game is won when a guess has 4 right-place pegs and
  lost when no attempt is left (10); a finished game rejects guesses and
  shows the secret; a new game can be started.
- Questions: none
- Covered by: D-rules, D-structure (StartGame, SubmitGuess, GameMapper)
- Evidence: won / lost / rejects guesses / secret shown at the end / hidden while playing: test/application/SubmitGuess.test.ts reds 6-13 (shouldBeWon_whenGuessEqualsSecret, shouldKeepPlaying_whenGuessMisses, shouldCountAttemptsLeft_whenGuessPlayed, shouldBeLost_whenTenthGuessMisses, shouldRejectGuess_whenGameIsOver, shouldRejectGuess_whenGameIsLost, shouldRevealSecret_whenGameIsOver, shouldHideSecret_whenPlaying), full build 15 passed, tsc clean. "A new game can be started": no red possible (StartGame already saves a new game); guard 13 is not evidence (kenji-reviewer, blocking) — proven instead by the browser check e2e/ac1-ac2.spec.js "AC2: losing reveals the secret, and a new game starts fresh", passed on the web build (Pixel 7 viewport). Round 2 (AC10): attempts became life; shouldCountAttemptsLeft_whenGuessPlayed removed (same case as red 29), shouldBeLost_whenTenthGuessMisses and guard 13 read life; the browser check reads the life bar — still passing
- Status: verified

## AC3: Point to distract the guardian
- Source: "If you point somewhere ..., the eyes can follow"
- Interpretation: pointing at a spot (a tap) makes the guardian's eyes look
  at that spot, and the guardian stays distracted for 1500 ms, then watches
  again.
- Questions: none
- Covered by: D-guardian, D-structure (DistractGuardian, Clock)
- Evidence: test/application/DistractGuardian.test.ts — shouldLookAtTarget_whenPointedAt, shouldStayDistractedFor1500Ms_whenPointedAt (full build 17 passed, tsc clean); browser check e2e/ac3.spec.js "AC3: pointing makes the guardian look at the spot for 1.5 s, then it watches again" passed on the web build, time driven by Playwright's clock (pupils move toward the tap; still away at 1400 ms; watching at 1600 ms). "Then watches again" is a screen timer for now; the domain gets it with AC4 (peeking after 1500 ms is caught)
- Status: verified

## AC4: Peek at a hidden peg
- Source: "then you can watch quickly by turning up the "pawns" to know there color"
- Interpretation: while the guardian is distracted, peeking at a hidden peg
  returns its colour; peeking while it watches is caught and costs one
  attempt (which can lose the game); a finished game rejects peeks.
- Questions: none
- Covered by: D-peek, D-structure (PeekSecret)
- Evidence: test/application/PeekSecret.test.ts reds — shouldRevealColour_whenPeekingWhileDistracted, shouldBeCaught_whenPeekingWhileWatched, shouldBeCaught_whenPeekingAfterDistractionEnds, shouldCostOneAttempt_whenCaught, shouldRejectPeek_whenGameIsOver, shouldKeepPenalty_whenGuessingAfterBeingCaught (guards 18 and 19 are not evidence); full build 25 passed, tsc clean. "Which can lose the game": browser check e2e/ac4.spec.js "getting caught on every attempt loses the game, which then rejects peeks"; with "a peek while the guardian looks away shows the colour briefly", "a peek while the guardian watches is caught and costs one attempt", "a peek after the guardian looks back is caught": all passed on the web build, Playwright clock. Round 2 (AC10) changed the cost to 2 life: shouldCostOneAttempt_whenCaught and guard 19 superseded by reds 31-33 (removed), shouldKeepPenalty_whenGuessingAfterBeingCaught renamed shouldKeepLifeLost_whenGuessingAfterBeingCaught (life 7, mutation checked); browser checks read the life bar — still passing
- Status: verified

## AC5: Shake to distract
- Source: "(or perform a strange gesture on the mobile)"
- Interpretation: shaking the phone (three strong jolts within one second)
  distracts the guardian the same way as pointing.
- Questions: none
- Covered by: D-guardian, D-structure (isShake, useShake, DistractGuardian)
- Evidence: supports only — test/domain/shake.test.ts: shouldNotDetectShake_whenPhoneIsStill, shouldDetectShake_whenThreeJoltsWithinOneSecond, shouldNotDetectShake_whenJoltsAreTooFarApart, shouldNotDetectShake_whenOnlyTwoJolts, shouldDetectShake_whenBurstFollowsLoneJolt, shouldNotDetectShake_whenOneLongBump (full build 31 passed, tsc clean). The AC itself needs a manual check on the phone (no accelerometer on the web build): pending, by the user — (1) shake the phone three times quickly: the guardian looks away; (2) one hard bump: it does not
- Status: waived (shaking opens Expo Go's developer menu, so the gesture cannot work in Expo Go; the screen hook is removed, the tested isShake rule is kept for a standalone build; decided by the user)

## AC6: Quick flip with an animation
- Source: "When flipping back the peg there is a delay, can you check that ? And a better animation could cool during flipping." (user, added during the yolo run)
- Interpretation: a peeked peg turns over with an animation, and turns back after 400 ms or as soon as the guardian looks back, whichever is first
- Questions: none
- Covered by: src/ui/SecretPeg.tsx, GameScreen (PEEK_SHOWN_MS 400, flip back on the guardian's return)
- Evidence: e2e/ac6-ac8.spec.js "AC6: a peeked peg flips back within half a second" (squeezed mid-turn, shown at 200 ms, hidden at 600 ms) and "AC6: a peeked peg flips back as soon as the guardian looks back", passed on the web build, Playwright clock; the feel of the animation on the phone: by the user, pending
- Status: verified

## AC7: Dazed eye colours
- Source: "Color could change during watching away (for the eyes)." (user, added during the yolo run)
- Interpretation: while the guardian looks away, both pupils cycle through colours; they are ink again when it watches
- Questions: none
- Covered by: src/ui/Guardian.tsx
- Evidence: e2e/ac6-ac8.spec.js "AC7: the eyes change colour while the guardian looks away, and come back when it watches", passed on the web build
- Status: verified

## AC8: Dust where the screen is hit
- Source: "And hitting somewhere can make a animation of dust" (user, added during the yolo run)
- Interpretation: a tap on the scene raises a puff of dust at the tap point, gone within half a second
- Questions: none
- Covered by: src/ui/DustPuff.tsx, GameScreen.pointAt
- Evidence: e2e/ac6-ac8.spec.js "AC8: hitting the screen raises a puff of dust where it was hit, which fades", passed on the web build
- Status: verified

## AC9: Feedback colours people already know
- Source: "I dont think that the black white display is intuitive. Green should be right. Yellow can be misplaced." (user, added during the yolo run)
- Interpretation: right colour in the right place is a green dot, right colour in the wrong place a yellow dot (white-ringed, so they don't read as pegs), with a legend under the status line; the four marks in one line beside the guess, not a 2×2 square; marks are emoji, ✅ right place and 🔄 wrong place, an empty ring for nothing (user)
- Questions: none
- Covered by: src/ui/Feedback.tsx (Feedback, FeedbackLegend)
- Evidence: browser checks still green (11 passed; AC1's feedback check reads the same labels); look on the phone: by the user, pending
- Status: verified

## Round 2 (user, during the yolo run): the guardian becomes an enemy

Source for AC10-AC14, verbatim: "I would like to change the try count. It should be a life bar. Before cheating again there must be a cooling bar. Being caught decrease the count bar. We must have a time limit for the game. Now an random item can be display on the screen. If "present" it will be a random thing. I suggest the following items, some food to regain life. Smoke bomb to blind the enemy. Etc.. if you have more idea. A "x ray glass" to see a peg randomly. Treat the opponent like an ennemy, he can attack us and we must use a shield to protect (you can drag the shield)."
Order: AC10, AC11, AC12, AC14, AC13 (AC11-AC14 spend or restore life; AC13's items act on AC11, AC12 and AC14)

## AC10: Life bar instead of attempts
- Source: "change the try count. It should be a life bar ... Being caught decrease the count bar."
- Interpretation: the player starts with 10 life points, shown as a bar; a guess that does not win costs 1, being caught peeking costs 2; at 0 the game is lost (replaces attempts: AC2's "10 attempts" and AC4's "costs one attempt" now read through life)
- Questions: none
- Covered by: D-life (round 2)
- Evidence: reds 28-33 — StartGame.shouldStartWithTenLife_whenGameStarts, SubmitGuess.shouldLoseOneLife_whenGuessMisses, SubmitGuess.shouldKeepLife_whenGuessWins, PeekSecret.shouldLoseTwoLife_whenCaught, PeekSecret.shouldBeLost_whenCaughtWithTwoLifeLeft, PeekSecret.shouldStopLifeAtZero_whenCaughtWithOneLifeLeft; full build `npx jest && npx tsc --noEmit`: 34 passed, tsc clean. "Shown as a bar": browser check e2e/ac10.spec.js "AC10: the life bar starts full, a missed guess costs 1 and being caught costs 2" passed on the web build (12 passed). The bar's fill is not machine-checked (the check reads its label): the look, by the user, pending; kenji-reviewer: 5 minor, none blocking
- Status: verified

## AC11: Cheat cooldown bar
- Source: "Before cheating again there must be a cooling bar."
- Interpretation: after a peek (revealed or caught), peeking is unavailable for 5 s, shown as a bar refilling; a peek during the cooldown is rejected and costs nothing
- Questions: none
- Covered by: D-cooldown (round 2)
- Evidence: reds 34-38 — PeekSecret.shouldRejectPeek_whenPeekedJustBefore, shouldRejectPeek_justBeforeCooldownEnds, shouldRejectPeek_whenCaughtJustBefore, shouldStartCooldown_whenPeekRevealed, shouldStartCooldown_whenCaught (guards 35 shouldAllowPeek_whenCooldownHasPassed and 36 shouldCostNothing_whenPeekRejectedDuringCooldown are not evidence); full build `npx jest && npx tsc --noEmit`: 41 passed, tsc clean. "Shown as a bar refilling": browser checks e2e/ac11.spec.js "after a peek the cooldown bar refills for 5 s, and a peek meanwhile is refused at no cost" (caught path) and "a revealed peek starts the cooldown too", passed on the web build (14 passed), Playwright clock; the bar's look, by the user, pending; kenji-reviewer: 6 minor, none blocking
- Status: verified

## AC12: Time limit
- Source: "We must have a time limit for the game."
- Interpretation: a game lasts 3 minutes, shown as a countdown; at 0 the game is lost and the secret shown
- Questions: none
- Covered by: D-timer (round 2, with the AC12 deviation: Tick is the one judge of time)
- Evidence: reds 39-42 — Tick.shouldCountDownTimeLeft_whenTicked, Tick.shouldBeLost_whenTimeIsUp, Tick.shouldStopTimeAtZero_whenTimeIsUp, Tick.shouldRejectGuess_afterTimeIsUp (guard 41 shouldStayWon_whenTimeRunsOutAfterWinning is not evidence); full build `npx jest && npx tsc --noEmit`: 46 passed, tsc clean. "Shown as a countdown": browser check e2e/ac12.spec.js "a 3 minute countdown, and at 0 the game is lost and the secret shown" passed on the web build (15 passed), Playwright clock (3:00, 1:59, 0:00, Time's up, secret shown); kenji-reviewer: PASS, 2 minor
- Status: verified

## AC13: Random items
- Source: "an random item can be display on the screen. If "present" it will be a random thing ... food to regain life. Smoke bomb to blind the enemy ... A "x ray glass" to see a peg randomly."
- Interpretation: every 8 to 15 s an item appears at a random spot for 4 s; tapping it collects it: 🍝 food +3 life (up to 10); 💨 smoke bomb: the guardian is blind for 4 s (peeks are safe and do not start the cooldown); 👓 x-ray glasses: one random still-hidden peg is revealed for the rest of the game; ⏳ hourglass +30 s on the clock (orchestrator's idea); 🛡️ shield charm: the next attack is blocked whatever the shield's position (orchestrator's idea); 🎁 present: one of the others at random
- Questions: none
- Covered by: D-items (round 2)
- Evidence:
- Status: designed

## AC14: The guardian attacks, the shield protects
- Source: "Treat the opponent like an ennemy, he can attack us and we must use a shield to protect (you can drag the shield)."
- Interpretation: every 10 to 20 s the guardian winds up (a 1 s warning showing the lane it aims at, one of 3 lanes along the bottom) and throws a meatball; if the shield, which the player drags left and right along the bottom, is not in that lane when it lands, the player loses 2 life; the guardian does not attack while blind or distracted
- Questions: none
- Covered by: D-attack (round 2)
- Evidence:
- Status: designed


None.
