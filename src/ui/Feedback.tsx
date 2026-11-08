import { StyleSheet, Text, View } from 'react-native';

interface FeedbackProps {
  readonly exact: number;
  readonly misplaced: number;
  readonly testID?: string;
}

const SLOTS = 4;
const RIGHT_PLACE = '#2e9e44';
const WRONG_PLACE = '#f2b705';

/** Green dots: right colour, right place. Yellow dots: right colour, wrong place. */
export function Feedback({ exact, misplaced, testID }: FeedbackProps) {
  const kinds = Array.from({ length: SLOTS }, (_, slot) =>
    slot < exact ? styles.exact : slot < exact + misplaced ? styles.misplaced : styles.none,
  );
  return (
    <View testID={testID} accessibilityLabel={`${exact} exact, ${misplaced} misplaced`} style={styles.grid}>
      {kinds.map((kind, slot) => (
        <View key={slot} style={[styles.dot, kind]} />
      ))}
    </View>
  );
}

/** Says what the two dot colours mean. */
export function FeedbackLegend() {
  return (
    <View testID="legend" style={styles.legend}>
      <View style={[styles.dot, styles.exact]} />
      <Text style={styles.legendText}>right place</Text>
      <View style={[styles.dot, styles.misplaced]} />
      <Text style={styles.legendText}>wrong place</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { width: 36, flexDirection: 'row', flexWrap: 'wrap', marginLeft: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, margin: 3, borderWidth: 1, borderColor: '#0003' },
  exact: { backgroundColor: RIGHT_PLACE, borderColor: '#fff', borderWidth: 2 },
  misplaced: { backgroundColor: WRONG_PLACE, borderColor: '#fff', borderWidth: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendText: { color: '#3b2314', fontSize: 13, marginRight: 12 },
  none: { backgroundColor: 'transparent' },
});
