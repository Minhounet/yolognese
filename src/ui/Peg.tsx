import { Pressable, StyleSheet, Text } from 'react-native';
import { Color } from '../domain/color';
import { PEG_COLORS, THEME } from './theme';

interface PegProps {
  readonly color?: Color;
  readonly hidden?: boolean;
  readonly size?: number;
  readonly onPress?: () => void;
  readonly testID?: string;
}

export function Peg({ color, hidden = false, size = 40, onPress, testID }: PegProps) {
  const fill = hidden ? THEME.hidden : color ? PEG_COLORS[color] : THEME.empty;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={hidden ? 'hidden peg' : (color ?? 'empty peg')}
      onPress={onPress}
      disabled={onPress === undefined}
      style={[styles.peg, { width: size, height: size, borderRadius: size / 2, backgroundColor: fill }]}
    >
      {hidden && <Text style={styles.mark}>?</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  peg: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.25)',
    margin: 4,
  },
  mark: { color: '#fff4e0', fontWeight: 'bold', fontSize: 18 },
});
