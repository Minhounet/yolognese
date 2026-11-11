# Yolognese

A code-breaking game with a twist: a meatball guardian watches the hidden
code. Tap somewhere and its eyes follow, then peek at a hidden peg while it
looks away (then wait for the cooldown bar). Get caught and you lose 2 life.
You have a life bar and 3 minutes. Items pop up: 🍝 food, 💨 smoke bomb,
👓 x-ray glasses (one peg, quick), ⏳ +30 s, 🧿 charm, 🎁 present (a gamble:
it can switch your pegs or burn you). The guardian throws meatballs, and
forks that steal a peg from your row: drag the 🛡️ shield into the warned lane.

**Play friends:** everyone joins the same room code on their own phone; the
first one in picks the mode and starts.

- **Steal the sauce** (default): everyone hides a secret and cracks another
  player's, in a circle. A server referees it (Supabase, `supabase/README.md`):
  it keeps every sauce and the score, so no phone can see another's sauce.
  Alone? The host can tap "🤖 Add a bot" in the room to fill it with test bots. The target switches every 45 s and after each crack.
  +1 per sauce stolen (the robbed player gets a new one); most points in
  5 minutes wins. Grab 😈 to hit whoever is after your sauce.
  Design in `docs/ticket/PEEK-3/`.
- **Race:** same secret for all; first to crack it wins, or the last
one still in. Grab 😈 to throw a meatball or a fork at a rival. Rooms run on
Supabase Realtime (no database tables). Design in `docs/ticket/PEEK-2/`.

Built in yolo mode with the aixlper skills; design and acceptance criteria
in `docs/ticket/PEEK-1/`, decisions in `docs/decisions/peek-a-code.md`.

## Run

**On an Android phone (Expo Go):**

1. Install **Expo Go** from the Play Store and sign in with the Expo account
   that is a member of `minhounets-team`.
2. Open this link on the phone:
   `exp://u.expo.dev/90eceada-289a-4a45-b958-180a23ddedb8?channel-name=feat-peek-a-code&runtime-version=exposdk:58.0.0`
   (or expo.dev → minhounets-team → yolognese → Updates → the latest update → Preview).
3. Each push of the feature branch publishes a new update to the same
   channel: reopen the app to get it.

**Publish an update** (needs an Expo token in `EXPO_TOKEN`):

```bash
npx eas-cli@latest update --branch feat-peek-a-code --environment preview --message "<what changed>" --non-interactive
```

**In a browser:** `npm run export:web`, then serve `dist/`
(`python3 -m http.server 8081 --directory dist`) and open http://localhost:8081.

## Check

```bash
npm test            # unit tests (Jest): the game rules and use cases
npm run typecheck   # TypeScript
npm run e2e         # builds the web version and runs the browser checks, one per AC
```
