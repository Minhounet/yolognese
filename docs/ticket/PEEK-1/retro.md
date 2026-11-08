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
- kenji-reviewer found a real bug at AC5 in review: one hard bump spans about three 50 ms accelerometer samples and counted as three jolts. Red 27 drove the fix; the dev showed the rule had to be time-based (readings under 100 ms apart are one jolt), since list-neighbour edges also merged a real burst.
- The user felt a delay before a peeked peg turned back: it was real, a fixed 700 ms that also kept the peg shown after the guardian had looked back. Now 400 ms, or the guardian's return, whichever is first.
- The flip animation broke two AC4 browser checks: a peg mid-flip has zero width, and under page.clock Playwright's "stable" wait counts animation frames the frozen clock never runs. Checks now tap where the element is, like a finger. The first fix was pushed with the check still failing (kenji-reviewer, blocking).
- AC10: the audit script's temporary worktree has no node_modules, so in a Node project every red reads "no failure line found" and the final build "FAILS" for that reason alone. Re-run by hand in a worktree with node_modules linked: each red 28-33 fails with exactly one failing test, final build 34 passed, tsc clean.
- AC10 changed AC2's and AC4's rule (attempts -> life): two tests and guard 19 were superseded and removed, one translated with a mutation check, all traced in refactor 33's commit message.
- AC11: adding a field to the revealed response would have broken three tests comparing it with toEqual, and a green may not touch tests; they were loosened to toMatchObject in a "red 37 (fix)" commit. kenji-reviewer: it is a test refactor, not a red fix (red 37 already failed for the right reason); it belonged in a refactor step before the red. Traced in the commit, left as is (history is not rewritten).
- AC11: conception.md's D-cooldown said the view gives cooldownRemainingMs; built as cooldownMs on the responses (the mapper has no clock). conception.md updated after the review.
- react-native-web does not render accessibilityValue as aria-valuenow; the bars use RN's aria-value* props (LifeBar too, same meaning).
