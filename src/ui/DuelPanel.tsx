import { Pressable, StyleSheet, Text, View } from 'react-native';
import { DuelResultView, DuelView } from '../application/views';
import { ANSWER_MS } from '../domain/duel';
import { INSULTS } from './insults';
import { THEME } from './theme';

const MS_PER_SECOND = 1000;
const PERCENT = 100;

interface DuelPanelProps {
  readonly duel: DuelView;
  /** Who the player would taunt (the guardian, or the player whose sauce it is after). */
  readonly opponent: string;
  readonly onSay: (insult: number) => void;
  readonly onAnswer: (comeback: number) => void;
  readonly onTouchStart: () => void;
}

/** Round 15 (AC4): choosing an insult, waiting for the comeback, or answering one in time. */
export function DuelPanel({ duel, opponent, onSay, onAnswer, onTouchStart }: DuelPanelProps) {
  return (
    <View testID="duel" style={styles.panel} onTouchStart={onTouchStart}>
      {duel.phase === 'choosing' && (
        <>
          <Text style={styles.title}>🗯️ Taunt {opponent}:</Text>
          {duel.offered.map((insult) => (
            <Line key={insult} testID={`insult-${insult}`} text={INSULTS[insult].insult} onPress={() => onSay(insult)} />
          ))}
        </>
      )}
      {duel.phase === 'waiting' && (
        <>
          <Text style={styles.said}>🗯️ “{INSULTS[duel.insult].insult}”</Text>
          <Text testID="duel-waiting" style={styles.title}>
            ⏳ {capitalised(duel.opponent)} looks for a comeback…
          </Text>
        </>
      )}
      {duel.phase === 'answering' && (
        <>
          <Text style={styles.title}>🗯️ {capitalised(duel.from)} taunts you!</Text>
          <Text testID="duel-insult" style={styles.said}>
            “{INSULTS[duel.insult].insult}”
          </Text>
          <View style={styles.clock}>
            <View style={[styles.clockFill, { width: `${(duel.leftMs / ANSWER_MS) * PERCENT}%` }]} />
          </View>
          <Text style={styles.hint}>Your comeback, quick! {Math.ceil(duel.leftMs / MS_PER_SECOND)}</Text>
          {duel.choices.map((comeback) => (
            <Line
              key={comeback}
              testID={`comeback-${comeback}`}
              text={INSULTS[comeback].comeback}
              chosen={duel.answered === comeback}
              disabled={duel.answered !== undefined}
              onPress={() => onAnswer(comeback)}
            />
          ))}
        </>
      )}
    </View>
  );
}

function Line(props: { readonly testID: string; readonly text: string; readonly onPress: () => void; readonly chosen?: boolean; readonly disabled?: boolean }) {
  return (
    <Pressable testID={props.testID} accessibilityRole="button" disabled={props.disabled} onPress={props.onPress} style={[styles.line, props.chosen && styles.chosen]}>
      <Text style={styles.lineText}>{props.text}</Text>
    </Pressable>
  );
}

const capitalised = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** AC5: what the verdict means for this player, in a line. */
export function verdictLine(result: DuelResultView): string {
  const them = result.opponent;
  const solo = them === 'the guardian';
  if (result.won) {
    switch (result.penalty) {
      case 'peg':
        return solo ? '🏆 You win! 🔍 The guardian shows you a peg' : `🏆 You win! 🔍 A peg of the sauce you're after`;
      case 'life':
        return `🏆 You win! ❤️ +2 life from ${them}`;
      case 'dizzy':
        return '🏆 You win! 😵 The guardian is dizzy: peek now!';
      case 'scramble':
        return `🏆 You win! 🌀 ${capitalised(them)}'s colours lie for 10 s`;
      case 'flip':
        return `🏆 You win! 🙃 ${capitalised(them)} is upside down`;
    }
  }
  switch (result.penalty) {
    case 'peg':
      return `😖 ${capitalised(them)} wins! 🔍 ${capitalised(them)} sees a peg`;
    case 'life':
      return `😖 ${capitalised(them)} wins! ❤️ You give 2 life`;
    case 'scramble':
      return `😖 ${capitalised(them)} wins! 🌀 Your colours lie for 10 s`;
    case 'flip':
      return `😖 ${capitalised(them)} wins! 🙃 Upside down for 8 s`;
    default:
      return `😖 ${capitalised(them)} wins!`;
  }
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', left: 12, right: 12, top: 120, padding: 12, borderRadius: 16, backgroundColor: '#fffaf0', borderWidth: 2, borderColor: THEME.sauce, elevation: 6, shadowOpacity: 0.3, shadowRadius: 8 },
  title: { color: THEME.sauce, fontSize: 17, fontWeight: 'bold', marginBottom: 6, textAlign: 'center' },
  said: { color: THEME.ink, fontSize: 17, fontStyle: 'italic', textAlign: 'center', marginBottom: 6 },
  hint: { color: THEME.ink, fontSize: 13, textAlign: 'center', marginBottom: 4 },
  clock: { height: 6, borderRadius: 3, backgroundColor: THEME.empty, overflow: 'hidden', marginBottom: 6 },
  clockFill: { height: '100%', backgroundColor: THEME.sauce },
  line: { paddingVertical: 10, paddingHorizontal: 12, marginVertical: 3, borderRadius: 10, backgroundColor: THEME.board },
  chosen: { borderWidth: 2, borderColor: THEME.sauce },
  lineText: { color: THEME.ink, fontSize: 15 },
});
