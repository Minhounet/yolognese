import { StyleSheet, Text, View } from 'react-native';
import { RivalView } from '../application/views';
import { THEME } from './theme';

/** One line per rival: name, life, best count of pegs in the right place, and whether they are out or cracked it. */
export function Rivals({ rivals }: { readonly rivals: readonly RivalView[] }) {
  return (
    <View testID="rivals" style={styles.panel}>
      {rivals.map((rival) => (
        <View
          key={rival.name}
          testID={`rival-${rival.name}`}
          accessibilityLabel={`${rival.name}: life ${rival.life}, ${rival.bestExact} right${rival.out ? ', out' : ''}${rival.cracked ? ', cracked it' : ''}`}
          style={[styles.rival, rival.out && styles.out]}
        >
          <Text style={styles.name} numberOfLines={1}>
            {rival.cracked ? '🏆 ' : rival.out ? '💀 ' : ''}
            {rival.name}
          </Text>
          <Text style={styles.stat}>❤️{rival.life}</Text>
          <Text style={styles.stat}>✅{rival.bestExact}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginHorizontal: 16, marginBottom: 4 },
  rival: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.board,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    margin: 2,
  },
  out: { opacity: 0.45 },
  name: { color: THEME.ink, fontWeight: 'bold', fontSize: 13, maxWidth: 90, marginRight: 4 },
  stat: { color: THEME.ink, fontSize: 12, marginLeft: 3 },
});
