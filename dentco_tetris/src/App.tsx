import { FullscreenIframe } from './components/FullscreenIframe';

const rules = [
  'Blokları 8×8 alana sürükleyip bırak.',
  'Dolu satır veya sütunları temizleyerek puan topla.',
  'Ne kadar çok hat temizlersen o kadar hızlı yükselirsin.',
  'Hiçbir blok sığmıyorsa oyun biter.',
];

const features = [
  'Gerçek Block Blast Unity sürümü (local build)',
  'Masaüstü ve mobil uyumlu',
  'Tam ekran desteği',
  'Hızlı yükleme için statik public asset',
];

const screenshots = ['/img/s11080.jpg', '/img/s21080.jpg', '/img/s31080.jpg', '/img/s41080.jpg'];

export default function App() {
  return (
    <main className="bb-shell">
      <section className="bb-hero">
        <p className="bb-badge">Direct Integration</p>
        <h1>Block Blast</h1>
        <p>
          `gangbo/block-blast.best.site` yapısı baz alınarak Unity oyun dosyaları projeye gömüldü.
          Aşağıdan direkt oynayabilirsin.
        </p>
      </section>

      <section className="bb-card">
        <h2>Play</h2>
        <FullscreenIframe
          src="/game/block-blast/index.html"
          title="Block Blast Gameplay"
          thumbnailSrc="/img/s11080.jpg"
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
            <img key={src} src={src} alt={`Block Blast screenshot ${index + 1}`} />
          ))}
        </div>
      </section>
    </main>
  );
}
