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
- AC12: time up empties the life bar (GREEN 40 reused "lost at 0 life"): the bar reads 0 when the clock ends the game; the screen says "Time's up" from the countdown at 0. Kept (yolo), worth the user's look.
- AC12 review: kenji-reviewer said it could not load the skills with its Skill tool and did not read their bodies line by line; its PASS rests on the code, history and runs. A weaker review than the earlier ones: the next reviewer prompt names the skill paths to Read, not to load.
- AC14: the random attacks broke the long browser checks (AC12's 3 minutes, AC4's loss loop): meatballs hit at random. A shared e2e/support.js runs the clock while moving the shield to each warned lane, as a player would. Lane clicks under page.clock hang (the "stable" wait again): taps where the lane is.
- AC14: a real bug found by the flaky AC4 check: a tap on the shield passed through to the scene and distracted the guardian, so the next peek was safe. The shield now takes its own taps; pinned by "tapping the shield moves nothing else".
- AC14: GREEN 43 built the random schedule ahead of reds 44-45 with invented tuning; they became guards. ScriptedRandomSource ignores its bound, so no test pins a spread (attack delay) or a lane count.
- AC13: the dev agents kept inventing tuning values the tests could not pin (ScriptedRandomSource ignores bounds): each was reset to the plan's value before commit, and some planned reds then passed on write and became guards.
- AC13: the first dev stopped on the account's 5-hour usage limit; the run was paused with its Resume block and taken over by a fresh dev at green 62.
- AC13: a red assertion passed with the bug present (toEqual ignored an extra undefined array slot); rewritten as a length check before commit.
- AC13: browser checks of random items fix Math.random per check (addInitScript), so every draw lands on one index: one item kind per check.
- acceptance.md lost its "## Discrepancies" heading again during round 2 edits (a script appended after "None."); restored in round 3, and an insertion keyed on that heading misplaced AC15 until fixed
- Round 3: the AC6 and AC13 browser checks read the peg's label, which changed even while the peg was squeezed to 0 width: the user saw the bug, the checks did not. They now assert visibility (toBeVisible treats a zero-width box as hidden).
- Round 4: the user saw every peek succeed on the phone; the web build catches a peek correctly, so the cause is a guess (the tap reaching the scene too). The fix is defensive and its check passes with or without it: AC17 waits for the user's phone check.
- Round 4: random items could appear over the pegs, so a tap meant for a peg picked up the item (a flaky AC4 check showed it); items now stay below the secret row.
- Round 4: AC18's random punch would make every check that distracts fail one time in four; the composition root takes a fixed luck draw from globalThis.yologneseLuck, set by e2e/fixtures.js (always fooled unless a check asks otherwise).
