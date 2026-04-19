import { useState } from 'react';
import type { LeaderboardEntry } from '../game/engine';
import { renderShareCard } from '../game/renderer';

interface ShareCardProps {
  latestEntry: LeaderboardEntry | null;
  score: number;
  level: number;
}

export function ShareCard({ latestEntry, score, level }: ShareCardProps) {
  const [busy, setBusy] = useState(false);

  const handleShare = async () => {
    if (!latestEntry || busy) return;
    setBusy(true);
    try {
      const blob = await renderShareCard(latestEntry, score, level);
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'plaque-blast-story.png';
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="ghost-btn" disabled={!latestEntry || busy} onClick={handleShare}>
      {busy ? 'Generating...' : 'Share Score Card'}
    </button>
  );
}
