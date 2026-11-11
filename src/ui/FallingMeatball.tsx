import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { Point } from '../domain/point';

const MEATBALL_SIZE = 36;
const HALF = 2;

/** A meatball (or AC34's fork) thrown by the guardian, falling from `from` to `to` (window points) in `durationMs`. */
export function FallingMeatball({
  from,
  to,
  durationMs,
  lane,
  fork = false,
}: {
  readonly from: Point;
  readonly to: Point;
  readonly durationMs: number;
  readonly lane: number;
  /** AC34: a fork falls instead of a meatball. */
  readonly fork?: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    progress.setValue(0);
    const fall = Animated.timing(progress, { toValue: 1, duration: durationMs, easing: Easing.in(Easing.quad), useNativeDriver: true });
    fall.start();
    return () => fall.stop();
  }, [progress, durationMs, from.x, from.y, to.x, to.y]);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  return (
    <Animated.View
      testID="meatball"
      accessibilityLabel={`${fork ? 'fork' : 'meatball'} falling on lane ${lane}`}
      pointerEvents="none"
      style={[styles.meatball, { transform: [{ translateX }, { translateY }] }]}
    >
      <Text style={styles.icon}>{fork ? '🍴' : '🧆'}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  meatball: { position: 'absolute', left: -MEATBALL_SIZE / HALF, top: -MEATBALL_SIZE / HALF, width: MEATBALL_SIZE, height: MEATBALL_SIZE },
  icon: { fontSize: 30, textAlign: 'center' },
});
