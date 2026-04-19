import {
  BOARD_COLS,
  BOARD_ROWS,
  DIFFICULTY_PRESETS,
  HAND_SIZE,
  SCORE_PER_LEVEL,
  type Difficulty
} from "../../../dentco_tetris/src/constants/config";
import { COLOR_HEX, colorsForLevel, type CoreColorId } from "../../../dentco_tetris/src/constants/colors";
import {
  canPlaceAnywhere,
  canPlaceBlock,
  clearLines,
  computeGhostAnchor,
  createRandomBlock,
  makeEmptyBoard,
  placeBlockOnBoard,
  type BoardGrid,
  type HandBlock
} from "../../../dentco_tetris/src/game/board";
import { cellPlacedPoints, levelBonus, lineClearPoints } from "../../../dentco_tetris/src/game/scoring";

export const PLAQUE_BLAST_COLS = BOARD_COLS;
export const PLAQUE_BLAST_ROWS = BOARD_ROWS;

export type PlaqueBlastTone = CoreColorId;
export type PlaqueBlastPhase = "idle" | "playing" | "paused" | "gameOver";
export type PlaqueBlastBoard = BoardGrid;
export type PlaqueBlastHandBlock = HandBlock;

export type PlaqueBlastState = {
  board: PlaqueBlastBoard;
  hand: PlaqueBlastHandBlock[];
  selectedIndex: number | null;
  score: number;
  level: number;
  phase: PlaqueBlastPhase;
  statusText: string;
  difficulty: Difficulty;
  maxShapeSize: number;
  colorPool: PlaqueBlastTone[];
};

export const PLAQUE_BLAST_TONE_HEX = COLOR_HEX;

function getPreset(difficulty: Difficulty) {
  return DIFFICULTY_PRESETS[difficulty];
}

function triggerGameOver(state: PlaqueBlastState, statusText = "Oyun bitti! Hiçbir blok sığmıyor."): PlaqueBlastState {
  return {
    ...state,
    phase: "gameOver",
    selectedIndex: null,
    statusText
  };
}

function addScore(state: PlaqueBlastState, points: number): PlaqueBlastState {
  if (points <= 0) {
    return state;
  }

  let nextScore = state.score + points;
  let nextLevel = Math.floor(nextScore / SCORE_PER_LEVEL) + 1;

  if (nextLevel > state.level) {
    for (let level = state.level + 1; level <= nextLevel; level += 1) {
      nextScore += levelBonus(level);
    }
  } else {
    nextLevel = state.level;
  }

  return {
    ...state,
    score: nextScore,
    level: nextLevel
  };
}

function drawHand(state: PlaqueBlastState): PlaqueBlastState {
  const nextHand = Array.from({ length: HAND_SIZE }, () =>
    createRandomBlock(state.colorPool, state.maxShapeSize));

  const anyFits = nextHand.some((block) => canPlaceAnywhere(state.board, block.shape));
  if (!anyFits) {
    return triggerGameOver(
      {
        ...state,
        hand: nextHand
      },
      "Oyun bitti! Yeni bloklar yerleşemiyor."
    );
  }

  return {
    ...state,
    hand: nextHand,
    selectedIndex: 0,
    statusText: "Yeni bloklar geldi!"
  };
}

export function createIdlePlaqueBlastState(): PlaqueBlastState {
  const preset = getPreset("normal");

  return {
    board: makeEmptyBoard(),
    hand: [],
    selectedIndex: null,
    score: 0,
    level: 1,
    phase: "idle",
    statusText: "Başlamak için dokun.",
    difficulty: "normal",
    maxShapeSize: preset.maxShapeSize,
    colorPool: colorsForLevel(preset.colorLevel)
  };
}

export function startPlaqueBlastGame(difficulty: Difficulty = "normal"): PlaqueBlastState {
  const preset = getPreset(difficulty);
  const initial: PlaqueBlastState = {
    board: makeEmptyBoard(),
    hand: [],
    selectedIndex: null,
    score: 0,
    level: 1,
    phase: "playing",
    statusText: "Bir blok seç ve tahtaya yerleştir!",
    difficulty,
    maxShapeSize: preset.maxShapeSize,
    colorPool: colorsForLevel(preset.colorLevel)
  };

  return drawHand(initial);
}

