import {
  CONGRESS_BRANDING,
  DIFFICULTY_PRESETS,
  HAND_SIZE,
  SCORE_PER_LEVEL,
  STORAGE_KEYS,
  type Difficulty,
} from '../constants/config';
import { type CoreColorId, colorsForLevel } from '../constants/colors';
import {
  canPlaceAnywhere,
  canPlaceBlock,
  clearLines,
  computeGhostAnchor,
  createRandomBlock,
  makeEmptyBoard,
  placeBlockOnBoard,
  predictLineClears,
  type BoardGrid,
  type HandBlock,
} from './board';
import { cellPlacedPoints, levelBonus, lineClearPoints } from './scoring';
import {
  createVisualState,
  pushFloatingText,
  spawnBlastParticles,
  triggerFlash,
  triggerShake,
  updateVisualState,
  type FloatingText,
  type Particle,
  type VisualState,
} from './animations';

export type GamePhase = 'idle' | 'playing' | 'paused' | 'gameOver';

export interface LeaderboardEntry {
  name: string;
  score: number;
  level: number;
  timestamp: number;
}

export interface GhostInfo {
  anchorRow: number;
  anchorCol: number;
  valid: boolean;
  shape: [number, number][];
  color: CoreColorId;
  clearRows: number[];
  clearCols: number[];
}

export interface GameSnapshot {
  board: BoardGrid;
  hand: HandBlock[];
  selectedIndex: number | null;
  ghost: GhostInfo | null;
  phase: GamePhase;
  score: number;
  combo: number;
  level: number;
  highScore: number;
  statusText: string;
  flash: number;
  shake: number;
  particles: Particle[];
  floatingTexts: FloatingText[];
  difficulty: Difficulty;
  leaderboard: LeaderboardEntry[];
  branding: typeof CONGRESS_BRANDING;
}

interface InternalState {
  board: BoardGrid;
  hand: HandBlock[];
  selectedIndex: number | null;
  hoverRow: number | null;
  hoverCol: number | null;
  score: number;
  combo: number;
  level: number;
  highScore: number;
  phase: GamePhase;
  statusText: string;
  visuals: VisualState;
  difficulty: Difficulty;
  maxShapeSize: number;
  colorPool: CoreColorId[];
  leaderboard: LeaderboardEntry[];
}

export class PlaqueBlastEngine {
  private state: InternalState;

  constructor() {
    const { highScore, leaderboard } = loadSavedScores();
    this.state = {
      board: makeEmptyBoard(),
      hand: [],
      selectedIndex: null,
      hoverRow: null,
      hoverCol: null,
      score: 0,
      combo: 0,
      level: 1,
      highScore,
      phase: 'idle',
      statusText: 'Başlamak için seç!',
      visuals: createVisualState(),
      difficulty: 'normal',
      maxShapeSize: 6,
      colorPool: ['purple', 'mint', 'coral'],
      leaderboard,
    };
  }

  start(difficulty: Difficulty): void {
    const preset = DIFFICULTY_PRESETS[difficulty];
    const colorPool = colorsForLevel(preset.colorLevel);

    this.state.board = makeEmptyBoard();
    this.state.hand = [];
    this.state.selectedIndex = null;
    this.state.hoverRow = null;
    this.state.hoverCol = null;
    this.state.score = 0;
    this.state.combo = 0;
    this.state.level = 1;
    this.state.phase = 'playing';
    this.state.difficulty = difficulty;
    this.state.maxShapeSize = preset.maxShapeSize;
    this.state.colorPool = colorPool;
    this.state.statusText = 'Bir blok seç, tahtaya yerleştir!';
    this.state.visuals = createVisualState();

    this.drawHand();
  }

  restart(): void {
    this.start(this.state.difficulty);
  }

  togglePause(): void {
    if (this.state.phase === 'gameOver' || this.state.phase === 'idle') return;
    if (this.state.phase === 'paused') {
      this.state.phase = 'playing';
      this.state.statusText = 'Bir blok seç, tahtaya yerleştir!';
    } else {
      this.state.phase = 'paused';
    }
  }

