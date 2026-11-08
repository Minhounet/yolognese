import { Color } from '../domain/color';

export const PEG_COLORS: Readonly<Record<Color, string>> = {
  red: '#e53935',
  yellow: '#fdd835',
  green: '#43a047',
  blue: '#1e88e5',
  purple: '#8e24aa',
  orange: '#fb8c00',
};

export const THEME = {
  background: '#fff4e0',
  board: '#f3d9b1',
  sauce: '#b23a22',
  ink: '#3b2314',
  hidden: '#7a5a43',
  empty: '#e8c99a',
  meatball: '#8d5a3b',
  dust: '#c9a77c',
  meatballDark: '#6e4229',
  life: '#43a047',
} as const;
