# PEEK-1: retro

- Separate Expo environment declined twice: the Expo token was saved on the
  default environment instead, which opens `api.expo.dev` only. Publishing
  still to be tried; the web build is the fallback launch.
- shonin-dev's first GREEN built the whole scoring rule and the turn history from test 1: it had not read the skill files (they are not installed as skills in this container). Rejected; told to read igiari-tdd rule 5 first, its later greens were minimal.
- igiari-tdd's audit script runs on a Jest project with --test-path/--main-path/--test-marker, but its failure-line parsing is Java's: every red reads "no failure line found" although each fails. A tooling chore commit shows as NOT A STEP COMMIT.
- AC2 plan missed a case: GREEN 10 rejected only won games, so red 11 shouldRejectGuess_whenGameIsLost was added mid-run (plan deviation, AC2, approved by the orchestrator in yolo); reveal/hide renumbered 12/13.
- "A new game can be started" could not be driven by a red: StartGame already saved a fresh game. The guard was refused as evidence by kenji-reviewer (blocking); the clause is proven by a browser check instead.
- The scaffold copy (create-expo-app output copied over the clone) replaced .git, losing the `origin` remote; the first push failed until it was added back.
- On the web build, the screen-wide Pressable's onPressIn never fired on a touch tap (onPress does): pointing uses onPress. Found by the browser check, not by a unit test.
- The first AC3 browser check slept 1.2 s (kenji-reviewer, blocking: shoko-playwright forbids fixed sleeps in evidence); rewritten with Playwright's clock.
- The orchestrator's GREEN 19 prompt told the dev the caught game "must be saved": a hint about behaviour no test asked for, so the save went in untested (kenji-reviewer, blocking). Backed out, driven by red 21, restored as green 21. Lesson: a dev prompt names the failing test and the plan, never the next behaviour.
- shonin-dev's GREEN 17 again built ahead (time-based distraction for a test that only needed distracted/watching): cut back to a boolean before commit; red 18 then forced the time.
- A disabled Pressable on the web cannot be tapped by Playwright (actionability wait): the "no peek after the game" check forces the tap.
