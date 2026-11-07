export const COLORS = ['red', 'yellow', 'green', 'blue', 'purple', 'orange'] as const;

export type Color = (typeof COLORS)[number];

export type Code = readonly [Color, Color, Color, Color];
