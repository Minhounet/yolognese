import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Point } from '../domain/point';
import { THEME } from './theme';

const GLOVE_SIZE = 40;
const ARM_THICKNESS = 18;
const ZIGZAG_STEP = 14;
const GLOVE_FAR = 0.7;
const GLOVE_NEAR = 1.9; // at full reach the glove fills the view: it punches toward the player
const HALF = 2;
const RADIANS_TO_DEGREES = 180 / Math.PI;

interface PunchArmProps {
  readonly from: Point;
  readonly to: Point;
  readonly durationMs: number;
  /** out: the glove flies to its lane; back: the arm pulls it home to the guardian. */
  readonly phase: 'out' | 'back';
  readonly lane: number;
}

/** A spring arm folded like an accordion: stretched to `length`, it unfolds into a long zig-zag. */
function zigzag(length: number): string {
  const folds = Math.max(2, Math.round(length / ZIGZAG_STEP));
  return Array.from({ length: folds + 1 }, (_, fold) => `${(fold * length) / folds},${fold % 2 === 0 ? 2 : ARM_THICKNESS - 2}`).join(' ');
}

/** A boxing glove on a zig-zag spring arm, from the guardian to the lane it aims at (growing as it comes at the player), and back. */
export function PunchArm({ from, to, durationMs, phase, lane }: PunchArmProps) {
  const reach = useRef(new Animated.Value(phase === 'out' ? 0 : 1)).current;

  useEffect(() => {
    reach.setValue(phase === 'out' ? 0 : 1);
    const move = Animated.timing(reach, {
      toValue: phase === 'out' ? 1 : 0,
      duration: durationMs,
      easing: phase === 'out' ? Easing.out(Easing.quad) : Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    move.start();
    return () => move.stop();
  }, [reach, phase, durationMs]);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const angle = `${Math.atan2(dy, dx) * RADIANS_TO_DEGREES}deg`;
  const gloveX = reach.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
  const gloveY = reach.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
  const gloveScale = reach.interpolate({ inputRange: [0, 1], outputRange: [GLOVE_FAR, GLOVE_NEAR] });
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Animated.View
        testID="punch-arm"
        style={[
          styles.arm,
          {
            left: from.x,
            top: from.y - ARM_THICKNESS / HALF,
            width: length,
            transformOrigin: 'left center',
            transform: [{ rotate: angle }, { scaleX: reach }],
          },
        ]}
      >
        <Svg width={length} height={ARM_THICKNESS}>
          <Polyline points={zigzag(length)} stroke={THEME.sauce} strokeWidth={4} fill="none" strokeLinejoin="round" />
        </Svg>
      </Animated.View>
      <Animated.View
        testID={phase === 'out' ? 'meatball' : 'punch-returning'}
        accessibilityLabel={phase === 'out' ? `punch falling on lane ${lane}` : 'punch returning'}
        style={[styles.glove, { transform: [{ translateX: gloveX }, { translateY: gloveY }, { scale: gloveScale }] }]}
      >
        <Text style={styles.icon}>🥊</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  arm: { position: 'absolute', height: ARM_THICKNESS },
  glove: { position: 'absolute', left: -GLOVE_SIZE / HALF, top: -GLOVE_SIZE / HALF, width: GLOVE_SIZE, height: GLOVE_SIZE },
  icon: { fontSize: 34, textAlign: 'center' },
});
