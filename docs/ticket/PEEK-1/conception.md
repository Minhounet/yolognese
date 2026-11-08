---
status: in-progress
---

# PEEK-1: Yolognese, a code-breaking game where you can cheat

## Context

The user's request (verbatim): "a simple master mind game with a fun part
where we can cheat. If you point somewhere (or perform a strange gesture on
the mobile), the eyes can follow and then you can watch quickly by turning up
the "pawns" to know there color."

Built in yolo mode: the orchestrator takes the decisions and logs them in
`docs/decisions/peek-a-code.md`. The game is original (its own name, look and
guardian), using the classic code-breaking rules (a hidden row of coloured
pegs, exact / misplaced feedback), not a copy of a commercial game.

## Constraints

- Android phone only on the user's side: launchable from the phone (Expo Go
  through EAS Update, web build as fallback).
- Expo SDK 58, TypeScript strict. Only modules bundled in Expo Go
  (`react-native-svg`, `expo-sensors`).

## Decisions

- D-rules: 4 pegs, 6 colours, repeats allowed, 10 attempts.
- D-guardian: a meatball guardian with two big eyes watches the hidden row.
  Pointing (a tap anywhere on the scene) makes its eyes look at that point
  and distracts it for 1500 ms. A shake of the phone distracts it too.
- D-peek: while it is distracted, tapping a hidden peg reveals its colour
  (the UI shows it for 700 ms). Peeking while it watches is caught: one
  attempt is lost.
- D-structure (dependency inversion, `chottomatte-archi`):
  - Domain, pure, no React or Expo: `Color`, `Code`, `Feedback`, `Game`,
    `Guardian`, `ShakeDetector`.
  - Ports: `RandomSource` (the secret), `Clock` (distraction time),
    `GameRepository` (the current session), each with its in-memory or
    deterministic implementation for tests and its real adapter.
  - One use case per operation, each an interface with its impl:
    `StartGame`, `SubmitGuess`, `DistractGuardian`, `PeekSecret`.
    Responses are views (`GameView`, `GuardianView`), mapped by `GameMapper`,
    never the domain objects. Failures are returned as values (discriminated
    unions), never thrown.
  - UI (React Native) only calls use cases; `compositionRoot.ts` wires
    `MathRandomSource`, `SystemClock`, `InMemoryGameRepository`.

### Structural plan

```
- StartGame (use case)            constructor(RandomSource, GameRepository)
    + execute(): GameView
- SubmitGuess (use case)          constructor(GameRepository)
    + execute(cmd: SubmitGuessCommand): SubmitGuessResponse
        played(GameView) | rejected('no-game' | 'game-over')
- DistractGuardian (use case)     constructor(GameRepository, Clock)
    + execute(cmd: DistractCommand { target: Point }): DistractResponse
        distracted(GuardianView { gaze, remainingMs }) | rejected('no-game')   (deviation at AC3, logged)
- PeekSecret (use case)           constructor(GameRepository, Clock)
    + execute(cmd: PeekCommand { index }): PeekResponse
        revealed(index, Color) | caught(GameView) | rejected('no-game' | 'game-over')
- RandomSource (port)             + nextInt(maxExclusive: number): number
- Clock (port)                    + now(): number
- GameRepository (port)           + load(): Session | undefined ; + save(Session): void
    InMemoryGameRepository (same change as the port)
- isShake (domain, pure function)  + isShake(readings: Reading[]): boolean   (was ShakeDetector.push: deviation at AC5, logged)
- useShake (UI hook)              accelerometer adapter (expo-sensors), keeps 1 s of readings, calls DistractGuardian on a shake
- GameMapper (module GameMapper.ts, free functions — deviation logged at AC1)
                                  + toGameView(Game): GameView ; + toGuardianView(Guardian, now): GuardianView
- Composition root: compositionRoot.ts → MathRandomSource, SystemClock,
    InMemoryGameRepository → the four use cases, handed to App.
```

## Open questions

- None blocking. The exact tuning (1500 ms, shake threshold) may change
  after the user tries it on the phone.

## Ruled out

- One fat `GameService`: four operations with different rules and failures,
  so one use case each.
- Multi-touch (hold a finger to distract, peek with another): awkward on a
  phone held in one hand. A tap distracts for a fixed time instead.
