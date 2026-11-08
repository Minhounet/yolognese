import { StyleSheet, Text, View } from 'react-native';

interface FeedbackProps {
  readonly exact: number;
  readonly misplaced: number;
  readonly testID?: string;
}

const SLOTS = 4;
const RIGHT_PLACE = '✅';
const WRONG_PLACE = '🔄';

type Mark = typeof RIGHT_PLACE | typeof WRONG_PLACE | undefined;

function Slot({ mark }: { readonly mark: Mark }) {
  return mark === undefined ? <View style={styles.empty} /> : <Text style={styles.mark}>{mark}</Text>;
}

/** ✅ right colour, right place; 🔄 right colour, wrong place; an empty ring for nothing. */
export function Feedback({ exact, misplaced, testID }: FeedbackProps) {
  const marks: readonly Mark[] = Array.from({ length: SLOTS }, (_, slot) =>
    slot < exact ? RIGHT_PLACE : slot < exact + misplaced ? WRONG_PLACE : undefined,
  );
  return (
    <View testID={testID} accessibilityLabel={`${exact} exact, ${misplaced} misplaced`} style={styles.line}>
      {marks.map((mark, slot) => (
        <Slot key={slot} mark={mark} />
      ))}
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
  mark: { width: 20, fontSize: 14, textAlign: 'center' },
  empty: { width: 12, height: 12, borderRadius: 6, margin: 4, borderWidth: 1, borderColor: '#0003' },
  legend: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  legendText: { color: '#3b2314', fontSize: 13, marginHorizontal: 6 },
});
