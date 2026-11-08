import { StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

/** The player's life as a bar: full at maxLife (from the game's view), empty at 0. */
export function LifeBar({ life, maxLife }: { readonly life: number; readonly maxLife: number }) {
  const label = `Life ${life} of ${maxLife}`;
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>❤️</Text>
      <View
        testID="life"
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        aria-valuemin={0}
        aria-valuemax={maxLife}
        aria-valuenow={life}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${(life / maxLife) * 100}%` }]} />
      </View>
      <Text style={styles.count}>{life}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  icon: { fontSize: 14, marginRight: 6 },
  track: { width: 180, height: 12, borderRadius: 6, backgroundColor: THEME.empty, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: THEME.life },
  count: { color: THEME.ink, fontSize: 14, marginLeft: 6, minWidth: 18 },
});
