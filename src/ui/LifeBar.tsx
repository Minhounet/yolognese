import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const SLIDE_MS = 250;
const BLINKS = 3;
const BLINK_MS = 120;
const PERCENT = 100;

/**
 * The player's life as a bar: full at maxLife (from the game's view), empty at 0. It slides to a new
 * length; the part just lost stays a moment and blinks before it shrinks away, as in fighting games.
 */
export function LifeBar({ life, maxLife }: { readonly life: number; readonly maxLife: number }) {
  const label = `Life ${life} of ${maxLife}`;
  const fill = useRef(new Animated.Value(life / maxLife)).current;
  const lostOpacity = useRef(new Animated.Value(0)).current;
  const previous = useRef(life);
  const [lost, setLost] = useState<{ readonly from: number; readonly to: number } | undefined>();

  useEffect(() => {
    const before = previous.current;
    previous.current = life;
    if (life < before) setLost({ from: life / maxLife, to: before / maxLife });
    Animated.timing(fill, { toValue: life / maxLife, duration: SLIDE_MS, useNativeDriver: false }).start();
  }, [life, maxLife, fill]);

  useEffect(() => {
    if (lost === undefined) return undefined;
    const blink = Animated.sequence(
      Array.from({ length: BLINKS }, () => [
        Animated.timing(lostOpacity, { toValue: 1, duration: BLINK_MS / 2, useNativeDriver: false }),
        Animated.timing(lostOpacity, { toValue: 0.2, duration: BLINK_MS / 2, useNativeDriver: false }),
      ]).flat(),
    );
    blink.start(() => setLost(undefined));
    return () => blink.stop();
  }, [lost, lostOpacity]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  return (
    <View style={styles.row}>
      <Text style={styles.icon}>❤️</Text>
      <View
        testID="life"
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        aria-valuemin={0}
        aria-valuemax={maxLife}
        aria-valuenow={life}
        style={styles.track}
      >
        {lost !== undefined && (
          <Animated.View
            testID="life-lost"
            style={[
              styles.lost,
              { left: `${lost.from * PERCENT}%`, width: `${(lost.to - lost.from) * PERCENT}%`, opacity: lostOpacity },
            ]}
          />
        )}
        <Animated.View style={[styles.fill, { width }]} />
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
  lost: { position: 'absolute', top: 0, bottom: 0, backgroundColor: '#ffffff', borderWidth: 1, borderColor: THEME.sauce },
  count: { color: THEME.ink, fontSize: 14, marginLeft: 6, minWidth: 18 },
});
