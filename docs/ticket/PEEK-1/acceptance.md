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
- Evidence: won / lost / rejects guesses / secret shown at the end / hidden while playing: test/application/SubmitGuess.test.ts reds 6-13 (shouldBeWon_whenGuessEqualsSecret, shouldKeepPlaying_whenGuessMisses, shouldCountAttemptsLeft_whenGuessPlayed, shouldBeLost_whenTenthGuessMisses, shouldRejectGuess_whenGameIsOver, shouldRejectGuess_whenGameIsLost, shouldRevealSecret_whenGameIsOver, shouldHideSecret_whenPlaying), full build 15 passed, tsc clean. "A new game can be started": no red possible (StartGame already saves a new game); guard 13 is not evidence (kenji-reviewer, blocking) — proven instead by the browser check e2e/ac1-ac2.spec.js "AC2: losing reveals the secret, and a new game starts fresh", passed on the web build (Pixel 7 viewport)
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
- Evidence: test/application/PeekSecret.test.ts reds — shouldRevealColour_whenPeekingWhileDistracted, shouldBeCaught_whenPeekingWhileWatched, shouldBeCaught_whenPeekingAfterDistractionEnds, shouldCostOneAttempt_whenCaught, shouldRejectPeek_whenGameIsOver, shouldKeepPenalty_whenGuessingAfterBeingCaught (guards 18 and 19 are not evidence); full build 25 passed, tsc clean. "Which can lose the game": browser check e2e/ac4.spec.js "getting caught on every attempt loses the game, which then rejects peeks"; with "a peek while the guardian looks away shows the colour briefly", "a peek while the guardian watches is caught and costs one attempt", "a peek after the guardian looks back is caught": all passed on the web build, Playwright clock
- Status: verified

## AC5: Shake to distract
- Source: "(or perform a strange gesture on the mobile)"
- Interpretation: shaking the phone (three strong jolts within one second)
  distracts the guardian the same way as pointing.
- Questions: none
- Covered by: D-guardian, D-structure (isShake, useShake, DistractGuardian)
- Evidence: supports only — test/domain/shake.test.ts: shouldNotDetectShake_whenPhoneIsStill, shouldDetectShake_whenThreeJoltsWithinOneSecond, shouldNotDetectShake_whenJoltsAreTooFarApart, shouldNotDetectShake_whenOnlyTwoJolts, shouldDetectShake_whenBurstFollowsLoneJolt, shouldNotDetectShake_whenOneLongBump (full build 31 passed, tsc clean). The AC itself needs a manual check on the phone (no accelerometer on the web build): pending, by the user — (1) shake the phone three times quickly: the guardian looks away; (2) one hard bump: it does not
- Status: designed

## Discrepancies

None.
