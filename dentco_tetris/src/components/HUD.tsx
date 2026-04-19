import type { GameSnapshot } from '../game/engine';

interface HUDProps {
  snapshot: GameSnapshot;
}

export function HUD({ snapshot }: HUDProps) {
  return (
    <header className="hud">
      <div className="hud__brand">
        <p className="hud__eyebrow">DentCo Outliers 2026</p>
        <h1>BLOCK BLAST</h1>
      </div>

      <div className="hud__stats">
        <Stat label="Skor" value={snapshot.score.toLocaleString('tr-TR')} />
        <Stat label="Kombo" value={`x${Math.max(1, snapshot.combo)}`} />
        <Stat label="Seviye" value={snapshot.level} />
        <Stat label="Rekor" value={snapshot.highScore.toLocaleString('tr-TR')} />
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="hud__stat">
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}
