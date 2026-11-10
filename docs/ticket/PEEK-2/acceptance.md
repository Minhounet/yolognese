# PEEK-2: acceptance criteria

Source for all: the user chose the race suggestion and gave a Supabase project.

## AC1: A room to meet in
- Interpretation: a player picks a name and a room code, joins, and sees everyone in the room; the first in is the host and can start once two are there
- Evidence: e2e/race.spec.js (two browser contexts, real Supabase room)
- Status: verified

## AC2: Same secret, same start
- Interpretation: the host's start gives every player in the room the same secret and a fresh round, with the others listed as rivals
- Evidence: test/application/Race.test.ts shouldGiveEveryoneTheHostSecret, shouldListRivals_whenRaceStarts; e2e/race.spec.js
- Status: verified

## AC3: See the rivals
- Interpretation: each player sees every rival's life and best count of pegs in the right place, updated when they change; out and winners marked
- Evidence: test/application/Race.test.ts shouldShowRivalLifeAndBestExact_whenRivalGuesses, shouldSendNothing_whenNothingChanged; e2e/race.spec.js (Bob: life 9, 3 right)
- Status: verified

## AC4: Sabotage
- Interpretation: a 😈 item, only in a race, throws a meatball or fork in a random lane at a random rival still playing; it arrives with the 1 s warning and the thrower's name, and the shield blocks it
- Evidence: test/application/Race.test.ts Sabotage block (4 tests); the browser side is not checked (real time over the network)
- Status: verified

## AC5: Who wins
- Interpretation: the first to crack the code wins and every other player is beaten (secret shown); when every rival is out of life or time, the last one in wins
- Evidence: test/application/Race.test.ts shouldBeatRivals_whenOneCracksTheCode, shouldWin_whenEveryRivalIsOut, shouldKeepPlaying_whenOnlyOneOfTwoRivalsIsOut; e2e/race.spec.js
- Status: verified

## Discrepancies

None.
