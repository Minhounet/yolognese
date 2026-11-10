import { StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const COOLDOWN_MS = 5000;

function Bar({ fraction, color, testID, label }: { fraction: number; color: string; testID: string; label: string }) {
  return (
    <View testID={testID} accessibilityLabel={label} style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%`, backgroundColor: color }]} />
    </View>
  );
}

function clock(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Life bar, countdown and the peek cooldown bar, in one line above the guardian. */
export function HeaderBars({ life, maxLife, timeLeftMs, cooldownMs }: {
  readonly life: number;
  readonly maxLife: number;
  readonly timeLeftMs: number;
  readonly cooldownMs: number;
}) {
  const ready = cooldownMs === 0;
  return (
    <View style={styles.line}>
      <Text style={styles.icon}>❤️</Text>
      <Bar testID="life-bar" label={`life ${life} of ${maxLife}`} fraction={life / maxLife} color={life > 3 ? '#43a047' : THEME.sauce} />
      <Text testID="timer" style={[styles.timer, timeLeftMs <= 20_000 && styles.hurry]}>
        ⏱ {clock(timeLeftMs)}
      </Text>
      <Text style={styles.icon}>👀</Text>
      <Bar
        testID="cooldown-bar"
        label={ready ? 'peek ready' : 'peek cooling down'}
        fraction={1 - cooldownMs / COOLDOWN_MS}
        color={ready ? '#1e88e5' : '#90a4ae'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 4 },
  icon: { fontSize: 14, marginRight: 4 },
  track: { flex: 1, height: 12, borderRadius: 6, backgroundColor: THEME.board, overflow: 'hidden', borderWidth: 1, borderColor: '#0002' },
  fill: { height: '100%', borderRadius: 6 },
  timer: { color: THEME.ink, fontWeight: 'bold', fontSize: 15, marginHorizontal: 10, fontVariant: ['tabular-nums'] },
  hurry: { color: THEME.sauce },
});
