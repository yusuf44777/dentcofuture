import { BOARD_COLS, BOARD_ROWS } from '../constants/config';
import type { ColorId, CoreColorId } from '../constants/colors';

interface WeightedShape {
  shape: [number, number][];
  distributionPoints: number;
}

// Weighted shape pool aligned with blockerino for more consistent Block Blast pacing.
const WEIGHTED_SHAPES: WeightedShape[] = [
  // L variants
  { shape: [[0, 0], [1, 0], [1, 1], [1, 2]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1], [1, 0], [2, 0]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1], [0, 2], [1, 2]], distributionPoints: 2 },
  { shape: [[0, 1], [1, 1], [2, 0], [2, 1]], distributionPoints: 2 },
  { shape: [[0, 2], [1, 0], [1, 1], [1, 2]], distributionPoints: 2 },
  { shape: [[0, 0], [1, 0], [2, 0], [2, 1]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1], [0, 2], [1, 0]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1], [1, 1], [2, 1]], distributionPoints: 2 },
  // T variants
  { shape: [[0, 0], [0, 1], [0, 2], [1, 1]], distributionPoints: 1.5 },
  { shape: [[0, 0], [1, 0], [1, 1], [2, 0]], distributionPoints: 1.5 },
  { shape: [[0, 1], [1, 0], [1, 1], [1, 2]], distributionPoints: 1.5 },
  { shape: [[0, 1], [1, 0], [1, 1], [2, 1]], distributionPoints: 1.5 },
  // S/Z variants
  { shape: [[0, 1], [0, 2], [1, 0], [1, 1]], distributionPoints: 1 },
  { shape: [[0, 0], [1, 0], [1, 1], [2, 1]], distributionPoints: 1 },
  { shape: [[0, 0], [0, 1], [1, 1], [1, 2]], distributionPoints: 1 },
  { shape: [[0, 1], [1, 0], [1, 1], [2, 0]], distributionPoints: 1 },
  // Bigger / utility
  { shape: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]], distributionPoints: 3 },
  { shape: [[0, 0], [0, 1], [1, 0], [1, 1]], distributionPoints: 6 },
  { shape: [[0, 0], [1, 0], [2, 0], [3, 0]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1], [0, 2], [0, 3]], distributionPoints: 2 },
  { shape: [[0, 0], [1, 0], [2, 0]], distributionPoints: 4 },
  { shape: [[0, 0], [0, 1], [0, 2]], distributionPoints: 4 },
  { shape: [[0, 0], [1, 0]], distributionPoints: 2 },
  { shape: [[0, 0], [0, 1]], distributionPoints: 2 },
];

export const ALL_BLOCK_SHAPES: [number, number][][] = WEIGHTED_SHAPES.map((entry) => entry.shape);

export interface BoardCell {
  id: number;
  color: ColorId;
  special: null;
}

export type BoardGrid = Array<Array<BoardCell | null>>;

export interface CellCoord {
  row: number;
  col: number;
}

export interface HandBlock {
  id: number;
  shape: [number, number][];
  color: CoreColorId;
  placed: boolean;
}

let cellId = 1;
let blockId = 1;

export function createCell(color: ColorId): BoardCell {
  const id = cellId;
  cellId += 1;
  return { id, color, special: null };
}

export function makeEmptyBoard(): BoardGrid {
  return Array.from({ length: BOARD_ROWS }, () => Array(BOARD_COLS).fill(null));
}

