import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import { Color } from '../domain/color';
import { Peg } from './Peg';

interface SecretPegProps {
  /** The colour to show, or undefined for the hidden side. */
  readonly color?: Color;
  readonly onPress?: () => void;
  readonly testID?: string;
}

const HALF_FLIP_MS = 90;

/** A peg that turns over (squeezes to an edge, then opens on its other side) when its colour changes. */
export function SecretPeg({ color, onPress, testID }: SecretPegProps) {
  const [shown, setShown] = useState<Color | undefined>(color);
  const width = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (color === shown) return;
    const toEdge = Animated.timing(width, { toValue: 0, duration: HALF_FLIP_MS, useNativeDriver: true });
    toEdge.start(() => {
      setShown(color);
      Animated.timing(width, { toValue: 1, duration: HALF_FLIP_MS, useNativeDriver: true }).start();
    });
    return () => toEdge.stop();
  }, [color, shown, width]);

  return (
    <Animated.View style={{ transform: [{ scaleX: width }] }}>
      <Peg testID={testID} color={shown} hidden={shown === undefined} onPress={onPress} />
    </Animated.View>
  );
}
