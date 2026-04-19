export const BOARD_COLS = 8;
export const BOARD_ROWS = 8;
export const HAND_SIZE = 3;
export const SCORE_PER_LEVEL = 500;

export const STORAGE_KEYS = {
  highScore: 'block_blast_high_score',
  leaderboard: 'block_blast_leaderboard',
  playerName: 'block_blast_player_name',
} as const;

export const CONGRESS_BRANDING = {
  event: 'DentCo Outliers · 16 Mayıs 2026',
  venue: 'Ümraniye Birikim Okulları',
  host: 'Communitive Dentistry',
};

export type Difficulty = 'easy' | 'normal' | 'hard';

// colorLevel maps into colorsForLevel(): 1→2 colors, 2→3 colors, 4→5 colors
export const DIFFICULTY_PRESETS: Record<Difficulty, { maxShapeSize: number; colorLevel: number }> = {
  easy:   { maxShapeSize: 4, colorLevel: 1 },
  normal: { maxShapeSize: 6, colorLevel: 2 },
  hard:   { maxShapeSize: 9, colorLevel: 4 },
};
