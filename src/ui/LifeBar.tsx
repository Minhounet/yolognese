import { StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const FULL_LIFE = 10;

/** The player's life as a bar of hearts' worth of sauce: full at 10, empty at 0. */
export function LifeBar({ life }: { readonly life: number }) {
  const label = `Life ${life} of ${FULL_LIFE}`;
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>❤️</Text>
      <View
        testID="life"
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        aria-valuemin={0}
        aria-valuemax={FULL_LIFE}
        aria-valuenow={life}
        style={styles.track}
      >
        <View style={[styles.fill, { width: `${(life / FULL_LIFE) * 100}%` }]} />
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
