import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const REFRESH_MS = 100;

/** Refills over `cooldownMs` from `startedAt`; full means the player can peek again. */
export function CooldownBar({ startedAt, cooldownMs }: { readonly startedAt: number; readonly cooldownMs: number }) {
  const [now, setNow] = useState(() => Date.now());
  const ready = now >= startedAt + cooldownMs;

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, [startedAt]);

  const filled = cooldownMs === 0 ? 1 : Math.min(1, (now - startedAt) / cooldownMs);
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
        <View style={[styles.fill, { width: `${filled * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  icon: { fontSize: 14, marginRight: 6 },
  track: { width: 180, height: 8, borderRadius: 4, backgroundColor: THEME.empty, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: THEME.hidden },
});
