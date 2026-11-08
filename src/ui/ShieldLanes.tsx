import { useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { THEME } from './theme';

const LANES = [0, 1, 2] as const;

interface ShieldLanesProps {
  readonly shieldLane: number;
  /** The lane the guardian aims at while it winds up, if it does. */
  readonly warningLane?: number;
  readonly onMove: (lane: number) => void;
}

/** Three lanes along the bottom: drag the shield (or tap a lane) to stand where the meatball will land. */
export function ShieldLanes({ shieldLane, warningLane, onMove }: ShieldLanesProps) {
  const [width, setWidth] = useState(0);
  const startLane = useRef(shieldLane);
  startLane.current = shieldLane;
  const move = useRef(onMove);
  move.current = onMove;
  const laneWidth = width / LANES.length;

  const drag = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: () => undefined,
        onPanResponderTerminate: () => undefined,
        onPanResponderMove: (_event, gesture) => {
          if (laneWidth === 0) return;
          const lane = Math.round(startLane.current + gesture.dx / laneWidth);
          const clamped = Math.max(0, Math.min(LANES.length - 1, lane));
          if (clamped !== startLane.current) move.current(clamped);
        },
      }),
    [laneWidth],
  );

  const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View style={styles.lanes} onLayout={measure}>
      {LANES.map((lane) => (
        <Pressable key={lane} testID={`lane-${lane}`} accessibilityRole="button" style={styles.lane} onPress={() => onMove(lane)}>
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
        style={[styles.shield, { left: laneWidth * shieldLane, width: laneWidth }]}
        {...drag.panHandlers}
      >
        {/* a tap on the shield is the shield's: it must not reach the scene, which would distract the guardian */}
        <Pressable onPress={() => onMove(shieldLane)} style={styles.shieldPress}>
          <Text style={styles.shieldIcon}>🛡️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lanes: { flexDirection: 'row', alignSelf: 'stretch', marginHorizontal: 16, height: 52, marginTop: 6 },
  lane: { flex: 1, borderRadius: 10, marginHorizontal: 2, backgroundColor: THEME.board, alignItems: 'center', justifyContent: 'center' },
  warning: { fontSize: 22 },
  shield: { position: 'absolute', top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  shieldPress: { alignSelf: 'stretch', flex: 1, alignItems: 'center', justifyContent: 'center' },
  shieldIcon: { fontSize: 34 },
});
