import { StyleSheet, Text, View } from 'react-native';
import { COLORS, Code } from '../domain/color';
import { Peg } from './Peg';
import { THEME } from './theme';

const next = (color: Code[number]) => COLORS[(COLORS.indexOf(color) + 1) % COLORS.length];

/** "Steal the sauce": the secret this player hides; tap a peg to change its colour. */
export function SaucePicker({ secret, onChange }: { readonly secret: Code; readonly onChange: (secret: Code) => void }) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Your secret sauce (tap to change)</Text>
      <View style={styles.row}>
        {secret.map((color, slot) => (
          <Peg
            key={slot}
            testID={`sauce-${slot}`}
            color={color}
            onPress={() => onChange(secret.map((current, index) => (index === slot ? next(current) : current)) as unknown as Code)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', marginTop: 12 },
  label: { color: THEME.ink, fontWeight: 'bold', marginBottom: 4 },
  row: { flexDirection: 'row' },
});
