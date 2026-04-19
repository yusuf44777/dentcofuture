import { useEffect, useRef } from 'react';
import type { HandBlock } from '../game/board';
import { renderHandBlock } from '../game/renderer';

interface HandDisplayProps {
  hand: HandBlock[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function HandDisplay({ hand, selectedIndex, onSelect }: HandDisplayProps) {
  return (
    <div className="hand-display">
      {hand.map((block, index) => (
        <HandBlockCanvas
          key={block.id}
          block={block}
          selected={selectedIndex === index}
          onSelect={() => !block.placed && onSelect(index)}
        />
      ))}
    </div>
  );
}

interface HandBlockCanvasProps {
  block: HandBlock;
  selected: boolean;
  onSelect: () => void;
}

function HandBlockCanvas({ block, selected, onSelect }: HandBlockCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const logicalSize = canvas.clientWidth || 120;
    canvas.width = Math.floor(logicalSize * dpr);
    canvas.height = Math.floor(logicalSize * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    renderHandBlock(ctx, block, logicalSize, logicalSize, selected);
  }, [block, selected]);

  return (
    <canvas
      ref={ref}
      className={`hand-block ${selected ? 'hand-block--selected' : ''} ${block.placed ? 'hand-block--placed' : ''}`}
      onClick={onSelect}
      aria-label={block.placed ? 'Yerleştirildi' : 'Blok seç'}
    />
  );
}
