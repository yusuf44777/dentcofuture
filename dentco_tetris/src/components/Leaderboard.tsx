import type { LeaderboardEntry } from '../game/engine';

interface LeaderboardProps {
  open: boolean;
  entries: LeaderboardEntry[];
  onClose: () => void;
  highlightName?: string;
}

export function Leaderboard({ open, entries, onClose, highlightName }: LeaderboardProps) {
  if (!open) return null;

  return (
    <div className="overlay">
      <div className="leaderboard-modal card">
        <header>
          <h3>Congress Leaderboard</h3>
          <button onClick={onClose}>Close</button>
        </header>

        <ol>
          {entries.length === 0 && <li>No entries yet</li>}
          {entries.map((entry, index) => {
            const medalClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';
            const isHighlight = highlightName && entry.name === highlightName;

            return (
              <li key={`${entry.timestamp}-${entry.name}`} className={`${medalClass} ${isHighlight ? 'highlight' : ''}`.trim()}>
                <span>
                  #{index + 1} {entry.name}
                </span>
                <span>{entry.score.toLocaleString('en-US')}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
