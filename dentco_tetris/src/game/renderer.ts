import { COLOR_HEX } from '../constants/colors';
import { BOARD_COLS, BOARD_ROWS, CONGRESS_BRANDING } from '../constants/config';
import type { GameSnapshot, GhostInfo, LeaderboardEntry } from './engine';
import type { BoardCell, HandBlock } from './board';

export interface RenderOptions {
  width: number;
  height: number;
}

export function renderGame(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  opts: RenderOptions,
): void {
  const { width, height } = opts;
  const cellW = width / BOARD_COLS;
  const cellH = height / BOARD_ROWS;

  ctx.save();
  if (snapshot.shake > 0) {
    const amp = 4 * snapshot.shake;
    ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
  }

  ctx.clearRect(0, 0, width, height);
  drawBackground(ctx, cellW, cellH, width, height);
  drawBoardCells(ctx, snapshot, cellW, cellH);
  drawClearPreview(ctx, snapshot.ghost, cellW, cellH);
  drawGhost(ctx, snapshot.ghost, cellW, cellH);
  drawParticles(ctx, snapshot, cellW, cellH);
  drawFloatingTexts(ctx, snapshot, cellW, cellH);

  if (snapshot.flash > 0) {
    ctx.fillStyle = `rgba(139, 92, 246, ${0.22 * snapshot.flash})`;
    ctx.fillRect(0, 0, width, height);
  }

  if (snapshot.phase === 'paused' || snapshot.phase === 'gameOver') {
    const label = snapshot.phase === 'paused' ? 'DURAKLADI' : 'BİTTİ';
    drawOverlayLabel(ctx, width, height, label);
  }

  ctx.restore();
}

export function renderHandBlock(
  ctx: CanvasRenderingContext2D,
  block: HandBlock,
  canvasW: number,
  canvasH: number,
  selected: boolean,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);

  if (block.placed) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    roundedRect(ctx, 4, 4, canvasW - 8, canvasH - 8, 14);
    ctx.fill();
    return;
  }

  const maxRow = Math.max(...block.shape.map(([r]) => r)) + 1;
  const maxCol = Math.max(...block.shape.map(([, c]) => c)) + 1;
  const padding = 12;
  const cellSize = Math.min(
    (canvasW - padding * 2) / maxCol,
    (canvasH - padding * 2) / maxRow,
  );

  const totalW = maxCol * cellSize;
  const totalH = maxRow * cellSize;
  const offsetX = (canvasW - totalW) / 2;
  const offsetY = (canvasH - totalH) / 2;

  const color = COLOR_HEX[block.color];

  block.shape.forEach(([r, c]) => {
    drawBlock(ctx, offsetX + c * cellSize, offsetY + r * cellSize, cellSize, cellSize, color, null);
  });

  if (selected) {
    ctx.strokeStyle = '#4ED4FF';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 5]);
    roundedRect(ctx, 3, 3, canvasW - 6, canvasH - 6, 14);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

