import { useEffect, useMemo, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '../constants/config';
import type { GameSnapshot } from '../game/engine';
import { renderGame } from '../game/renderer';

interface GameCanvasProps {
  snapshot: GameSnapshot;
  canvasRef: RefObject<HTMLCanvasElement>;
}

export function GameCanvas({ snapshot, canvasRef }: GameCanvasProps) {
  const ratio = useMemo(() => BOARD_ROWS / BOARD_COLS, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.clientWidth;
    const height = Math.round(width * ratio);

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderGame(ctx, snapshot, { width, height });
  }, [snapshot, ratio]);

  return <canvas ref={canvasRef} className="game-canvas" aria-label="Plaque Blast game board" />;
}