export function restartPlaqueBlastGame(state: PlaqueBlastState): PlaqueBlastState {
  return startPlaqueBlastGame(state.difficulty);
}

export function togglePlaqueBlastPause(state: PlaqueBlastState): PlaqueBlastState {
  if (state.phase !== "playing" && state.phase !== "paused") {
    return state;
  }

  return {
    ...state,
    phase: state.phase === "paused" ? "playing" : "paused",
    statusText: state.phase === "paused" ? "Devam! Blok yerleştir." : "Duraklatıldı"
  };
}

export function selectPlaqueBlastHandIndex(state: PlaqueBlastState, index: number): PlaqueBlastState {
  if (state.phase !== "playing") {
    return state;
  }

  const block = state.hand[index];
  if (!block || block.placed) {
    return state;
  }

  const selectedIndex = state.selectedIndex === index ? null : index;

  return {
    ...state,
    selectedIndex,
    statusText: selectedIndex === null ? "Bir blok seç!" : "Tahtaya dokunarak yerleştir."
  };
}

export function canPlaceSelectedPlaqueBlastBlock(state: PlaqueBlastState, row: number, col: number): boolean {
  if (state.phase !== "playing" || state.selectedIndex === null) {
    return false;
  }

  const selected = state.hand[state.selectedIndex];
  if (!selected || selected.placed) {
    return false;
  }

  const anchor = computeGhostAnchor(selected.shape, row, col);
  return canPlaceBlock(state.board, selected.shape, anchor.row, anchor.col);
}

export function placePlaqueBlastBlock(state: PlaqueBlastState, row: number, col: number): PlaqueBlastState {
  if (state.phase !== "playing") {
    return state;
  }

  if (state.selectedIndex === null) {
    return {
      ...state,
      statusText: "Önce bir blok seç!"
    };
  }

  const selected = state.hand[state.selectedIndex];
  if (!selected || selected.placed) {
    return {
      ...state,
      statusText: "Bu blok kullanılamıyor."
    };
  }

  const anchor = computeGhostAnchor(selected.shape, row, col);
  if (!canPlaceBlock(state.board, selected.shape, anchor.row, anchor.col)) {
    return {
      ...state,
      statusText: "Buraya sığmıyor!"
    };
  }

  const placedBoard = placeBlockOnBoard(state.board, selected.shape, selected.color, anchor.row, anchor.col);
  const placedHand = state.hand.map((block, index) =>
    index === state.selectedIndex ? { ...block, placed: true } : block);

  let nextState = addScore(
    {
      ...state,
      board: placedBoard,
      hand: placedHand,
      selectedIndex: null
    },
    cellPlacedPoints(selected.shape.length, state.level)
  );

  const lineResult = clearLines(nextState.board);
  const totalLines = lineResult.rowsCleared.length + lineResult.colsCleared.length;
  nextState = {
    ...nextState,
    board: lineResult.board
  };

  if (totalLines > 0) {
    nextState = addScore(nextState, lineClearPoints(totalLines, nextState.level, 1));
    nextState = {
      ...nextState,
      statusText: `${totalLines} hat temizlendi!`
    };
  }

  const remaining = nextState.hand.filter((block) => !block.placed);

  if (remaining.length === 0) {
    return drawHand(nextState);
  }

  const anyFits = remaining.some((block) => canPlaceAnywhere(nextState.board, block.shape));
  if (!anyFits) {
    return triggerGameOver(nextState);
  }

  const nextSelectedIndex = nextState.hand.findIndex((block) => !block.placed);

  return {
    ...nextState,
    selectedIndex: nextSelectedIndex >= 0 ? nextSelectedIndex : null,
    statusText: nextSelectedIndex >= 0 ? "Devam et, bir blok daha yerleştir!" : nextState.statusText
  };
}
