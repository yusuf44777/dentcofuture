import { useState } from 'react';
import type { GameSnapshot, LeaderboardEntry } from '../game/engine';

interface GameOverProps {
  snapshot: GameSnapshot;
  defaultName: string;
  onSave: (name: string) => LeaderboardEntry;
  onPlayAgain: () => void;
  onShowLeaderboard: () => void;
}

export function GameOver({ snapshot, defaultName, onSave, onPlayAgain, onShowLeaderboard }: GameOverProps) {
  const [name, setName] = useState(defaultName || '');

  if (snapshot.phase !== 'gameOver') return null;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onSave(name);
  };

  return (
    <div className="overlay">
      <div className="gameover card">
        <h3>OYUN BİTTİ</h3>
        <p className="score-line">Final Skoru: {snapshot.score.toLocaleString('tr-TR')}</p>
        <p className="score-line">Seviye {snapshot.level}</p>

        <p className="branding-line">DentCo Outliers · 16 Mayıs 2026</p>
        <p className="branding-line">Ümraniye Birikim Okulları · Communitive Dentistry</p>

        <form onSubmit={submit} className="name-form">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 18))}
            placeholder="İsminizi girin"
            required
          />
          <button type="submit">Skoru Kaydet</button>
        </form>

        <div className="gameover-actions">
          <button onClick={onPlayAgain}>Tekrar Oyna</button>
          <button className="ghost-btn" onClick={onShowLeaderboard}>Sıralama</button>
        </div>
      </div>
    </div>
  );
}