  selectBlock(index: number): void {
    if (this.state.phase !== 'playing') return;
    const block = this.state.hand[index];
    if (!block || block.placed) return;

    this.state.selectedIndex = this.state.selectedIndex === index ? null : index;
    this.state.statusText = this.state.selectedIndex !== null
      ? 'Tahtaya dokunarak yerleştir!'
      : 'Bir blok seç!';
  }

  setHover(row: number, col: number): void {
    this.state.hoverRow = row;
    this.state.hoverCol = col;
  }

  clearHover(): void {
    this.state.hoverRow = null;
    this.state.hoverCol = null;
  }

  placeBlock(row: number, col: number): void {
    if (this.state.phase !== 'playing') return;
    if (this.state.selectedIndex === null) {
      this.state.statusText = 'Önce bir blok seç!';
      return;
    }

    const block = this.state.hand[this.state.selectedIndex];
    if (!block || block.placed) return;

    const anchor = computeGhostAnchor(block.shape, row, col);

    if (!canPlaceBlock(this.state.board, block.shape, anchor.row, anchor.col)) {
      this.state.statusText = 'Buraya sığmıyor!';
      return;
    }

    // Place block
    this.state.board = placeBlockOnBoard(
      this.state.board,
      block.shape,
      block.color,
      anchor.row,
      anchor.col,
    );

    // Particles for placed cells
    block.shape.forEach(([dr, dc]) => {
      spawnBlastParticles(this.state.visuals, anchor.row + dr, anchor.col + dc, block.color);
    });

    block.placed = true;
    this.state.selectedIndex = null;

    // Score for placed cells
    const placePts = cellPlacedPoints(block.shape.length, this.state.level);
    this.addScore(placePts);

    // Clear lines
    const result = clearLines(this.state.board);
    this.state.board = result.board;
    const totalLines = result.rowsCleared.length + result.colsCleared.length;

    if (totalLines > 0) {
      this.state.combo += totalLines;
      const clearPts = lineClearPoints(totalLines, this.state.level, this.state.combo);
      this.addScore(clearPts);
      triggerFlash(this.state.visuals, Math.min(1, 0.3 * totalLines));
      triggerShake(this.state.visuals, Math.min(1, 0.2 * totalLines));
      pushFloatingText(
        this.state.visuals,
        `${totalLines} HAT x${Math.max(1, this.state.combo)} +${clearPts}`,
        '#FFD66B',
      );
    } else {
      this.state.combo = 0;
      pushFloatingText(this.state.visuals, `+${placePts}`, '#10B981');
    }

    // Check if all hand blocks placed → draw new hand
    const remaining = this.state.hand.filter((b) => !b.placed);
    if (remaining.length === 0) {
      this.drawHand();
      return;
    }

    // Check if any remaining block can still fit
    const anyFits = remaining.some((b) => canPlaceAnywhere(this.state.board, b.shape));
    if (!anyFits) {
      this.triggerGameOver();
      return;
    }

    // Auto-select next unplaced block
    const nextIdx = this.state.hand.findIndex((b) => !b.placed);
    if (nextIdx !== -1) this.state.selectedIndex = nextIdx;

    this.state.statusText = remaining.length > 1
      ? `${remaining.length} blok kaldı!`
      : 'Son blok — yerleştir!';
  }

  update(deltaMs: number): void {
    updateVisualState(this.state.visuals, deltaMs);
  }

  saveScore(playerName: string): LeaderboardEntry {
    const entry: LeaderboardEntry = {
      name: playerName.trim().slice(0, 18) || 'Misafir',
      score: Math.round(this.state.score),
      level: this.state.level,
      timestamp: Date.now(),
    };

    this.state.leaderboard.push(entry);
    this.state.leaderboard.sort((a, b) => b.score - a.score || b.level - a.level);
    this.state.leaderboard = this.state.leaderboard.slice(0, 10);

    localStorage.setItem(STORAGE_KEYS.leaderboard, JSON.stringify(this.state.leaderboard));

    if (entry.score > this.state.highScore) {
      this.state.highScore = entry.score;
      localStorage.setItem(STORAGE_KEYS.highScore, String(this.state.highScore));
    }

    localStorage.setItem(STORAGE_KEYS.playerName, entry.name);
    return entry;
  }