export async function renderShareCard(
  entry: LeaderboardEntry,
  score: number,
  level: number,
): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0A0A0F');
  gradient.addColorStop(0.45, '#121126');
  gradient.addColorStop(1, '#0A101B');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let y = 0; y < canvas.height; y += 42) ctx.fillRect(0, y, canvas.width, 1);

  ctx.font = '700 40px Syne, sans-serif';
  ctx.fillStyle = '#10B981';
  ctx.fillText('DentCo Outliers sunar', 90, 170);

  ctx.font = '800 110px Syne, sans-serif';
  ctx.fillStyle = '#F0EFF8';
  ctx.fillText('BLOCK', 90, 310);
  ctx.fillText('BLAST', 90, 420);

  ctx.font = '700 58px Orbitron, monospace';
  ctx.fillStyle = '#8B5CF6';
  ctx.fillText(`SKOR  ${score.toLocaleString('tr-TR')}`, 90, 610);
  ctx.fillText(`SEVİYE  ${level}`, 90, 690);

  ctx.font = '700 46px Orbitron, monospace';
  ctx.fillStyle = '#FFD66B';
  ctx.fillText(`#${entry.name.toUpperCase()}`, 90, 810);

  ctx.font = '600 34px Manrope, sans-serif';
  ctx.fillStyle = '#A2A0C2';
  ctx.fillText(CONGRESS_BRANDING.event, 90, 1000);
  ctx.fillText(CONGRESS_BRANDING.venue, 90, 1050);
  ctx.fillText(CONGRESS_BRANDING.host, 90, 1100);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  cellW: number,
  cellH: number,
  width: number,
  height: number,
): void {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#0B1A2D');
  gradient.addColorStop(0.48, '#081322');
  gradient.addColorStop(1, '#050B16');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const x = col * cellW;
      const y = row * cellH;
      const shade = (row + col) % 2 === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.025)';
      ctx.fillStyle = shade;
      roundedRect(ctx, x + 2, y + 2, cellW - 4, cellH - 4, 10);
      ctx.fill();
    }
  }
}

function drawClearPreview(
  ctx: CanvasRenderingContext2D,
  ghost: GhostInfo | null,
  cellW: number,
  cellH: number,
): void {
  if (!ghost || !ghost.valid) return;
  if (ghost.clearRows.length === 0 && ghost.clearCols.length === 0) return;

  const clearColor = toRGBA(COLOR_HEX[ghost.color], 0.22);
  const glowColor = toRGBA(COLOR_HEX[ghost.color], 0.42);

  ghost.clearRows.forEach((row) => {
    const y = row * cellH;
    ctx.fillStyle = clearColor;
    roundedRect(ctx, 2, y + 3, BOARD_COLS * cellW - 4, cellH - 6, 11);
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    roundedRect(ctx, 2, y + 3, BOARD_COLS * cellW - 4, cellH - 6, 11);
    ctx.stroke();
  });

  ghost.clearCols.forEach((col) => {
    const x = col * cellW;
    ctx.fillStyle = clearColor;
    roundedRect(ctx, x + 3, 2, cellW - 6, BOARD_ROWS * cellH - 4, 11);
    ctx.fill();
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 2;
    roundedRect(ctx, x + 3, 2, cellW - 6, BOARD_ROWS * cellH - 4, 11);
    ctx.stroke();
  });
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  ghost: GhostInfo | null,
  cellW: number,
  cellH: number,
): void {
  if (!ghost) return;

  const baseColor = COLOR_HEX[ghost.color];
  const alpha = ghost.valid ? 0.5 : 0.18;
  const strokeColor = ghost.valid ? toRGBA(baseColor, 0.85) : 'rgba(239,68,68,0.7)';

  ghost.shape.forEach(([dr, dc]) => {
    const x = (ghost.anchorCol + dc) * cellW;
    const y = (ghost.anchorRow + dr) * cellH;
    const inset = cellW * 0.07;
    const radius = Math.max(6, cellW * 0.2);

    ctx.fillStyle = ghost.valid ? toRGBA(baseColor, alpha) : `rgba(239,68,68,${alpha})`;
    roundedRect(ctx, x + inset, y + inset, cellW - inset * 2, cellH - inset * 2, radius);
    ctx.fill();

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    roundedRect(ctx, x + inset, y + inset, cellW - inset * 2, cellH - inset * 2, radius);
    ctx.stroke();
  });
}

