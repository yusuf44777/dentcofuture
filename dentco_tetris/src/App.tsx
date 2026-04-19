import { FullscreenIframe } from './components/FullscreenIframe';

const rules = [
  'Parçaları 8×8 tahtaya sürükleyip bırak.',
  'Dolu satır veya sütunları temizleyerek puan kazan.',
  'Zincir temizlemelerde skor çarpanı yükselir.',
  'Hiçbir parça yerleşmezse tur biter.',
];

const features = [
  'tokaa1/blockerino klonu direkt gömülü',
  'Expo web export statik build',
  'Masaüstü + mobil uyumlu',
  'Tam ekran oynanış desteği',
];

const screenshots = ['/img/blockerino-menu.png', '/img/blockerino-chaos.png'];

export default function App() {
  return (
    <main className="bb-shell">
      <section className="bb-hero">
        <p className="bb-badge">Direct Integration</p>
        <h1>Blockerino</h1>
        <p>
          `tokaa1/blockerino` deposunun web çıktısı projeye doğrudan gömüldü.
          Aşağıdan tek tıkla oynayabilirsin.
        </p>
      </section>

      <section className="bb-card">
        <h2>Play</h2>
        <FullscreenIframe
          src="/blockerino/"
          title="Blockerino Gameplay"
          thumbnailSrc="/img/blockerino-menu.png"
        />
      </section>

      <section className="bb-grid">
        <article className="bb-card">
          <h2>Kurallar</h2>
          <ul>
            {rules.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>

        <article className="bb-card">
          <h2>Özellikler</h2>
          <ul>
            {features.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="bb-card">
        <h2>Ekran Görüntüleri</h2>
        <div className="bb-shots">
          {screenshots.map((src, index) => (
            <img key={src} src={src} alt={`Blockerino screenshot ${index + 1}`} />
          ))}
        </div>
      </section>
    </main>
  );
}
