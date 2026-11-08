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
  const requested = useRef<Color | undefined>(color);
  const width = useRef(new Animated.Value(1)).current;

  // Every colour change runs a whole flip, and only the latest one opens the
  // peg again: an outdated one is ignored, never stopped (stopping an animation stops every animation
  // on the value, the opening half included), and never skipped (a change back during the closing
  // half would otherwise leave the peg squeezed to nothing).
  useEffect(() => {
    if (color === requested.current) return undefined;
    requested.current = color;
    let outdated = false;
    Animated.timing(width, { toValue: 0, duration: HALF_FLIP_MS, useNativeDriver: true }).start(() => {
      if (outdated) return;
      setShown(color);
      Animated.timing(width, { toValue: 1, duration: HALF_FLIP_MS, useNativeDriver: true }).start();
    });
    return () => {
      outdated = true;
    };
  }, [color, width]);

  return (
    <Animated.View style={{ transform: [{ scaleX: width }] }}>
      <Peg testID={testID} color={shown} hidden={shown === undefined} onPress={onPress} />
    </Animated.View>
  );
}
