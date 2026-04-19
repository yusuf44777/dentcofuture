export type CoreColorId = 'purple' | 'mint' | 'coral' | 'amber' | 'sky';
export type ColorId = CoreColorId;

export interface ColorToken {
  id: ColorId;
  name: string;
  hex: string;
  introLevel: number;
}

export const CORE_COLORS: ColorToken[] = [
  { id: 'purple', name: 'Plak', hex: '#8B5CF6', introLevel: 1 },
  { id: 'mint', name: 'Florür', hex: '#10B981', introLevel: 1 },
  { id: 'coral', name: 'Bakteri', hex: '#EF4444', introLevel: 2 },
  { id: 'amber', name: 'Kalsiyum', hex: '#F59E0B', introLevel: 3 },
  { id: 'sky', name: 'Mine', hex: '#3B82F6', introLevel: 4 },
];

export const UI_COLORS = {
  bg: '#0A0A0F',
  surface: '#111118',
  card: '#16161F',
  border: 'rgba(255,255,255,0.07)',
  accentPurple: '#8B5CF6',
  accentMint: '#10B981',
  textPrimary: '#F0EFF8',
  textMuted: '#8B8AA8',
  grid: 'rgba(255,255,255,0.03)',
} as const;

export const SPECIAL_ACCENTS = {
  rocket: '#A887FF',
  bomb: '#10B981',
  disco: '#FFD66B',
} as const;

export const COLOR_HEX: Record<ColorId, string> = {
  purple: '#8B5CF6',
  mint: '#10B981',
  coral: '#EF4444',
  amber: '#F59E0B',
  sky: '#3B82F6',
};

export function colorsForLevel(level: number): CoreColorId[] {
  return CORE_COLORS.filter((c) => c.introLevel <= level).map((c) => c.id as CoreColorId);
}
