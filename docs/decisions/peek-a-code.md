# Decision log: peek-a-code

## Resume
- Status: open
- Mode: build
- Yolo: on (see references/yolo.md of saiban-orchestrator)
- Done: scaffold (Expo SDK 58, TypeScript), structural plan and ACs, AC1, AC2, AC3, AC4 verified; AC5 built and published, waiting for the phone check
- Next: round 2, AC10..AC14 in the order of acceptance.md, in a fresh session (say: resume peek-a-code); also the user's look at the flip (AC6) and the feedback marks (AC9); then the user decides: merge, more features, or keep ideas
- Files: docs/ticket/PEEK-1/, src/

## Start - scope and mode
- Decided: build mode, yolo; ACs from the user's request (no ticket), ticket folder PEEK-1
- Why: something new; the user asked for yolo and good code
- Rejected: think mode first (the user wants to play it)
- Asked user: no (yolo)

## Start - game interpretation
- Decided: original code-breaking game "Yolognese" with a meatball guardian; tap to point distracts it 1500 ms, a shake too; peeking while watched costs one attempt
- Why: closest reading of "the eyes can follow ... turning up the pawns"; a penalty makes cheating a risk, which is the fun
- Rejected: multi-touch hold-to-distract (one-hand phone); a copy of the commercial game (not allowed)
- Asked user: no (yolo)

## Start - launch path
- Decided: `npx eas-cli update --branch feat-peek-a-code` (Expo Go link), web build (`npm run export:web`) as fallback and for the Playwright checks
- Why: the user only has an Android phone
- Rejected: dev server + QR (cannot be scanned from the same phone), tunnel (blocked, dies with the container)
- Asked user: no (yolo)

## Plan - structural plan, AC trace and order
- Decided: plan and ACs in docs/ticket/PEEK-1, order AC1..AC5; approved by the orchestrator
- Why: the structure follows chottomatte-archi (ports for random and time, a use case per operation, views out); each AC traces to a decision
- Rejected: see conception.md "Ruled out"
- Asked user: no (yolo)

## Plan - skills that do not fit TypeScript
- Decided: kanpeki-fp's rules are Vavr/Java; its intent (pure functions, results as values, no mutation) is applied with TypeScript discriminated unions and readonly types. kaizen-refactor's mechanical list is Java syntax; refactor checklists use igiari-tdd rule 6 only.
- Why: no skill holds TypeScript style
- Asked user: no (yolo)
- No skill: TypeScript functional style
- No skill: Expo/React Native app (launch, EAS Update)

## AC1 - TDD plan
- Decided: 5 tests through SubmitGuess (exact, none, misplaced, repeated colour, history); shonin-dev on (5 tests in one run)
- Why: drive the AC at the use-case level from the first test (objection-conception)
- Asked user: no (yolo)

## AC1 - run and review
- Decided: GREEN 1 by shonin-dev rejected (overbuilt: scoring and history ahead of tests 2-5), rewritten minimal by the orchestrator; greens 2-5 by shonin-dev accepted
- Decided: kenji-reviewer minor findings: (1) secret with a repeated colour untested -> guard 5 added, mutation shown; (2) `no-game` branch has no test: strict typing needs it, left, a survivor to a mutation run, open; (3)+(4) super-green misses not counted -> counted below; (5) GameMapper is a module of free functions, not a class with toView -> TypeScript idiom, plan updated, deviation logged; (6) evidence recorded
- Super-green misses: 2 — refactor 3 (green 3 wrote a 113-character filter, named the predicate after), refactor 5 (greens 2-3 exported helpers with no outside caller)
- Deferred refinement notes: none
- Asked user: no (yolo)
- Carry forward: ScriptedRandomSource and startedGame() for AC2's tests; GameView will need status, attempts left and the secret at the end (AC2); the `no-game` rejection may get its test with StartGame in AC2

## AC2 - plan, run and review
- Decided: 7 tests through SubmitGuess + guard 13 (StartGame); fresh shonin-dev; all its greens accepted
- Decided: plan deviation, red 11 shouldRejectGuess_whenGameIsLost added (GREEN 10 only rejected won games)
- Decided: kenji-reviewer blocking finding (new game proven only by a guard) fixed with other evidence: browser check on the web build, not a waiver; minor findings: retro and log entries written here, super-green misses counted
- Super-green misses: 2 — refactor 7 (isWon recomputed exact counts the turn already holds), refactor 9 (MAX_ATTEMPTS exported "for tests": against rule 3)
- Deferred refinement notes: none; open: `no-game` rejection still untested (AC1)
- Asked user: no (yolo)
- Carry forward: GameScreen and the e2e setup for AC3-AC5; the guardian needs Clock in the composition root

## Screen - after AC2, at the user's request
- Decided: build the playable screen before AC3 ("build the screen after AC2 so I can play"); UI without TDD (No skill: React Native screen), proven by Playwright checks on the web build, one per AC
- Asked user: yes (the order); the rest no (yolo)
- No skill: React Native screen

