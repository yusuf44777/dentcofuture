import { useCallback, useEffect, useRef, useState } from 'react';

interface FullscreenIframeProps {
  src: string;
  title: string;
  thumbnailSrc: string;
}

export function FullscreenIframe({ src, title, thumbnailSrc }: FullscreenIframeProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      return;
    }
    document.exitFullscreen();
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  return (
    <div ref={containerRef} className={`bb-player ${isFullscreen ? 'bb-player--fullscreen' : ''}`}>
      {!isLoaded ? (
        <button
          type="button"
          className="bb-thumb"
          onClick={() => setIsLoaded(true)}
          aria-label="Start Block Blast"
        >
          <img src={thumbnailSrc} alt={title} />
          <span className="bb-play-btn">Play</span>
        </button>
      ) : (
        <iframe src={src} title={title} className="bb-iframe" allowFullScreen />
      )}

      <button
        type="button"
        className="bb-fullscreen-btn"
        onClick={toggleFullscreen}
        aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
      >
        {isFullscreen ? 'Exit' : 'Full'}
      </button>
    </div>
  );
}
