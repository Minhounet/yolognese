import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShellView } from '../application/views';
import { CUPS, PICK_MS, SHOWN_MS, SWAP_MS, SWAPS, Swap } from '../domain/shellGame';
import { THEME } from './theme';

const CUP_GAP = 88;
const LIFT = -34;
const MS_PER_SECOND = 1000;

const placeX = (place: number) => (place - (CUPS - 1) / 2) * CUP_GAP;

/** Where cup `cup` (by its place at the start) stands after the first `done` swaps. */
function placeAfter(cup: number, swaps: readonly Swap[], done: number): number {
  return swaps.slice(0, done).reduce((place, [a, b]) => (place === a ? b : place === b ? a : place), cup);
}

const swapsDone = (elapsedMs: number) => Math.max(0, Math.min(SWAPS, Math.floor((elapsedMs - SHOWN_MS) / SWAP_MS)));

interface ShellGameTableProps {
  readonly shell: ShellView;
  readonly onPick: (place: number) => void;
  readonly onTouchStart: () => void;
}

/**
 * Round 15 (AC3): three cups, a 🍝 under one; they swap places, then the player taps one.
 * The cups slide on the native UI thread; a cup's tap names the place it ends at.
 */
export function ShellGameTable({ shell, onPick, onTouchStart }: ShellGameTableProps) {
  const cups = Array.from({ length: CUPS }, (_, cup) => cup);
  const done = swapsDone(shell.elapsedMs);
  const xs = useRef(cups.map((cup) => new Animated.Value(placeX(placeAfter(cup, shell.swaps, done))))).current;

  useEffect(() => {
    const first = swapsDone(shell.elapsedMs);
    const wait = Math.max(0, SHOWN_MS + first * SWAP_MS - shell.elapsedMs);
    const moves = cups.map((cup) =>
      Animated.sequence([
        Animated.delay(wait),
        ...shell.swaps.slice(first).map((_, step) =>
          Animated.timing(xs[cup], { toValue: placeX(placeAfter(cup, shell.swaps, first + step + 1)), duration: SWAP_MS, useNativeDriver: true }),
        ),
      ]),
    );
    const all = Animated.parallel(moves);
    all.start();
    return () => all.stop();
    // the cups' moves are planned once, when the table opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showing = shell.elapsedMs < SHOWN_MS;
  const leftMs = SHOWN_MS + SWAPS * SWAP_MS + PICK_MS - shell.elapsedMs;
  const status =
    shell.over !== undefined
      ? shell.over.found
        ? '🍝 Found it! +3 life'
        : shell.over.picked === undefined
          ? "⌛ Too late! The 🍝 was there"
          : '😝 Missed! The 🍝 was there'
      : shell.canPick
        ? `Where is the 🍝? ${Math.ceil(leftMs / MS_PER_SECOND)}`
        : showing
          ? 'Watch the 🍝…'
          : 'Shuffling…';

  return (
    <View testID="shell-game" style={styles.panel} onTouchStart={onTouchStart}>
      <Text testID="shell-status" style={styles.status}>
        {status}
      </Text>
      <View style={styles.table}>
        {cups.map((cup) => {
          const finalPlace = placeAfter(cup, shell.swaps, SWAPS);
          const hasSauce = cup === shell.start;
          const lifted = (hasSauce && showing) || (shell.over !== undefined && finalPlace === shell.over.sauceAt) || (shell.over?.picked === finalPlace);
          return (
            <Animated.View key={cup} style={[styles.cupSpot, { transform: [{ translateX: xs[cup] }] }]}>
              {hasSauce && (lifted || showing) && (
                <Text testID="shell-sauce" style={styles.sauce}>
                  🍝
                </Text>
              )}
              <Pressable
                testID={`cup-${finalPlace}`}
                accessibilityRole="button"
                accessibilityLabel={`cup ${finalPlace + 1}`}
                disabled={!shell.canPick}
                onPress={() => onPick(finalPlace)}
                style={[styles.cup, lifted && styles.lifted]}
              >
                <Text style={styles.cupText}>🥤</Text>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 16, right: 16, top: 150, paddingVertical: 12, borderRadius: 16, backgroundColor: THEME.board, borderWidth: 2, borderColor: THEME.sauce, alignItems: 'center', elevation: 6, shadowOpacity: 0.3, shadowRadius: 8 },
  status: { color: THEME.ink, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  table: { height: 96, width: CUP_GAP * CUPS, alignItems: 'center', justifyContent: 'flex-end' },
  cupSpot: { position: 'absolute', bottom: 0, alignItems: 'center', width: 64 },
  sauce: { position: 'absolute', bottom: 2, fontSize: 30 },
  cup: { paddingHorizontal: 6 },
  lifted: { transform: [{ translateY: LIFT }] },
  cupText: { fontSize: 48 },
});
