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
  returns its colour (it stays up until the player flips it back: AC20); peeking while it watches is caught and costs one
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
- Interpretation: a peeked peg turns over with an animation, and turns back when the player taps it (amended by AC20: was "after 400 ms or as soon as the guardian looks back"; a peg left up when the guardian looks back now gets the player caught)
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
- Interpretation: right colour in the right place is a green dot, right colour in the wrong place a yellow dot (white-ringed, so they don't read as pegs), with a legend under the status line; the four marks in one line beside the guess, not a 2×2 square; marks are emoji, ✅ right place and 🔄 wrong place, an empty ring for nothing (user) (amended by AC31: two numbers instead of a line of marks)
- Questions: none
- Covered by: src/ui/Feedback.tsx (Feedback, FeedbackLegend)
- Evidence: browser checks still green (11 passed; AC1's feedback check reads the same labels); look on the phone: by the user, pending
- Status: verified

## Round 2 (user, during the yolo run): the guardian becomes an enemy

Source for AC10-AC14, verbatim: "I would like to change the try count. It should be a life bar. Before cheating again there must be a cooling bar. Being caught decrease the count bar. We must have a time limit for the game. Now an random item can be display on the screen. If "present" it will be a random thing. I suggest the following items, some food to regain life. Smoke bomb to blind the enemy. Etc.. if you have more idea. A "x ray glass" to see a peg randomly. Treat the opponent like an ennemy, he can attack us and we must use a shield to protect (you can drag the shield)."
Order: AC10, AC11, AC12, AC14, AC13; then AC15 (user, after playing); then AC16, AC18, AC17 (user, round 4: AC18's punch and AC16's fall are rules, AC17 the screen); then AC19 (user, round 5); then AC21, AC20 (user, round 6); then AC22, AC23 (user, round 7, screen only); then AC24, AC25 (user, round 8, screen only); then AC28, AC29, AC26, AC27 (user, round 9: the rules first, then the screen); then AC30 (user, round 10, screen only); then AC31 (user, round 11, screen only) (AC11-AC14 spend or restore life; AC13's items act on AC11, AC12 and AC14)

## AC10: Life bar instead of attempts
- Source: "change the try count. It should be a life bar ... Being caught decrease the count bar."
- Interpretation: the player starts with 10 life points, shown as a bar; a guess that does not win costs 1, being caught peeking costs 2; at 0 the game is lost (replaces attempts: AC2's "10 attempts" and AC4's "costs one attempt" now read through life)
- Questions: none
- Covered by: D-life (round 2)
- Evidence: reds 28-33 — StartGame.shouldStartWithTenLife_whenGameStarts, SubmitGuess.shouldLoseOneLife_whenGuessMisses, SubmitGuess.shouldKeepLife_whenGuessWins, PeekSecret.shouldLoseTwoLife_whenCaught, PeekSecret.shouldBeLost_whenCaughtWithTwoLifeLeft, PeekSecret.shouldStopLifeAtZero_whenCaughtWithOneLifeLeft; full build `npx jest && npx tsc --noEmit`: 34 passed, tsc clean. "Shown as a bar": browser check e2e/ac10.spec.js "AC10: the life bar starts full, a missed guess costs 1 and being caught costs 2" passed on the web build (12 passed). The bar's fill is not machine-checked (the check reads its label): the look, by the user, pending; kenji-reviewer: 5 minor, none blocking
- Status: verified

## AC11: Cheat cooldown bar
- Source: "Before cheating again there must be a cooling bar."
- Interpretation: after a peek (revealed or caught), peeking is unavailable for 5 s, shown as a bar refilling; a peek during the cooldown is rejected (amended by AC19: it no longer "costs nothing": the guardian throws a punch, which costs 1 life unless parried)
- Questions: none
- Covered by: D-cooldown (round 2)
- Evidence: reds 34-38 — PeekSecret.shouldRejectPeek_whenPeekedJustBefore, shouldRejectPeek_justBeforeCooldownEnds, shouldRejectPeek_whenCaughtJustBefore, shouldStartCooldown_whenPeekRevealed, shouldStartCooldown_whenCaught (guards 35 shouldAllowPeek_whenCooldownHasPassed and 36 shouldCostNothing_whenPeekRejectedDuringCooldown are not evidence); full build `npx jest && npx tsc --noEmit`: 41 passed, tsc clean. "Shown as a bar refilling": browser checks e2e/ac11.spec.js "after a peek the cooldown bar refills for 5 s, and a peek meanwhile is refused at no cost" (caught path) and "a revealed peek starts the cooldown too", passed on the web build (14 passed), Playwright clock; the bar's look, by the user, pending; kenji-reviewer: 6 minor, none blocking. Round 5 (AC19): the refused peek now throws a punch: the check is renamed "a peek meanwhile is refused (its punch parried, nothing lost)" and parries it; still passing (34 passed)
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
- Evidence: reds 48-73 through Tick and CollectItem (test/application/Tick.test.ts): item shown, gone after 4 s, kept the same while shown, not shown again once collected, another after one leaves or is collected; food +3 and capped (maxLife 10 in the view); collect rejected when gone, twice, or after the game; smoke blinds (safe peeks, no cooldown, reported cooldownMs 0), still blind when pointing during it; x-ray reveals a hidden peg, then a still-hidden one, nothing when all are shown; hourglass +30 s; charm blocks the next attack only, reported as blocked; present gives another item and names it; landing outcome hit/blocked in Tick's response (guards 59: sight back after 4 s, no attack while blind); full build `npx jest && npx tsc --noEmit`: 82 passed, tsc clean. Screen: browser checks e2e/ac13.spec.js (an item appears for 4 s then goes; food; smoke; x-ray; hourglass; charm; present), Math.random fixed per check, Playwright clock: 26 passed (twice at the first run). kenji-reviewer: 1 blocking (a tap shortened the smoke) fixed by red 71, re-review PASS; open minors: the screen times the smoke and guesses blind/charmed, CollectItem ignores the item id (always 0), the CollectItem tests live in Tick.test.ts, the game-over and all-revealed cases are unit-tested only. The feel on the phone, by the user, pending
- Status: verified

## AC14: The guardian attacks, the shield protects
- Source: "Treat the opponent like an ennemy, he can attack us and we must use a shield to protect (you can drag the shield)."
- Interpretation: every 10 to 20 s the guardian throws a meatball at one of 3 lanes along the bottom; it falls for 1.5 s (amended by AC15 then AC16, was "a 1 s warning"), its lane no longer marked (AC16); if the shield, which follows the player's finger left and right along the bottom (amended by AC15, was "drags left and right"), is not in that lane when it lands, the player loses 2 life; the guardian does not attack while blind or distracted
- Questions: none
- Covered by: D-attack (round 2)
- Evidence: reds 43-47 — Tick.shouldWarnOfAttack_whenAttackTimeComes, shouldHitPlayer_whenShieldIsNotInLane, shouldBlockAttack_whenShieldIsInLane, shouldHitOnlyOnce_whenAttackLands, shouldNotAttack_whenGuardianIsDistracted (guards shouldNotWarn_beforeAttackTime, shouldWaitRandomDelay_beforeAttacking, shouldAttackAgain_afterLanding are not evidence); full build `npx jest && npx tsc --noEmit`: 54 passed, tsc clean. Screen: browser checks e2e/ac14.spec.js "the guardian winds up on a lane, and the shield in that lane blocks the meatball", "a meatball landing outside the shield costs 2 life", "the shield can be dragged from lane to lane", "tapping the shield moves nothing else: the guardian keeps watching", passed on the web build (19 passed, twice). Not attacking while distracted: unit test only. A tap on a lane also moves the shield (not asked; the checks use it because a drag under the fake clock hangs; the drag is checked without it). "Blind" comes with AC13. kenji-reviewer: 4 minor, none blocking; the feel of the drag on the phone, by the user, pending
- Status: verified

## AC15: The meatball falls to the player at the bottom (user, after playing round 2)
- Source: "Attacks from the ennemy are very fast. Can't we do something coming from top going to bottom. Our \"life\" is at the bottom. Shield could be dragged like real shield to be more realistic" (user); answer: the shield follows the finger sideways
- Interpretation: the guardian's meatball falls from the guardian (top) down to the player's zone at the bottom of the screen over 2.5 s (was a 1 s warning), in its lane; the player's zone holds the shield and the life bar; the shield follows the finger smoothly left and right (no jumping between boxes) and blocks when it stands over the meatball's lane as it lands (changes AC14's "1 s warning" and "drags along the bottom")
- Questions: none (asked: which reveal was invisible -> the x-ray peg, a bug of AC13; how the shield moves -> sideways with the finger)
- Covered by: D-attack (wind-up 2500 ms), the screen
- Evidence: red 74 (shouldWarnOfAttack_whenAttackTimeComes expects landsInMs 2500, after the make-room refactors 73 and 73 (b)); full build: 82 passed, tsc clean. Browser checks e2e/ac14.spec.js "AC15: the meatball falls from the guardian down to the player's zone, and takes 2.5 s", "AC15: the player's zone (shield and life bar) is at the bottom of the screen", "AC15: the shield follows the finger smoothly, between the lanes too": 29 passed (twice), Playwright clock. Blocking is by the lane under the shield's centre (rules unchanged). kenji-reviewer: 1 blocking (no check of the follow) fixed, re-review PASS; open minors: the 3 lanes repeated in the UI, tapping a lane still jumps the shield (AC14 extra), the ground measured at the throw only, loose "near the ground" bound. Same run: the x-ray peg stuck squeezed after its flip (AC13 bug, also hit AC6's flip) fixed in src/ui/SecretPeg.tsx; the AC6 and AC13 checks now assert the peg is visible (they fail on the old flip). The feel on the phone, by the user, pending
- Status: verified

## AC16: A faster meatball with no target shown (user, round 4)
- Source: "Meet ball can be faster and we must not see the target location (too easy)."
- Interpretation: the meatball falls in 1.5 s (was 2.5 s) and its lane is no longer marked; the player reads it from the falling meatball (amends AC14 and AC15)
- Questions: none
- Covered by: D-attack (wind-up 1500 ms), the screen
- Evidence: red 75 (shouldWarnOfAttack_whenAttackTimeComes expects landsInMs 1500); browser checks e2e/ac16-ac18.spec.js "AC16: no target is shown where the meatball will land" and e2e/ac14.spec.js "AC15: the meatball falls ... and takes 1.5 s"; full build 85 passed, tsc clean; e2e 32 passed (twice); kenji-reviewer PASS
- Status: verified

## AC17: A tap on a peg is a peek, never a distraction (user, round 4)
- Source: "We cannot be caught when cheating (i tap and the peg self flip back itself)."
- Interpretation: tapping a hidden peg while the guardian watches gets the player caught; on the phone the same tap also reached the scene and distracted the guardian first (reading of the orchestrator: not reproducible on the web build), so a tap on a peg, the controls, the items or the shield never distracts
- Questions: none (the cause on the phone is an assumption, to confirm by the user)
- Covered by: the screen (GameScreen)
- Evidence: already met on the web build: e2e/ac16-ac18.spec.js "AC17: tapping a peg while the guardian watches gets you caught, and never distracts it" passed, and it passed before the fix too, so it does not prove the fix. The fix (taps inside the pegs, controls, items and shield never distract, src/ui/GameScreen.tsx touchedControl) is defensive and unproven on the phone; side effect: a scene tap within 600 ms after a control touch does not distract. Manual check by the user, pending: with the guardian watching, tap a hidden peg: "Caught peeking! −2 life", the peg stays hidden
- Status: designed (pending the user's phone check)

## AC18: Distracting can fail, and the guardian punches (user, round 4)
- Source: "sometimes, distracting should fail and in place you can be attacked by a punch for example."
- Interpretation: one distraction in four fails: the guardian keeps watching and throws a punch at a lane (amended by AC19: was "punches the player for 1 life" at once; the punch is now parried by the shield in its lane, else costs 1 life)
- Questions: none
- Covered by: D-guardian (DistractGuardian draws luck from a RandomSource)
- Evidence: red 76 DistractGuardian.shouldPunchPlayer_whenDistractionFails, red 77 shouldNotPunch_whenGameIsOver, guard 76 PeekSecret.shouldBeCaught_whenPeekingAfterBeingPunched; browser check e2e/ac16-ac18.spec.js "AC18: pointing fails: the guardian keeps watching and punches for 1 life" (luck fixed to 0); full build 85 passed. Round 5 (AC19): red 80 changed shouldPunchPlayer_whenDistractionFails to a thrown punch (view life 10, punch lane 0, 700 ms); the browser check renamed "pointing fails: the guardian keeps watching and throws a punch, 1 life if not parried": 34 passed. The rate one in four is the plan's value and is pinned by no test (ScriptedRandomSource ignores bounds); kenji-reviewer: minor notes only
- Status: verified

## AC19: Peeking during the cooldown gets a fast punch you can parry (user, round 5)
- Source: "now trying to peek when cool down is note must make the ennemy punch us, we can parry but punch is fast"
- Interpretation: a peek during the cooldown is still refused, and the guardian throws a punch at one of the 3 lanes that lands in 0.7 s (amended by AC21: 0.45 s); the shield in that lane parries it, otherwise it costs 1 life; the punch of a failed distraction (AC18) becomes the same parryable punch (amends AC11 "costs nothing" and AC18 "punches for 1 life" at once); no punch while a meatball or a punch is already on its way
- Questions: none
- Covered by: D-attack (an attack is a meatball or a punch), PeekSecret and DistractGuardian throw the punch, Tick lands it
- Evidence: reds 78-83 — PeekSecret.shouldThrowPunch_whenPeekingDuringCooldown, Tick.shouldCostOneLife_whenPunchIsNotParried, DistractGuardian.shouldPunchPlayer_whenDistractionFails (changed), Tick.shouldNotThrowPunch_whenMeatballIsFalling, DistractGuardian.shouldNotThrowPunch_whenMeatballIsFalling, Tick.shouldWaitToThrowMeatball_whilePunchIsFlying (guard 79 shouldParryPunch_whenShieldIsInItsLane is not evidence); full build 91 passed, tsc clean. Browser checks e2e/ac19.spec.js "peeking during the cooldown throws a fast punch, parried by the shield in its lane" and "a punch not parried costs 1 life, and it is fast (gone within 0.8 s)": 34 passed (twice), Playwright clock. kenji-reviewer: 1 blocking (records not amended) fixed; open minors: a failed distraction while an attack flies answers 'punched' with no punch (a misleading name), the screen was changed before its checks were written. The feel on the phone, by the user, pending
- Status: verified

## AC20: The player flips a peeked peg back by hand (user, round 6)
- Source: "For the peeking we must flip back, it must not be automatically, it does not make sense otherwise."
- Interpretation: a revealed peg stays turned up until the player taps it again to flip it back; if the guardian watches again (its distraction or the smoke ends) while a peg is still up, the player is caught: 2 life, the peg goes back down and the cooldown starts; one peg up at a time (a peek at another peg is refused, at no cost) (amends AC6 "turns back after 400 ms or as soon as the guardian looks back" and AC4's "shows the colour briefly")
- Questions: none (reading of the orchestrator: being caught with a peg up is what makes the hand flip-back matter)
- Covered by: D-peek (round 6): the Session holds the peg that is up; HidePeg flips it back; Tick catches a peg left up under the guardian's eyes; the view shows the peg up
- Evidence: reds 85-89 — Tick.shouldKeepPegUp_whenPeekRevealed, Tick.shouldFlipPegBack_whenTappedAgain, Tick.shouldCatchPlayer_whenGuardianLooksBackWithPegUp, Tick.shouldStartCooldown_whenCaughtWithPegUp, Tick.shouldRefusePeek_whileAnotherPegIsUp (guard 89 shouldNotCatchPlayer_whenPegFlippedBackInTime is not evidence); red 89 (fix) changed two older tests to the one-peg rule; full build 97 passed, tsc clean. Browser checks e2e/ac6-ac8.spec.js "AC6: ... turns back when the player taps it", "AC20: a peg left up when the guardian looks back gets the player caught", "AC20: a game that ends with a peg up starts the next one clean" (fails without the fix of the review's blocking finding), "AC20: one peg up at a time"; e2e/ac4.spec.js amended: 36 passed (twice). kenji-reviewer: 1 blocking (a false caught after a new game) fixed; open minors: HidePeg ignores its index and never answers 'not-up'
- Status: verified

## AC21: A faster punch (user, round 6)
- Source: "Can the punch be faster ?"
- Interpretation: the punch lands in 0.45 s (was 0.7 s) (amends AC19)
- Questions: none
- Covered by: D-punch
- Evidence: red 84 (shouldThrowPunch_whenPeekingDuringCooldown expects landsInMs 450, after the make-room refactors 83 and 84); full build 97 passed; kenji-reviewer PASS
- Status: verified

## AC22: Drag a colour onto the slot you choose (user, round 7)
- Source: "To select, I want a drag and drop from my color to the target. This gives the ability to choose how I place the pawns."
- Interpretation: dragging a colour from the palette and dropping it on one of the four guess slots puts that colour in that slot (replacing what was there); a drop outside the slots changes nothing; a tap on a colour still fills the first empty slot
- Questions: none
- Covered by: the screen (no game rule: the guess being built is the screen's)
- Evidence: browser checks e2e/ac22-ac23.spec.js "a colour dragged onto a slot lands in that slot, the others stay empty" (mouse), "the same drag with a finger (touch events, as on the phone)" (touch through the browser's touch events), "dropping on a filled slot replaces its colour; a drop outside the slots changes nothing": 40 passed; an interrupted drag places nothing. kenji-reviewer: PASS with minors. The feel on the phone, by the user, pending
- Status: verified

## AC23: The punch is a boxing glove on an arm that comes back (user, round 7)
- Source: "Can the punch has a kind of \"extensible thing\" attached to the punch gant, it must go back to the ennemy like a boxer."
- Interpretation: the punch is drawn as a glove on an arm stretching from the guardian to its lane while it flies (0.45 s), and the arm pulls the glove back to the guardian once it has landed (in 0.3 s, the orchestrator's number)
- Questions: none
- Covered by: the screen (the punch's rules are unchanged)
- Evidence: browser check e2e/ac22-ac23.spec.js "the punch is a glove on an arm that stretches to its lane, then goes back to the guardian" (the arm stretched in flight, the glove halfway home 0.15 s after landing, gone after its return): 40 passed, three times in a row. It proves the arm and the return, not their timing (the 0.45 s flight is AC21's red 84). kenji-reviewer: PASS with minors
- Status: verified

## AC24: The punch arm is a zig-zag spring, and the glove comes at the player (user, round 8)
- Source: "Can it be a zig zag thing which extends with the punch (like in inspecteurgadget)? Punch must be towards us (verd moi)."
- Interpretation: the arm is a zig-zag spring that unfolds as it stretches and folds back as it returns (a generic spring arm, not a cartoon character's); the glove grows as it comes, as if punching the player through the screen; it still aims at a lane, so the shield still parries it (amends AC23's arm)
- Questions: none
- Covered by: the screen (src/ui/PunchArm.tsx)
- Evidence: browser check e2e/ac24-ac25.spec.js "the punch arm is a zig-zag spring, and the glove grows as it comes at the player" (the arm is a zig-zag line that unfolds down the screen and folds back after landing; the glove more than 1.8 times wider at full reach): 42 passed. kenji-reviewer: minor findings, the unfold now asserted. The look on the phone, by the user, pending (a confirmation, as for the earlier screen ACs)
- Status: verified

## AC25: Caught, the guardian laughs and points at the player (user, round 8)
- Source: "When caught the enemy must laugh and raise a finger to me (the real me which is holding the phone)"
- Interpretation: when the player is caught peeking, the guardian laughs (squinting eyes, open mouth, "HA HA HA!") and points its finger out of the screen at the player (🫵, the reading of the orchestrator: a mocking point, not a rude gesture), for as long as the "Caught peeking" line shows (1.5 s)
- Questions: open, for the user: is the pointing finger 🫵 the gesture meant by "raise a finger to me"? (assumption of the orchestrator)
- Covered by: the screen (src/ui/Guardian.tsx)
- Evidence: browser check e2e/ac24-ac25.spec.js "when the player is caught, the guardian laughs and points at them, then calms down" (the laugh and the finger shown, still shown at 1.4 s, gone at 1.6 s): 42 passed. The squinting eyes and open mouth are the look, not checked; kenji-reviewer: minor findings only
- Status: designed (pending the user's answer on the gesture)

## AC26: Item animations (user, round 9)
- Source: "Can we improve the items animation ? Blinding can be like smoke grenade., shield can be a green laser protecting us. The glasses can launch a laser beam to a peg."
- Interpretation: the smoke bomb is thrown as a grenade at the guardian and a smoke cloud covers it while it is blind; the shield charm shows a green laser wall across the player's zone until it is used; the x-ray glasses fire a laser beam from where they were picked up to the revealed peg
- Questions: none
- Covered by: the screen
- Evidence: browser checks e2e/ac26-ac29.spec.js "the x-ray glasses fire a beam that ends on the peg they reveal", "the smoke grenade leaves a cloud over the guardian", and e2e/ac13.spec.js's charm check (the green laser shows): 48 passed, three times. Not checked by a browser check: the grenade's flight (only its cloud), the laser going away once the charm is used. kenji-reviewer: minor findings only. The look on the phone, by the user, pending
- Status: verified

## AC27: A smoother life bar that shows what was lost (user, round 9)
- Source: "Lifebar can be smoother, when you lose some life, the life you lose should blink a little to make it visible. Like in most fighting game."
- Interpretation: the life bar slides to its new length; the part just lost stays visible a moment and blinks before it shrinks away
- Questions: none
- Covered by: the screen (LifeBar)
- Evidence: browser check e2e/ac26-ac29.spec.js "the life just lost blinks in the bar before it goes" (the lost part appears, then goes, the life ends at 8): 48 passed. The slide and the blink themselves are the look, not checked. kenji-reviewer: minor
- Status: verified

## AC28: A bomb that explodes if left (user, round 9)
- Source: "Need some negative items ... A bomb make you loose life after explosion."
- Interpretation: a 💣 bomb can appear like an item; if it is still there when its 4 s end, it explodes and costs 2 life; tapping it before throws it away (no cost); a present can also turn into a bomb, which explodes at once (2 life)
- Questions: none
- Covered by: D-items (round 9)
- Evidence: red 90 Tick.shouldExplode_whenBombIsLeftOnField, red 93 Tick.shouldExplodeAtOnce_whenPresentGivesBomb (guard 90 shouldNotExplode_whenBombIsTappedAway is not evidence); full build 102 passed, tsc clean. Browser checks e2e/ac26-ac29.spec.js "a bomb left on the field explodes when its 4 s end: 2 life" and "a bomb tapped in time is thrown away" (which found a screen bug: a thrown-away bomb showed an explosion, fixed): 48 passed. The present's bomb is unit-tested only. kenji-reviewer: minor
- Status: verified

## AC29: Darkness blinds the player (user, round 9)
- Source: "Need some negative items. You can be blind too and dont see what you are doing."
- Interpretation: a present can turn into 🌑 darkness: for 4 s the player is blind: a dark veil covers the secret pegs, the board and the guess being built (the controls still work)
- Questions: none
- Covered by: D-items (round 9), the screen
- Evidence: red 91 Tick.shouldBlindPlayer_whenPresentGivesDarkness, red 92 Tick.shouldSeeAgain_afterFourSecondsOfDarkness; browser checks e2e/ac26-ac29.spec.js "darkness veils the game for 4 s, then the player sees again" and e2e/ac13.spec.js's present check: 48 passed. kenji-reviewer: minor
- Status: verified

## AC30: The newest guesses stay on screen (user, round 10)
- Source: "After multiple attempts I cannot see the last attempt. Oldest can disappear for readability. We can keep 10 or less visible depending on space we have"
- Interpretation: the history shows the most recent guesses that fit in its space, 10 at most, the oldest dropped first, so the last guess is always visible; each row shows its number (#1, #2...) so a dropped guess is not confused
- Questions: none
- Covered by: the screen (GameScreen, turnsThatFit)
- Evidence: browser check e2e/ac30.spec.js "after many guesses the newest is always on screen; the oldest give way, 10 at most" (fails on the old scrolling list: the 9th guess was out of view); 49 passed (twice); a phone-sized screen shows guesses #5-#9. kenji-reviewer: PASS, 2 minor open: the 10 cap is not exercised (life ends a game by the 10th miss on the checked phone size), the fit count assumes a 38 px row
- Status: verified

## AC31: The result as two numbers, not a line of marks (user, round 11)
- Source: "Ok so display as a line can be confusing. Maybe we can add a number instead no ?"
- Interpretation: each guess shows ✅ and a number (pegs of the right colour in the right place) and 🔄 and a number (right colour, wrong place); a zero is greyed out; nothing points to a position (amends AC9's line of marks)
- Questions: none
- Covered by: the screen (Feedback)
- Evidence: browser check e2e/ac31.spec.js "each guess shows two numbers" (✅2 🔄0 for orange orange red red against orange x4); the AC1 check reads the same counts; 50 passed (twice). Before this change, a hand check of 20 guesses in 4 games and of the user's screenshot (7 guesses) showed the counts right: the line was misread as positions. kenji-reviewer: minor only; the grey zero is the look, by the user, pending (a confirmation, as for the earlier screen ACs)
- Status: verified

## Discrepancies

None.
