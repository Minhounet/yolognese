# Yolognese

A code-breaking game with a twist: a meatball guardian watches the hidden
code. Point somewhere (or shake your phone) and its eyes follow, then peek at
a hidden peg while it looks away. You have a life bar of 10: a missed guess costs 1, getting caught costs 2.

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
