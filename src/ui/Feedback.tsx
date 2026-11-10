import { StyleSheet, Text, View } from 'react-native';

interface FeedbackProps {
  readonly exact: number;
  readonly misplaced: number;
  readonly testID?: string;
}

const RIGHT_PLACE = '✅';
const WRONG_PLACE = '🔄';

/** A mark and how many pegs earned it; a zero is greyed out. */
function Count({ mark, count, testID }: { readonly mark: string; readonly count: number; readonly testID?: string }) {
  return (
    <View testID={testID} style={[styles.count, count === 0 && styles.none]}>
      <Text style={styles.mark}>{mark}</Text>
      <Text style={styles.number}>{count}</Text>
    </View>
  );
}

/**
 * How many pegs are the right colour in the right place (✅) and the right colour in the wrong
 * place (🔄): counts, never positions (AC31).
 */
export function Feedback({ exact, misplaced, testID }: FeedbackProps) {
  return (
    <View testID={testID} accessibilityLabel={`${exact} exact, ${misplaced} misplaced`} style={styles.line}>
      <Count testID={testID && `${testID}-exact`} mark={RIGHT_PLACE} count={exact} />
      <Count testID={testID && `${testID}-misplaced`} mark={WRONG_PLACE} count={misplaced} />
    </View>
  );
}

/** Says what the two marks mean. */
export function FeedbackLegend() {
  return (
    <View testID="legend" style={styles.legend}>
      <Text style={styles.legendText}>{RIGHT_PLACE} right place</Text>
      <Text style={styles.legendText}>{WRONG_PLACE} wrong place</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  count: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 6 },
  none: { opacity: 0.3 },
  mark: { fontSize: 14 },
  number: { color: '#3b2314', fontSize: 18, fontWeight: 'bold', marginLeft: 3, minWidth: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendText: { color: '#3b2314', fontSize: 13, marginHorizontal: 6 },
});
