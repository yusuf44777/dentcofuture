import { useEffect, useRef } from 'react';

export function useGameLoop(callback: (deltaMs: number) => void, enabled = true): void {
  const cbRef = useRef(callback);
  const lastRef = useRef<number>(performance.now());

  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let active = true;

    const loop = (time: number) => {
      if (!active) return;
      const delta = Math.min(50, time - lastRef.current);
      lastRef.current = time;
      cbRef.current(delta);
      frame = requestAnimationFrame(loop);
    };

    frame = requestAnimationFrame(loop);

    return () => {
      active = false;
      cancelAnimationFrame(frame);
    };
  }, [enabled]);
}
