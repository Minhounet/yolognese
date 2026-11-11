# Yolognese

**Play it (Expo Go on the phone):** `exp://u.expo.dev/90eceada-289a-4a45-b958-180a23ddedb8?channel-name=main&runtime-version=exposdk:58.0.0`
(the `main` channel: every merge into `main` is published there; reopen Expo Go to get it)

**Resume work in a new session:** say "resume peek-a-code"; where things stand and what is next is in the
Resume block at the top of `docs/decisions/peek-a-code.md`.

A code-breaking game with a twist: a meatball guardian watches the hidden
code. Point somewhere (or shake your phone) and its eyes follow, then peek at
a hidden peg while it looks away. You have a life bar of 10: a missed guess costs 1, getting caught costs 2.
After a peek you wait 5 s (the cooldown bar), and a game lasts 3 minutes. The guardian throws meatballs:
drag the shield to the lane it aims at. Tap the items that pop up: 🍝 food, 💨 smoke bomb, 👓 x-ray,
⏳ hourglass, 🍀 shield charm, 🎁 present (a gamble: it can hold darkness, a bomb, or a 🌀 mix-up of
your pegs). One throw in three is a 🍴 fork that steals a peg you placed.

**Steal the sauce** (menu): several phones, each hiding a sauce and cracking another player's, in
a circle that turns every 45 s and after each crack; +1 per sauce stolen, most points in 5 minutes
wins. A server referees it (Supabase, `supabase/README.md`): no phone can see another's sauce.
You see your attacker's guesses on your sauce live, and a 🦑 ink item lets you ink your target's
screen (they rub it off with a finger). Alone? In the room, the host can tap "🤖 Add a bot". Design in `docs/ticket/PEEK-2/`.

Built in yolo mode with the aixlper skills; design and acceptance criteria
in `docs/ticket/PEEK-1/`, decisions in `docs/decisions/peek-a-code.md`.

## Run

**On an Android phone (Expo Go):**

1. Install **Expo Go** from the Play Store and sign in with the Expo account
   that is a member of `minhounets-team`.
2. Open this link on the phone:
   `exp://u.expo.dev/90eceada-289a-4a45-b958-180a23ddedb8?channel-name=main&runtime-version=exposdk:58.0.0`
   (or expo.dev → minhounets-team → yolognese → Updates → the latest update → Preview).
3. Each push of `main` publishes a new update to the `main` channel:
   reopen the app to get it.

**Publish an update** (needs an Expo token in `EXPO_TOKEN`):

```bash
npx eas-cli@latest update --branch main --environment preview --message "<what changed>" --non-interactive
```

**In a browser:** `npm run export:web`, then serve `dist/`
(`python3 -m http.server 8081 --directory dist`) and open http://localhost:8081.

## Check

```bash
npm test            # unit tests (Jest): the game rules and use cases
npm run typecheck   # TypeScript
npm run e2e         # builds the web version and runs the browser checks, one per AC
```
