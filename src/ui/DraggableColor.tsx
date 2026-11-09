import { useMemo, useRef } from 'react';
import { PanResponder, View } from 'react-native';
import { Color } from '../domain/color';
import { Point } from '../domain/point';
import { Peg } from './Peg';

const DRAG_START_PX = 6;
const NOWHERE: Point = { x: -1, y: -1 };

interface DraggableColorProps {
  readonly color: Color;
  /** A tap: the colour goes to the first empty slot. */
  readonly onTap: () => void;
  /** While dragging, where the finger is (window points). */
  readonly onDrag: (color: Color, at: Point) => void;
  /** The finger is lifted at `at`; the screen decides which slot, if any, receives the colour. */
  readonly onDrop: (color: Color, at: Point) => void;
}

/** A palette colour the player can tap, or drag onto the slot of their choice. */
export function DraggableColor({ color, onTap, onDrag, onDrop }: DraggableColorProps) {
  const handlers = useRef({ onDrag, onDrop });
  handlers.current = { onDrag, onDrop };
  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.hypot(gesture.dx, gesture.dy) > DRAG_START_PX,
        onPanResponderMove: (_event, gesture) => handlers.current.onDrag(color, { x: gesture.moveX, y: gesture.moveY }),
        onPanResponderRelease: (_event, gesture) => handlers.current.onDrop(color, { x: gesture.moveX, y: gesture.moveY }),
        onPanResponderTerminate: () => handlers.current.onDrop(color, NOWHERE), // an interrupted drag places nothing
      }),
    [color],
  );
  return (
    <View {...drag.panHandlers}>
      <Peg testID={`palette-${color}`} color={color} size={44} onPress={onTap} />
    </View>
  );
}
