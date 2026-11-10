import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Point } from '../domain/point';
import { PEG_COLORS, THEME } from './theme';

interface GuardianProps {
  /** Where the eyes look, relative to the guardian's centre; undefined: at the player. */
  readonly gaze?: Point;
  readonly size?: number;
  /** A smoke bomb blinds it: a cloud over its eyes. */
  readonly blind?: boolean;
  /** Winding up an attack: angry brows. */
  readonly angry?: boolean;
}

const PUPIL_TRAVEL = 7;
const AT_THE_PLAYER: Point = { x: 0, y: 1 };
const DAZED_COLORS = Object.values(PEG_COLORS);
const DAZE_STEP_MS = 150;

/** Offset of a pupil from its eye's centre, toward the gaze, at most PUPIL_TRAVEL. */
export function pupilOffset(gaze: Point): Point {
  const length = Math.hypot(gaze.x, gaze.y);
  if (length === 0) return { x: 0, y: 0 };
  const scale = Math.min(PUPIL_TRAVEL, length) / length;
  return { x: gaze.x * scale, y: gaze.y * scale };
}

export function Guardian({ gaze, size = 120, blind = false, angry = false }: GuardianProps) {
  const pupil = pupilOffset(gaze ?? AT_THE_PLAYER);
  const looksAway = gaze !== undefined;
  const [dazeStep, setDazeStep] = useState(0);

  useEffect(() => {
    if (!looksAway) return undefined;
    const timer = setInterval(() => setDazeStep((step) => step + 1), DAZE_STEP_MS);
    return () => clearInterval(timer);
  }, [looksAway]);

  const pupilColor = looksAway ? DAZED_COLORS[dazeStep % DAZED_COLORS.length] : THEME.ink;
  return (
    <View
      testID="guardian"
      accessibilityLabel={blind ? 'guardian blinded' : looksAway ? 'guardian looking away' : angry ? 'guardian attacking' : 'guardian watching'}
    >
      <Svg width={size} height={size * 0.8} viewBox="0 0 100 80">
        <Ellipse cx={50} cy={46} rx={44} ry={32} fill={THEME.meatball} />
        <Circle cx={24} cy={30} r={6} fill={THEME.meatballDark} />
        <Circle cx={78} cy={58} r={5} fill={THEME.meatballDark} />
        <Circle cx={62} cy={68} r={3} fill={THEME.meatballDark} />
        <Path d="M20 22 Q50 2 80 22" stroke={THEME.sauce} strokeWidth={6} fill="none" strokeLinecap="round" />
        <Circle cx={36} cy={42} r={13} fill="#fff" />
        <Circle cx={64} cy={42} r={13} fill="#fff" />
        <Circle testID="pupil-left" cx={36 + pupil.x} cy={42 + pupil.y} r={5} fill={pupilColor} />
        <Circle testID="pupil-right" cx={64 + pupil.x} cy={42 + pupil.y} r={5} fill={pupilColor} />
        {angry ? (
          <>
            <Path d="M24 24 L44 32" stroke={THEME.sauce} strokeWidth={4} strokeLinecap="round" />
            <Path d="M76 24 L56 32" stroke={THEME.sauce} strokeWidth={4} strokeLinecap="round" />
            <Path d="M40 68 Q50 60 60 68" stroke={THEME.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
          </>
        ) : (
          <Path d="M40 64 Q50 70 60 64" stroke={THEME.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        )}
        {blind && (
          <>
            <Ellipse testID="smoke" cx={50} cy={42} rx={40} ry={18} fill="#cfd8dc" opacity={0.95} />
            <Circle cx={22} cy={36} r={12} fill="#b0bec5" opacity={0.9} />
            <Circle cx={78} cy={46} r={12} fill="#b0bec5" opacity={0.9} />
          </>
        )}
      </Svg>
    </View>
  );
}
