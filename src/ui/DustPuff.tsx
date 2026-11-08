import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Point } from '../domain/point';
import { THEME } from './theme';

const PUFF_MS = 450;
const SPECKS = 7;
const SPREAD = 26;

/** A small cloud of dust where the screen was hit; calls onDone when it has faded. */
export function DustPuff({ at, onDone }: { readonly at: Point; readonly onDone: () => void }) {
  const progress = useRef(new Animated.Value(0)).current;
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const puff = Animated.timing(progress, { toValue: 1, duration: PUFF_MS, useNativeDriver: true });
    puff.start(() => done.current());
    return () => puff.stop();
  }, [progress]);

  const opacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] });
  return (
    <View testID="dust" pointerEvents="none" style={[styles.origin, { left: at.x, top: at.y }]}>
      {Array.from({ length: SPECKS }, (_, speck) => {
        const angle = (2 * Math.PI * speck) / SPECKS;
        const drift = (axis: number) => progress.interpolate({ inputRange: [0, 1], outputRange: [0, axis * SPREAD] });
        return (
          <Animated.View
            key={speck}
            style={[
              styles.speck,
              { opacity, transform: [{ translateX: drift(Math.cos(angle)) }, { translateY: drift(Math.sin(angle)) }] },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', width: 0, height: 0 },
  speck: { position: 'absolute', left: -5, top: -5, width: 10, height: 10, borderRadius: 5, backgroundColor: THEME.dust },
});