function drawBoardCells(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  cellW: number,
  cellH: number,
): void {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const cell = snapshot.board[row]?.[col];
      if (!cell) continue;
      drawBlock(ctx, col * cellW, row * cellH, cellW, cellH, COLOR_HEX[cell.color], cell);
    }
  }
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  cellW: number,
  cellH: number,
): void {
  snapshot.particles.forEach((p) => {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = toRGBA(p.color, alpha);
    ctx.beginPath();
    ctx.arc(p.x * cellW, p.y * cellH, p.radius * cellW * alpha, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawFloatingTexts(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  cellW: number,
  cellH: number,
): void {
  snapshot.floatingTexts.forEach((t) => {
    const alpha = Math.max(0, t.life / t.maxLife);
    ctx.font = `700 ${Math.max(14, cellW * 0.42)}px Orbitron, monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = toRGBA(t.color, alpha);
    ctx.fillText(t.text, t.x * cellW, t.y * cellH);
  });
  ctx.textAlign = 'left';
}

function drawOverlayLabel(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
): void {
  ctx.fillStyle = 'rgba(8,8,14,0.65)';
  ctx.fillRect(0, 0, width, height);
  ctx.font = `800 ${Math.max(22, width * 0.09)}px Syne, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#F0EFF8';
  ctx.fillText(text, width / 2, height / 2);
  ctx.textAlign = 'left';
}

function drawBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  _cell: BoardCell | null,
): void {
  const inset = w * 0.07;
  const radius = Math.max(6, w * 0.22);
  const bx = x + inset;
  const by = y + inset;
  const bw = w - inset * 2;
  const bh = h - inset * 2;

  const topColor = lighten(color, 0.3);
  const sideColor = darken(color, 0.06);
  const bottomColor = darken(color, 0.42);

  const grad = ctx.createLinearGradient(bx, by, bx, by + bh);
  grad.addColorStop(0, topColor);
  grad.addColorStop(0.38, sideColor);
  grad.addColorStop(1, bottomColor);
  ctx.fillStyle = grad;
  roundedRect(ctx, bx, by, bw, bh, radius);
  ctx.fill();

  const bevel = Math.max(2, bw * 0.08);
  const shineGrad = ctx.createLinearGradient(bx, by, bx + bw * 0.5, by + bh * 0.45);
  shineGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
  shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = shineGrad;
  roundedRect(
    ctx,
    bx + bevel * 0.55,
    by + bevel * 0.55,
    bw - bevel * 1.1,
    bh * 0.42,
    Math.max(3, radius * 0.6),
  );
  ctx.fill();

  ctx.strokeStyle = toRGBA(lighten(color, 0.42), 0.7);
  ctx.lineWidth = Math.max(1.5, bw * 0.05);
  ctx.beginPath();
  ctx.moveTo(bx + radius * 0.6, by + bevel * 0.55);
  ctx.lineTo(bx + bw - radius * 0.55, by + bevel * 0.55);
  ctx.moveTo(bx + bevel * 0.55, by + radius * 0.6);
  ctx.lineTo(bx + bevel * 0.55, by + bh - radius * 0.6);
  ctx.stroke();

  ctx.strokeStyle = toRGBA(darken(color, 0.46), 0.85);
  ctx.beginPath();
  ctx.moveTo(bx + bw - bevel * 0.5, by + radius * 0.6);
  ctx.lineTo(bx + bw - bevel * 0.5, by + bh - radius * 0.6);
  ctx.moveTo(bx + radius * 0.6, by + bh - bevel * 0.5);
  ctx.lineTo(bx + bw - radius * 0.6, by + bh - bevel * 0.5);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  roundedRect(ctx, bx, by, bw, bh, radius);
  ctx.stroke();
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function toRGBA(color: string, alpha: number): string {
  const normalized = color.replace('#', '');
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : normalized;
  const n = parseInt(value, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

function lighten(hex: string, amount: number): string {
  return adjustColor(hex, Math.abs(amount));
}

function darken(hex: string, amount: number): string {
  return adjustColor(hex, -Math.abs(amount));
}

function adjustColor(hex: string, amount: number): string {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3 ? raw.split('').map((ch) => ch + ch).join('') : raw;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  const shift = (v: number): number => {
    const next = amount >= 0 ? v + (255 - v) * amount : v * (1 + amount);
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `#${shift(r).toString(16).padStart(2, '0')}${shift(g).toString(16).padStart(2, '0')}${shift(b).toString(16).padStart(2, '0')}`;
}
