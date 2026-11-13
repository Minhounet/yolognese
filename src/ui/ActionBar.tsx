import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_CHARGES } from '../domain/actionBar';
import { BarView } from '../application/views';
import { THEME } from './theme';

const RESTART_IF_OFF_BY_MS = 250;
const PERCENT = 100;

interface ActionBarProps {
  readonly bar: BarView;
  /** No shell game or taunt while one is on the table. */
  readonly busy: boolean;
  readonly onShell: () => void;
  readonly onTaunt: () => void;
  readonly onTouchStart: () => void;
}

/**
 * Round 15 (AC2): the 👀 cooldown bar became the action bar: three charges, one every 5 s.
 * A peek costs 1, the 🥤 shell game 2, the 🗯️ taunt 3. It refills on the native UI thread
 * (AC11: a bar redrawn from the busy JS thread jumped on the phone).
 */
export function ActionBar({ bar, busy, onShell, onTaunt, onTouchStart }: ActionBarProps) {
  const ready = bar.charges >= 1;
  const fill = useRef(new Animated.Value(bar.charges / MAX_CHARGES)).current;
  const fullAt = useRef<number | undefined>(undefined);
  const target = Date.now() + bar.fullInMs;

  useEffect(() => {
    // the view comes every tick; the animation restarts only when the bar was spent (or emptied)
    if (fullAt.current !== undefined && Math.abs(fullAt.current - target) < RESTART_IF_OFF_BY_MS) return;
    fullAt.current = target;
    fill.setValue(bar.charges / MAX_CHARGES);
    const refill = Animated.timing(fill, { toValue: 1, duration: bar.fullInMs, easing: Easing.linear, useNativeDriver: true });
    refill.start();
  }, [target, bar.charges, bar.fullInMs, fill]);

  return (
    <View style={styles.row} onTouchStart={onTouchStart}>
      <Text style={styles.icon}>⚡</Text>
      <View
        testID="cooldown"
        accessibilityRole="progressbar"
        accessibilityLabel={ready ? 'Peek ready' : 'Peek cooling down'}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round((bar.charges / MAX_CHARGES) * PERCENT)}
        aria-valuetext={`${Math.floor(bar.charges)} of ${MAX_CHARGES} charges`}
        style={styles.track}
      >
        <Animated.View testID="cooldown-fill" style={[styles.fill, { transform: [{ scaleX: fill }] }]} />
        <View style={[styles.notch, { left: '33.3%' }]} />
        <View style={[styles.notch, { left: '66.6%' }]} />
      </View>
      <Action testID="action-shell" label="🥤" cost={2} enabled={bar.canShell && !busy} onPress={onShell} name="Shell game" />
      <Action testID="action-taunt" label="🗯️" cost={3} enabled={bar.canTaunt && !busy} onPress={onTaunt} name="Taunt" />
    </View>
  );
}

function Action(props: { readonly testID: string; readonly label: string; readonly cost: number; readonly enabled: boolean; readonly onPress: () => void; readonly name: string }) {
  return (
    <Pressable
      testID={props.testID}
      accessibilityRole="button"
      accessibilityLabel={`${props.name}, ${props.cost} charges`}
      disabled={!props.enabled}
      onPress={props.onPress}
      style={[styles.action, !props.enabled && styles.off]}
    >
      <Text style={styles.actionText}>{props.label}</Text>
      <Text style={styles.cost}>{props.cost}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  icon: { fontSize: 14, marginRight: 6 },
  track: { width: 150, height: 10, borderRadius: 5, backgroundColor: THEME.empty, overflow: 'hidden' },
  fill: { width: '100%', height: '100%', backgroundColor: THEME.hidden, transformOrigin: 'left' },
  notch: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: THEME.background },
  action: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: THEME.board, borderWidth: 1, borderColor: THEME.sauce },
  off: { opacity: 0.35 },
  actionText: { fontSize: 16 },
  cost: { fontSize: 11, marginLeft: 2, color: THEME.ink, fontWeight: 'bold' },
});
