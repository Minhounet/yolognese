import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import { Point } from '../domain/point';
import { PEG_COLORS, THEME } from './theme';

interface GuardianProps {
  /** Where the eyes look, relative to the guardian's centre; undefined: at the player. */
  readonly gaze?: Point;
  readonly size?: number;
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

export function Guardian({ gaze, size = 120 }: GuardianProps) {
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
    <View testID="guardian" accessibilityLabel={looksAway ? 'guardian looking away' : 'guardian watching'}>
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
        <Path d="M40 64 Q50 70 60 64" stroke={THEME.ink} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
