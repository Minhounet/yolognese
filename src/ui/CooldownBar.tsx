import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const REFRESH_MS = 100;

/** Refills over `cooldownMs` from `startedAt`; full means the player can peek again. */
export function CooldownBar({ startedAt, cooldownMs }: { readonly startedAt: number; readonly cooldownMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  const ready = now >= startedAt + cooldownMs;

  const filled = cooldownMs === 0 ? 1 : Math.min(1, (now - startedAt) / cooldownMs);
  const fill = useRef(new Animated.Value(filled)).current;

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  // The fill runs on the native UI thread: on a phone the game's tick keeps the JS thread busy,
  // and a bar redrawn from a JS timer only moved when the thread was free (it jumped, it did not refill).
  useEffect(() => {
    const start = cooldownMs === 0 ? 1 : Math.min(1, (Date.now() - startedAt) / cooldownMs);
    fill.setValue(start);
    const refill = Animated.timing(fill, {
      toValue: 1,
      duration: Math.max(0, startedAt + cooldownMs - Date.now()),
      easing: Easing.linear,
      useNativeDriver: true,
    });
    refill.start();
    return () => refill.stop();
  }, [startedAt, cooldownMs, fill]);

  return (
    <View style={styles.row}>
      <Text style={styles.icon}>👀</Text>
      <View
        testID="cooldown"
        accessibilityRole="progressbar"
        accessibilityLabel={ready ? 'Peek ready' : 'Peek cooling down'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled * 100)}
        style={styles.track}
      >
        <Animated.View testID="cooldown-fill" style={[styles.fill, { transform: [{ scaleX: fill }] }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  icon: { fontSize: 14, marginRight: 6 },
  track: { width: 180, height: 8, borderRadius: 4, backgroundColor: THEME.empty, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', backgroundColor: THEME.hidden, transformOrigin: 'left' },
});
