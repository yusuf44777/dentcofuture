export function cellPlacedPoints(cellCount: number, level: number): number {
  return cellCount * level;
}

export function lineClearPoints(lineCount: number, level: number, combo: number): number {
  const base = lineCount * BOARD_LINE_SIZE * 10 * level * Math.max(1, lineCount);
  const comboMultiplier = 1 + Math.max(0, combo - 1) * 0.3;
  return Math.round(base * comboMultiplier);
}

const BOARD_LINE_SIZE = 8;

export function levelBonus(level: number): number {
  return level * 300;
}
