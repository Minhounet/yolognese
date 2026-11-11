import { StyleSheet, Text, View } from 'react-native';
import { StealView } from '../application/views';
import { Peg } from './Peg';
import { THEME } from './theme';

const WARNING_MS = 3000;

/** "Steal the sauce": scores, whose sauce you are after (and when the circle turns), and who is after yours. */
export function StealBanner({ steal }: { readonly steal: StealView }) {
  const soon = steal.switchInMs !== undefined && steal.switchInMs <= WARNING_MS && !steal.finished;
  return (
    <View style={styles.banner}>
      <View testID="scores" style={styles.scores}>
        {steal.scores.map((score) => (
          <Text
            key={score.name}
            testID={`score-${score.name}`}
            accessibilityLabel={`${score.name} ${score.points}`}
            style={[styles.score, score.me && styles.mine]}
          >
            {score.name} {score.points}
          </Text>
        ))}
      </View>
      <View style={styles.line}>
        <Text testID="target" accessibilityLabel={`after ${steal.target}`} style={styles.target}>
          🎯 {steal.target}&apos;s sauce
        </Text>
        {steal.switchInMs !== undefined && !steal.finished && (
          <Text testID="switch-in" style={[styles.switch, soon && styles.soon]}>
            🔀 {soon ? `Switch in ${Math.ceil(steal.switchInMs / 1000)}…` : `${Math.ceil(steal.switchInMs / 1000)} s`}
          </Text>
        )}
      </View>
      <View testID="defence" accessibilityLabel={`${steal.attacker} is after your sauce: ${steal.threat} right`} style={styles.line}>
        <Text style={styles.defence}>
          🛡 {steal.attacker} is after yours: ✅{steal.threat}
        </Text>
        <View style={styles.mine}>
          {(steal.mySecret ?? [undefined, undefined, undefined, undefined]).map((color, slot) => (
            <Peg key={slot} testID={`my-sauce-${slot}`} color={color} size={16} />
          ))}
        </View>
      </View>
      {steal.attempts.length > 0 && <LatestAttempt attempt={steal.attempts[steal.attempts.length - 1]} />}
    </View>
  );
}

/** Round 14: the rival's latest guess on this player's sauce, live: the pegs tried and their score. */
function LatestAttempt({ attempt }: { readonly attempt: StealView['attempts'][number] }) {
  return (
    <View
      testID="attempt"
      accessibilityLabel={`${attempt.by} tried ${attempt.guess.join(' ')}: ${attempt.exact} exact, ${attempt.misplaced} misplaced`}
      style={styles.line}
    >
      <Text style={styles.defence}>👀 {attempt.by} tried</Text>
      <View style={styles.mine}>
        {attempt.guess.map((color, slot) => (
          <Peg key={slot} color={color} size={16} />
        ))}
      </View>
      <Text style={styles.defence}>
        ✅{attempt.exact} 🔄{attempt.misplaced}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 2 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  score: { backgroundColor: THEME.board, color: THEME.ink, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, margin: 2, fontSize: 13 },
  mine: { flexDirection: 'row', fontWeight: 'bold' },
  line: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  target: { color: THEME.sauce, fontWeight: 'bold', fontSize: 16 },
  switch: { color: THEME.ink, fontSize: 14, fontVariant: ['tabular-nums'] },
  soon: { color: THEME.sauce, fontWeight: 'bold' },
  defence: { color: THEME.ink, fontSize: 13 },
});