  getSavedPlayerName(): string {
    return localStorage.getItem(STORAGE_KEYS.playerName) ?? '';
  }

  getSnapshot(): GameSnapshot {
    const ghost = this.computeGhost();
    return {
      board: this.state.board,
      hand: this.state.hand,
      selectedIndex: this.state.selectedIndex,
      ghost,
      phase: this.state.phase,
      score: Math.round(this.state.score),
      combo: this.state.combo,
      level: this.state.level,
      highScore: this.state.highScore,
      statusText: this.state.statusText,
      flash: this.state.visuals.flash,
      shake: this.state.visuals.shake,
      particles: this.state.visuals.particles,
      floatingTexts: this.state.visuals.floatingTexts,
      difficulty: this.state.difficulty,
      leaderboard: this.state.leaderboard,
      branding: CONGRESS_BRANDING,
    };
  }

  private computeGhost(): GhostInfo | null {
    if (
      this.state.selectedIndex === null ||
      this.state.hoverRow === null ||
      this.state.hoverCol === null
    ) return null;

    const block = this.state.hand[this.state.selectedIndex];
    if (!block || block.placed) return null;

    const anchor = computeGhostAnchor(block.shape, this.state.hoverRow, this.state.hoverCol);
    const valid = canPlaceBlock(this.state.board, block.shape, anchor.row, anchor.col);
    const clearPreview = valid
      ? predictLineClears(this.state.board, block.shape, anchor.row, anchor.col)
      : { rowsCleared: [], colsCleared: [] };

    return {
      anchorRow: anchor.row,
      anchorCol: anchor.col,
      valid,
      shape: block.shape,
      color: block.color,
      clearRows: clearPreview.rowsCleared,
      clearCols: clearPreview.colsCleared,
    };
  }

  private drawHand(): void {
    this.state.hand = Array.from({ length: HAND_SIZE }, () =>
      createRandomBlock(this.state.colorPool, this.state.maxShapeSize),
    );
    this.state.selectedIndex = 0;

    const anyFits = this.state.hand.some((b) => canPlaceAnywhere(this.state.board, b.shape));
    if (!anyFits) {
      this.triggerGameOver();
      return;
    }

    this.state.statusText = 'Yeni bloklar geldi!';
  }

  private addScore(pts: number): void {
    this.state.score += pts;

    const nextLevel = Math.floor(this.state.score / SCORE_PER_LEVEL) + 1;
    if (nextLevel > this.state.level) {
      for (let lv = this.state.level + 1; lv <= nextLevel; lv += 1) {
        const bonus = levelBonus(lv);
        this.state.score += bonus;
        pushFloatingText(this.state.visuals, `SEVİYE ${lv}! +${bonus}`, '#A49BFF');
      }
      this.state.level = nextLevel;
    }

    if (this.state.score > this.state.highScore) {
      this.state.highScore = Math.round(this.state.score);
      localStorage.setItem(STORAGE_KEYS.highScore, String(this.state.highScore));
    }
  }

  private triggerGameOver(): void {
    this.state.phase = 'gameOver';
    this.state.selectedIndex = null;
    this.state.combo = 0;
    this.state.statusText = 'Oyun Bitti! Hiçbir blok sığmıyor.';
    triggerFlash(this.state.visuals, 1);
    triggerShake(this.state.visuals, 1);

    if (this.state.score > this.state.highScore) {
      this.state.highScore = Math.round(this.state.score);
      localStorage.setItem(STORAGE_KEYS.highScore, String(this.state.highScore));
    }
  }
}

function loadSavedScores(): { highScore: number; leaderboard: LeaderboardEntry[] } {
  const raw = Number(localStorage.getItem(STORAGE_KEYS.highScore) ?? 0);
  const highScore = Number.isFinite(raw) ? raw : 0;

  let leaderboard: LeaderboardEntry[] = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.leaderboard) ?? '[]') as LeaderboardEntry[];
    if (Array.isArray(parsed)) leaderboard = parsed;
  } catch {
    leaderboard = [];
  }

  return { highScore, leaderboard };
}
