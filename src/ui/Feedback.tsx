import { StyleSheet, View } from 'react-native';

interface FeedbackProps {
  readonly exact: number;
  readonly misplaced: number;
  readonly testID?: string;
}

const SLOTS = 4;

/** Dark dots: right colour, right place. Light dots: right colour, wrong place. */
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

const styles = StyleSheet.create({
  grid: { width: 36, flexDirection: 'row', flexWrap: 'wrap', marginLeft: 8 },
  dot: { width: 12, height: 12, borderRadius: 6, margin: 3, borderWidth: 1, borderColor: '#0003' },
  exact: { backgroundColor: '#3b2314' },
  misplaced: { backgroundColor: '#ffffff' },
  none: { backgroundColor: 'transparent' },
});
