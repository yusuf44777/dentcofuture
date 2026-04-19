import { type Difficulty } from '../constants/config';

interface StartScreenProps {
  onStart: (difficulty: Difficulty) => void;
  onOpenHowTo: () => void;
}

export function StartScreen({ onStart, onOpenHowTo }: StartScreenProps) {
  return (
    <section className="start-screen card">
      <p className="start-pre">DentCo Outliers sunar</p>
      <h2>BLOCK BLAST</h2>
      <p className="start-copy">
        Blokları 8×8 tahtaya yerleştir.<br />
        Dolu satır ve sütunları temizle!
      </p>

      <div className="difficulty-grid">
        <button onClick={() => onStart('easy')}>Kolay</button>
        <button onClick={() => onStart('normal')}>Normal</button>
        <button onClick={() => onStart('hard')}>Zor</button>
      </div>

      <button className="ghost-btn" onClick={onOpenHowTo}>Nasıl Oynanır?</button>

      <footer>
        <span>Communitive Dentistry</span>
      </footer>
    </section>
  );
}
