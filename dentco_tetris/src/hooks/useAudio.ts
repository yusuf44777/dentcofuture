import { useCallback, useRef } from 'react';

type ToneName = 'blast' | 'combo' | 'line' | 'level' | 'gameOver';

export function useAudio() {
  const ctxRef = useRef<AudioContext | null>(null);

  const ensureContext = useCallback(() => {
    if (!ctxRef.current) {
      const Ctx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      ctxRef.current = new Ctx();
    }
    return ctxRef.current;
  }, []);

  const playTone = useCallback(
    (tone: ToneName) => {
      const ctx = ensureContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = 0.0001;

      const notes: Record<ToneName, number[]> = {
        blast: [220, 330],
        combo: [330, 440, 660],
        line: [180, 120],
        level: [262, 330, 392],
        gameOver: [220, 196, 164],
      };

      notes[tone].forEach((frequency, idx) => {
        const osc = ctx.createOscillator();
        osc.type = tone === 'blast' ? 'square' : 'sine';
        osc.frequency.setValueAtTime(frequency, now + idx * 0.06);
        osc.connect(gain);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.1);
      });

      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
    },
    [ensureContext],
  );

  return { playTone };
}
