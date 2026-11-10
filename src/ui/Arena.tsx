import { ComponentRef, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { AttackView } from '../application/views';
import { LANES } from '../domain/round';
import { THEME } from './theme';

const WINDUP_MS = 1000;

/**
 * Three lanes along the bottom. The shield sits in one: drag it (it snaps to the
 * nearest lane) or tap a lane. A warned attack shows in its lane, growing as it comes.
 */
export function Arena({ shieldLane, attack, charm, onMove }: {
  readonly shieldLane: number;
  readonly attack?: AttackView;
  readonly charm: boolean;
  readonly onMove: (lane: number) => void;
}) {
  const [width, setWidth] = useState(1);
  const left = useRef(0);
  const view = useRef<ComponentRef<typeof View>>(null);
  const move = useRef(onMove);
  move.current = onMove;
  const laneAt = (pageX: number) => Math.floor(((pageX - left.current) / width) * LANES);

  const drag = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => move.current(laneAt(event.nativeEvent.pageX)),
    onPanResponderMove: (event) => move.current(laneAt(event.nativeEvent.pageX)),
  });

  const measure = () =>
    view.current?.measureInWindow((x, _y, measured) => {
      left.current = x;
      setWidth(measured || 1);
    });

  return (
    <View ref={view} testID="arena" style={styles.arena} onLayout={measure} {...drag.panHandlers}>
      {Array.from({ length: LANES }, (_, lane) => {
        const incoming = attack?.lane === lane ? attack : undefined;
        const coming = incoming === undefined ? 0 : 1 - incoming.msToLand / WINDUP_MS;
        return (
          <Pressable key={lane} testID={`lane-${lane}`} style={[styles.lane, incoming && styles.warned]} onPress={() => onMove(lane)}>
            {incoming && (
              <Text
                testID="attack"
                accessibilityLabel={`${incoming.kind} attack in lane ${lane}`}
                style={[styles.projectile, { transform: [{ scale: 0.5 + coming }] }]}
              >
                {incoming.kind === 'fork' ? '🍴' : '🧆'}
              </Text>
            )}
            {shieldLane === lane && (
              <Text testID="shield" accessibilityLabel={`shield in lane ${lane}${charm ? ', charmed' : ''}`} style={styles.shield}>
                🛡️{charm ? '🧿' : ''}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  arena: { flexDirection: 'row', alignSelf: 'stretch', marginHorizontal: 16, marginTop: 8, height: 56 },
  lane: {
    flex: 1,
    marginHorizontal: 3,
    borderRadius: 10,
    backgroundColor: THEME.board,
    alignItems: 'center',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  warned: { borderColor: THEME.sauce, backgroundColor: '#f8c4b4' },
  projectile: { position: 'absolute', top: 2, fontSize: 22 },
  shield: { fontSize: 28, marginBottom: 2 },
});
