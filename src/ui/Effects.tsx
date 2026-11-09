import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Point } from '../domain/point';
import { THEME } from './theme';

const HALF = 2;
const CLOUD_W = 130;
const CLOUD_H = 90;
const RADIANS_TO_DEGREES = 180 / Math.PI;
const PUFFS = [
  { x: -34, y: -10, size: 46 },
  { x: 0, y: -22, size: 56 },
  { x: 34, y: -8, size: 48 },
  { x: -18, y: 16, size: 44 },
  { x: 20, y: 18, size: 50 },
];

function useProgress(durationMs: number, easing = Easing.out(Easing.quad)) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(progress, { toValue: 1, duration: durationMs, easing, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [progress, durationMs, easing]);
  return progress;
}

/** A smoke grenade lobbed at the guardian, then a grey cloud over it (while the guardian is blind). */
export function SmokeGrenade({ from, at }: { readonly from: Point; readonly at: Point }) {
  const flight = useProgress(350);
  const x = flight.interpolate({ inputRange: [0, 1], outputRange: [from.x, at.x] });
  const y = flight.interpolate({ inputRange: [0, 0.5, 1], outputRange: [from.y, Math.min(from.y, at.y) - 80, at.y] });
  const cloud = flight.interpolate({ inputRange: [0, 0.9, 1], outputRange: [0, 0, 1] });
  const grenade = flight.interpolate({ inputRange: [0, 0.95, 1], outputRange: [1, 1, 0] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.Text style={[styles.grenade, { opacity: grenade, transform: [{ translateX: x }, { translateY: y }] }]}>🧨</Animated.Text>
      <Animated.View testID="smoke" accessibilityLabel="guardian blinded by smoke" style={[styles.cloud, { left: at.x - CLOUD_W / HALF, top: at.y - CLOUD_H / HALF, opacity: cloud }]}>
        {PUFFS.map((puff, index) => (
          <View
            key={index}
            style={[styles.puff, { left: CLOUD_W / HALF + puff.x - puff.size / HALF, top: CLOUD_H / HALF + puff.y - puff.size / HALF, width: puff.size, height: puff.size, borderRadius: puff.size / HALF }]}
          />
        ))}
      </Animated.View>
    </View>
  );
}

/** A beam from where the x-ray glasses were picked up to the peg they reveal. */
export function XrayBeam({ from, to }: { readonly from: Point; readonly to: Point }) {
  const shot = useProgress(250);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = `${Math.atan2(to.y - from.y, to.x - from.x) * RADIANS_TO_DEGREES}deg`;
  return (
    <Animated.View
      testID="xray-beam"
      pointerEvents="none"
      style={[styles.beam, { left: from.x, top: from.y, width: length, transformOrigin: 'left center', transform: [{ rotate: angle }, { scaleX: shot }] }]}
    />
  );
}

/** The bomb going off where it lay. */
export function Explosion({ at }: { readonly at: Point }) {
  const blast = useProgress(500);
  const scale = blast.interpolate({ inputRange: [0, 1], outputRange: [0.3, 2.2] });
  const opacity = blast.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });
  return (
    <Animated.Text testID="explosion" pointerEvents="none" style={[styles.boom, { left: at.x - 24, top: at.y - 24, opacity, transform: [{ scale }] }]}>
      💥
    </Animated.Text>
  );
}

/** The darkness item: the player is blind, a veil over the game (taps still go through). */
export function DarknessVeil() {
  return (
    <View testID="darkness" accessibilityLabel="you are blind" pointerEvents="none" style={styles.veil}>
      <Text style={styles.veilText}>🌑</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grenade: { position: 'absolute', left: -14, top: -14, fontSize: 26 },
  cloud: { position: 'absolute', width: CLOUD_W, height: CLOUD_H },
  puff: { position: 'absolute', backgroundColor: 'rgba(150,150,150,0.92)' },
  beam: { position: 'absolute', height: 4, borderRadius: 2, backgroundColor: '#ff1744', shadowColor: '#ff1744', shadowOpacity: 0.9, shadowRadius: 6 },
  boom: { position: 'absolute', fontSize: 48 },
  veil: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(10,6,4,0.94)', alignItems: 'center', justifyContent: 'center' },
  veilText: { fontSize: 64, color: THEME.background },
});
