# PEEK-1: retro

- Separate Expo environment declined twice: the Expo token was saved on the
  default environment instead, which opens `api.expo.dev` only. Publishing
  still to be tried; the web build is the fallback launch.
- shonin-dev's first GREEN built the whole scoring rule and the turn history from test 1: it had not read the skill files (they are not installed as skills in this container). Rejected; told to read igiari-tdd rule 5 first, its later greens were minimal.
- igiari-tdd's audit script runs on a Jest project with --test-path/--main-path/--test-marker, but its failure-line parsing is Java's: every red reads "no failure line found" although each fails. A tooling chore commit shows as NOT A STEP COMMIT.
- AC2 plan missed a case: GREEN 10 rejected only won games, so red 11 shouldRejectGuess_whenGameIsLost was added mid-run (plan deviation, AC2, approved by the orchestrator in yolo); reveal/hide renumbered 12/13.
- "A new game can be started" could not be driven by a red: StartGame already saved a fresh game. The guard was refused as evidence by kenji-reviewer (blocking); the clause is proven by a browser check instead.
- The scaffold copy (create-expo-app output copied over the clone) replaced .git, losing the `origin` remote; the first push failed until it was added back.