export function cloneBoard(board: BoardGrid): BoardGrid {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function canPlaceBlock(
  board: BoardGrid,
  shape: [number, number][],
  anchorRow: number,
  anchorCol: number,
): boolean {
  for (const [dr, dc] of shape) {
    const r = anchorRow + dr;
    const c = anchorCol + dc;
    if (r < 0 || r >= BOARD_ROWS || c < 0 || c >= BOARD_COLS) return false;
    if (board[r][c] !== null) return false;
  }
  return true;
}

export function placeBlockOnBoard(
  board: BoardGrid,
  shape: [number, number][],
  color: CoreColorId,
  anchorRow: number,
  anchorCol: number,
): BoardGrid {
  const next = cloneBoard(board);
  for (const [dr, dc] of shape) {
    next[anchorRow + dr][anchorCol + dc] = createCell(color);
  }
  return next;
}

export function clearLines(board: BoardGrid): {
  board: BoardGrid;
  rowsCleared: number[];
  colsCleared: number[];
} {
  const { rowsCleared, colsCleared } = detectFilledLines(board);

  if (rowsCleared.length === 0 && colsCleared.length === 0) {
    return { board, rowsCleared: [], colsCleared: [] };
  }

  const next = cloneBoard(board);
  rowsCleared.forEach((r) => {
    for (let c = 0; c < BOARD_COLS; c += 1) next[r][c] = null;
  });
  colsCleared.forEach((c) => {
    for (let r = 0; r < BOARD_ROWS; r += 1) next[r][c] = null;
  });

  return { board: next, rowsCleared, colsCleared };
}

export function predictLineClears(
  board: BoardGrid,
  shape: [number, number][],
  anchorRow: number,
  anchorCol: number,
): { rowsCleared: number[]; colsCleared: number[] } {
  if (!canPlaceBlock(board, shape, anchorRow, anchorCol)) {
    return { rowsCleared: [], colsCleared: [] };
  }

  const occupies = (row: number, col: number): boolean =>
    board[row][col] !== null ||
    shape.some(([dr, dc]) => anchorRow + dr === row && anchorCol + dc === col);

  const rowsCleared: number[] = [];
  const colsCleared: number[] = [];

  for (let r = 0; r < BOARD_ROWS; r += 1) {
    let rowFilled = true;
    for (let c = 0; c < BOARD_COLS; c += 1) {
      if (!occupies(r, c)) {
        rowFilled = false;
        break;
      }
    }
    if (rowFilled) rowsCleared.push(r);
  }

  for (let c = 0; c < BOARD_COLS; c += 1) {
    let colFilled = true;
    for (let r = 0; r < BOARD_ROWS; r += 1) {
      if (!occupies(r, c)) {
        colFilled = false;
        break;
      }
    }
    if (colFilled) colsCleared.push(c);
  }

  return { rowsCleared, colsCleared };
}

export function canPlaceAnywhere(board: BoardGrid, shape: [number, number][]): boolean {
  for (let r = 0; r < BOARD_ROWS; r += 1) {
    for (let c = 0; c < BOARD_COLS; c += 1) {
      if (canPlaceBlock(board, shape, r, c)) return true;
    }
  }
  return false;
}

export function computeGhostAnchor(
  shape: [number, number][],
  hoverRow: number,
  hoverCol: number,
): { row: number; col: number } {
  const maxRow = Math.max(...shape.map(([r]) => r));
  const maxCol = Math.max(...shape.map(([, c]) => c));
  const height = maxRow + 1;
  const width = maxCol + 1;

  const rawRow = hoverRow - Math.floor(height / 2);
  const rawCol = hoverCol - Math.floor(width / 2);

  return {
    row: Math.max(0, Math.min(BOARD_ROWS - height, rawRow)),
    col: Math.max(0, Math.min(BOARD_COLS - width, rawCol)),
  };
}

export function createRandomBlock(
  colorPool: CoreColorId[],
  maxShapeSize: number,
): HandBlock {
  const eligible = WEIGHTED_SHAPES.filter((entry) => entry.shape.length <= maxShapeSize);
  const shape = pickWeightedShape(eligible).shape;
  const color = colorPool[Math.floor(Math.random() * colorPool.length)];
  const id = blockId;
  blockId += 1;
  return { id, shape, color, placed: false };
}

export function shapeSize(shape: [number, number][]): { rows: number; cols: number } {
  const rows = Math.max(...shape.map(([r]) => r)) + 1;
  const cols = Math.max(...shape.map(([, c]) => c)) + 1;
  return { rows, cols };
}

function detectFilledLines(board: BoardGrid): { rowsCleared: number[]; colsCleared: number[] } {
  const rowsCleared: number[] = [];
  const colsCleared: number[] = [];

  for (let r = 0; r < BOARD_ROWS; r += 1) {
    if (board[r].every((cell) => cell !== null)) rowsCleared.push(r);
  }

  for (let c = 0; c < BOARD_COLS; c += 1) {
    if (board.every((row) => row[c] !== null)) colsCleared.push(c);
  }

  return { rowsCleared, colsCleared };
}

function pickWeightedShape(pool: WeightedShape[]): WeightedShape {
  const fallbackPool = pool.length > 0 ? pool : WEIGHTED_SHAPES;
  const total = fallbackPool.reduce((sum, entry) => sum + entry.distributionPoints, 0);
  let cursor = Math.random() * total;

  for (let i = 0; i < fallbackPool.length; i += 1) {
    cursor -= fallbackPool[i].distributionPoints;
    if (cursor <= 0) return fallbackPool[i];
  }

  return fallbackPool[fallbackPool.length - 1];
}
