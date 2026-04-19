import { useEffect, useRef, type RefObject } from 'react';
import { BOARD_COLS, BOARD_ROWS } from '../constants/config';
import type { GameSnapshot } from '../game/engine';

interface InputActions {
  placeBlock: (row: number, col: number) => void;
  setHover: (row: number, col: number) => void;
  clearHover: () => void;
  togglePause: () => void;
}

interface InputOptions {
  canvasRef: RefObject<HTMLCanvasElement>;
  snapshot: GameSnapshot;
  actions: InputActions;
}

export function useInput({ canvasRef, snapshot, actions }: InputOptions): void {
  const pointerRef = useRef<{ x: number; y: number; t: number; id: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key.toLowerCase() === 'p') actions.togglePause();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [actions]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const toGrid = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
      return {
        col: Math.floor((x / rect.width) * BOARD_COLS),
        row: Math.floor((y / rect.height) * BOARD_ROWS),
      };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (snapshot.phase !== 'playing') return;
      const cell = toGrid(e.clientX, e.clientY);
      if (cell) actions.setHover(cell.row, cell.col);
      else actions.clearHover();
    };

    const onMouseLeave = () => actions.clearHover();

    const onPointerDown = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
    };

    const onPointerUp = (e: PointerEvent) => {
      const ptr = pointerRef.current;
      pointerRef.current = null;
      if (!ptr || ptr.id !== e.pointerId) return;
      if (snapshot.phase !== 'playing') return;

      const dx = e.clientX - ptr.x;
      const dy = e.clientY - ptr.y;
      if (Math.hypot(dx, dy) > 16) return;

      const cell = toGrid(e.clientX, e.clientY);
      if (cell) actions.placeBlock(cell.row, cell.col);
    };

    const onPointerCancel = () => { pointerRef.current = null; };

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);

    return () => {
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [actions, canvasRef, snapshot.phase]);
}