## Publish - EAS Update for Expo Go
- Decided: Expo project @minhounets-team/yolognese (created with the user's token, a robot of that team), runtimeVersion policy `sdkVersion` (exposdk:58.0.0) so Expo Go can load it, channel `feat-peek-a-code` bound to the branch of the same name, environment `preview`
- Why: `eas update:configure` set policy appVersion (1.0.0), which Expo Go cannot load; a channel gives one stable link instead of one per update
- Rejected: development build (needs EAS Build, an APK; Expo Go is enough so far)
- Asked user: no (yolo; private to the user's Expo account, like the feature-branch push)
- Not verified: opening the link in Expo Go on the phone (HUMAN)

## AC3 - plan, run and review
- Decided: 2 tests through DistractGuardian; fresh shonin-dev, both greens accepted; refactor 14 and 15: checklist, nothing applied
- Decided: DistractGuardian returns distracted | rejected('no-game') instead of a bare GuardianView (deviation from the plan, as for SubmitGuess: strict typing on the session); the domain Guardian and toGuardianView come with AC4, which needs the stored state
- Decided: kenji-reviewer blocking findings fixed: browser check without a fixed sleep (Playwright clock), evidence recorded; minor: pupils now checked to move toward the tap; open: `rejected` variants, `repository`/`clock` unused in DistractGuardian, FakeClock.advance unused (AC4 will use them); the screen timer and the domain state will both know when the distraction ends: AC4 derives the screen from the use case
- Super-green misses: 0
- Asked user: no (yolo)
- Carry forward: AC4 stores the guardian state (distractedUntil) in the Session through DistractGuardian; PeekSecret reads it with Clock

## AC4 - plan, run and review
- Decided: 5 reds through PeekSecret + guards 18 (1499 ms still safe) and 19 (caught on the last attempt loses); fresh shonin-dev; GREEN 17 cut back to a boolean (built time ahead of red 18)
- Decided: kenji-reviewer blocking (1): the save of the caught game came from my GREEN 19 prompt, untested -> backed out (fix commit), red 21 shouldKeepPenalty_whenGuessingAfterBeingCaught, green 21 restores it (by the orchestrator: one line the dev had written); blocking (2): "can lose the game" proven only by guard 19 -> browser check that loses by peeking
- Decided: minor, open: guard 19's mutation also breaks red 19 (a sharper mutation would target isLost); peek index has no bounds check (the screen only sends 0-3); DistractGuardian.remainingMs is the constant, equal to the stored distractedUntil - now at the time of the call, and the screen keeps its own timer (accepted: same value, one source of the duration)
- Super-green misses: 0
- Asked user: no (yolo)
- Carry forward: AC5 reuses DistractGuardian; ShakeDetector is pure domain, the accelerometer adapter (expo-sensors) is UI and only checkable on the phone (HUMAN)

## AC5 - plan, run and review
- Decided: pure isShake(readings) instead of the planned stateful ShakeDetector (deviation: purer, the hook keeps the readings); guard "two jolts" became red 25 (it could fail); red 26 sliding window and red 27 one long bump added from the dev's note and the review (deviations, AC5)
- Decided: kenji-reviewer blocking: no evidence at the AC's level -> a manual check on the phone, parked for the user (Waiting for you); minor: one bump counted as three -> fixed (red 27); open: no test on the exact 2 g and 1000 ms edges; the hook's 1 s buffer duplicates SHAKE_WINDOW_MS and reads Date.now, not Clock; the 1.5 s quiet time after a shake has no test (UI adapter)
- Super-green misses: 0
- Asked user: no (yolo)
- Keep: Expo + EAS Update yolo setup (sdkVersion runtime policy, a channel per feature branch, the web build for Playwright checks with the page clock), generic to any mobile POC; lives in this repo's package.json, playwright.config.js and README Run section
- Keep: isShake + useShake (shake detection from expo-sensors), generic to any app that wants a shake gesture; lives in src/domain/shake.ts and src/ui/useShake.ts

## Finish
- Verdict: GUILTY, 1 count: AC5 has no evidence at its level until the user checks it on the phone
- Waiting for you: (1) the AC5 phone check; (2) merge feat/peek-a-code (a pull request) — not opened, outward-facing

## AC6-AC8 - added by the user
- Decided: three screen-only ACs (flip, dazed eyes, dust), no TDD (no game rule), one browser check each; one kenji-reviewer pass for the three instead of one per AC (the user asked to save tokens: logged as a deviation from the per-AC review)
- Decided: kenji-reviewer blocking: the loss check failed after the flip (already fixed before the review read it: tap where the element is); minor fixed: a mid-turn check, both pupils, dust gone by 500 ms; open: the feel of the flip on the phone (HUMAN)
- Asked user: no (yolo)

## AC5 waived, AC9 added - by the user
- Decided (user): remove the shake: in Expo Go a shake opens the developer menu. useShake and its wiring removed; isShake and its tests kept (Keep entry stands) for a standalone build
- Decided (user, orchestrator agreed): feedback dots green (right place) and yellow (wrong place), white-ringed to tell them from pegs, plus a legend
- Asked user: yes
- Verdict now: NOT GUILTY pending nothing but the user's look on the phone (AC6 feel, AC9 look are confirmations, not counts: their checks pass)

## Round 2 - the guardian becomes an enemy (user)
- Decided: AC10-AC14 written from the user's request; numbers (10 life, costs 1/2/2, 5 s cooldown, 3 min, items every 8-15 s for 4 s, attacks every 10-20 s with a 1 s warning, 3 lanes) and two extra items (hourglass, shield charm) chosen by the orchestrator; a Tick use case drives time-based rules so they stay test-driven
- Decided: build in a fresh session: this one is long and costly per step (the user raised token cost)
- Fixed: the AC9 edit had dropped the "## Discrepancies" heading of acceptance.md; restored
- Asked user: no (yolo)
