import { useRef } from 'react';
import { GestureResponderEvent, StyleSheet, Text, View } from 'react-native';

/** How far the finger must travel over the ink to clear it all, in points (about five swipes across a phone). */
export const WIPE_DISTANCE = 2000;
const SEND_EVERY = 0.02;

const SPLATS = [
  { left: '8%', top: '6%', size: 210 },
  { left: '48%', top: '14%', size: 230 },
  { left: '18%', top: '38%', size: 260 },
  { left: '55%', top: '52%', size: 220 },
  { left: '2%', top: '68%', size: 200 },
  { left: '40%', top: '76%', size: 190 },
] as const;

/**
 * Round 14: a rival's ink over the guardian, the secret and the guesses. The player rubs it off:
 * every move of the finger over it wipes a share, sent to the game (`onWipe`); it fades as it goes.
 */
export function InkOverlay({ left, by, height, onWipe }: {
  readonly left: number;
  readonly by: string;
  readonly height: number;
  readonly onWipe: (amount: number) => void;
}) {
  const last = useRef<{ x: number; y: number } | undefined>(undefined);
  const pending = useRef(0);

  const move = (event: GestureResponderEvent) => {
    const { pageX: x, pageY: y } = event.nativeEvent;
    if (last.current !== undefined) pending.current += Math.hypot(x - last.current.x, y - last.current.y) / WIPE_DISTANCE;
    last.current = { x, y };
    if (pending.current >= SEND_EVERY) {
      onWipe(pending.current);
      pending.current = 0;
    }
  };
  const release = () => {
    if (pending.current > 0) onWipe(pending.current);
    pending.current = 0;
    last.current = undefined;
  };

  return (
    <View
      testID="ink"
      accessibilityLabel={`ink from ${by}, ${Math.round(left * 100)}% left`}
      style={[styles.cover, { height }]}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(event) => {
        last.current = { x: event.nativeEvent.pageX, y: event.nativeEvent.pageY };
      }}
      onResponderMove={move}
      onResponderRelease={release}
      onResponderTerminate={release}
    >
      {SPLATS.map((splat, index) => (
        <View
          key={index}
          pointerEvents="none"
          style={[styles.splat, { left: splat.left, top: splat.top, width: splat.size, height: splat.size * 0.8, opacity: Math.min(1, left * 1.15) }]}
        />
      ))}
      <Text pointerEvents="none" style={[styles.hint, { opacity: Math.max(0.35, left) }]}>
        🦑 {by} inked you! Rub it off 👆
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { position: 'absolute', left: 0, right: 0, top: 0, overflow: 'hidden' },
  splat: { position: 'absolute', borderRadius: 999, backgroundColor: '#14111c' },
  hint: { position: 'absolute', alignSelf: 'center', top: '45%', color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
});
