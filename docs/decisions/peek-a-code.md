# Decision log: peek-a-code

## Resume
- Status: open
- Mode: build
- Yolo: on (see references/yolo.md of saiban-orchestrator)
- Done: scaffold (Expo SDK 58, TypeScript), structural plan and ACs, AC1
- Next: AC2
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
