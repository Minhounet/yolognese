import { StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

interface BarProps {
  readonly icon: string;
  readonly value: number;
  readonly max: number;
  readonly color: string;
  readonly label: string;
  /** Shown after the bar, e.g. the time left. */
  readonly text?: string;
  readonly testID?: string;
}

/** A labelled horizontal gauge: life, cooldown, time left. */
export function Bar({ icon, value, max, color, label, text, testID }: BarProps) {
  const filled = `${Math.round((Math.max(0, Math.min(value, max)) / max) * 100)}%` as const;
  return (
    <View testID={testID} accessibilityLabel={label} style={styles.line}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: filled, backgroundColor: color }]} />
      </View>
      {text !== undefined && <Text style={styles.text}>{text}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginHorizontal: 24, marginVertical: 2 },
  icon: { width: 28, fontSize: 18 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: THEME.empty, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 6 },
  text: { width: 44, marginLeft: 6, fontSize: 14, fontVariant: ['tabular-nums'], color: THEME.ink, textAlign: 'right' },
});
