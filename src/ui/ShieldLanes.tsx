import { ComponentRef, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const LANES = [0, 1, 2] as const;
const SHIELD_WIDTH = 64;
const HALF = 2;

interface ShieldLanesProps {
  readonly shieldLane: number;
  /** The lane the meatball falls into, if one is falling. */
  readonly warningLane?: number;
  readonly onMove: (lane: number) => void;
  /** Where the lanes are in the window, for the falling meatball. */
  readonly onMeasured?: (box: { readonly x: number; readonly y: number; readonly width: number }) => void;
}

function laneOf(centreX: number, width: number): number {
  const lane = Math.floor((centreX / width) * LANES.length);
  return Math.max(0, Math.min(LANES.length - 1, lane));
}

function laneCentre(lane: number, width: number): number {
  return ((lane + 1 / HALF) * width) / LANES.length;
}

/**
 * The player's ground: the shield follows the finger left and right (or jumps to a tapped lane),
 * and stands in the lane under its centre, which is the lane the rules check when a meatball lands.
 */
export function ShieldLanes({ shieldLane, warningLane, onMove, onMeasured }: ShieldLanesProps) {
  const [width, setWidth] = useState(0);
  const [centreX, setCentreX] = useState<number | undefined>(undefined);
  const ground = useRef<ComponentRef<typeof View>>(null);
  const startX = useRef(0);
  const current = useRef({ centreX, width, shieldLane, onMove });
  current.current = { centreX, width, shieldLane, onMove };
  const shownX = centreX ?? laneCentre(shieldLane, width);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          const now = current.current;
          startX.current = now.centreX ?? laneCentre(now.shieldLane, now.width);
        },
        onPanResponderMove: (_event, gesture) => {
          const now = current.current;
          if (now.width === 0) return;
          const x = Math.max(0, Math.min(now.width, startX.current + gesture.dx));
          setCentreX(x);
          const lane = laneOf(x, now.width);
          if (lane !== now.shieldLane) now.onMove(lane);
        },
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: () => undefined,
        onPanResponderTerminate: () => undefined,
      }),
    [],
  );

  const measureGround = () =>
    ground.current?.measureInWindow((x, y, measuredWidth) => onMeasured?.({ x, y, width: measuredWidth }));

  const measure = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
    measureGround();
  };

  // the screen above the ground grows and shrinks (notes, bars): measure again when a meatball is thrown
  useEffect(() => {
    if (warningLane !== undefined) measureGround();
  }, [warningLane]); // eslint-disable-line react-hooks/exhaustive-deps

  const tapLane = (lane: number) => {
    setCentreX(laneCentre(lane, width));
    onMove(lane);
  };

  return (
    <View ref={ground} style={styles.ground} onLayout={measure}>
      {LANES.map((lane) => (
        <Pressable key={lane} testID={`lane-${lane}`} accessibilityRole="button" style={styles.lane} onPress={() => tapLane(lane)}>
          {warningLane === lane && (
            <Text testID="attack-warning" accessibilityLabel={`attack on lane ${lane}`} style={styles.warning}>
              🎯
            </Text>
          )}
        </Pressable>
      ))}
      <View
        testID="shield"
        accessibilityLabel={`shield in lane ${shieldLane}`}
        style={[styles.shield, { left: shownX - SHIELD_WIDTH / HALF }]}
        {...drag.panHandlers}
      >
        {/* a tap on the shield is the shield's: it must not reach the scene, which would distract the guardian */}
        <Pressable onPress={() => undefined} style={styles.shieldPress}>
          <Text style={styles.shieldIcon}>🛡️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ground: { flexDirection: 'row', alignSelf: 'stretch', marginHorizontal: 16, height: 56, marginTop: 6 },
  lane: {
    flex: 1,
    marginHorizontal: 2,
    borderTopWidth: 3,
    borderColor: THEME.board,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warning: { fontSize: 22, opacity: 0.6 },
  shield: { position: 'absolute', top: 0, bottom: 0, width: SHIELD_WIDTH, alignItems: 'center', justifyContent: 'center' },
  shieldPress: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center' },
  shieldIcon: { fontSize: 40 },
});
