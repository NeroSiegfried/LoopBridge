import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';

/**
 * AdaptiveVideoPlayer — HLS-capable video player with quality selection.
 *
 * If the `src` is an .m3u8 manifest, it uses hls.js for adaptive bitrate
 * streaming with auto quality selection + manual override (like YouTube).
 * Falls back to native <video> for Safari (which supports HLS natively)
 * or for plain .mp4 URLs.
 *
 * Props:
 *   src           — video URL (.mp4 or .m3u8 HLS manifest)
 *   poster        — optional poster/thumbnail image
 *   onEnded       — callback when video ends
 *   onTimeUpdate  — callback with current time (for quiz pause-points)
 *   className     — CSS class for the container
 *   autoPlay      — boolean
 */
const AdaptiveVideoPlayer = forwardRef(function AdaptiveVideoPlayer(
  { src, poster, onEnded, onTimeUpdate, className = '', autoPlay = false },
  ref
) {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const [levels, setLevels] = useState([]); // available quality levels
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto
  const [showQuality, setShowQuality] = useState(false);
  const [isHLS, setIsHLS] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentBandwidth, setCurrentBandwidth] = useState(null);

  // Expose the video element to parent via ref
  useImperativeHandle(ref, () => videoRef.current, []);

  const isM3U8 = src && src.includes('.m3u8');

  // Label a quality level
  const levelLabel = useCallback((level) => {
    if (!level) return 'Auto';
    const h = level.height;
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    if (h >= 360) return '360p';
    return `${h}p`;
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setLevels([]);
    setCurrentLevel(-1);
    setIsHLS(false);

    if (!isM3U8) {
      // Plain video file — use native <video>
      video.src = src;
      return;
    }

    // Check for native HLS support (Safari / iOS)
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
      setIsHLS(true);
      // Safari handles quality internally, no hls.js needed
      return;
    }

    // Use hls.js for browsers that don't support HLS natively
    initHls(Hls, video);

    function initHls(Hls, videoEl) {
      if (!Hls.isSupported()) {
        // Browser doesn't support MSE either — fallback
        videoEl.src = src;
        return;
      }

      const hls = new Hls({
        startLevel: -1, // auto
        capLevelToPlayerSize: false,  // let ABR use bandwidth, not player size
        abrEwmaDefaultEstimate: 500000, // start with 500kbps estimate
        abrEwmaFastLive: 3.0,
        abrEwmaSlowLive: 9.0,
        abrEwmaFastVoD: 3.0,
        abrEwmaSlowVoD: 9.0,
        abrBandWidthFactor: 0.95,
        abrBandWidthUpFactor: 0.7,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        maxBufferHole: 0.5,
        lowLatencyMode: false,
        testBandwidth: true,
      });

      hls.loadSource(src);
      hls.attachMedia(videoEl);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setLevels(data.levels || []);
        setIsHLS(true);
        if (autoPlay) videoEl.play().catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.FRAG_BUFFERED, (_, data) => {
        if (data.stats) {
          const bw = Math.round(data.stats.bwEstimate / 1000); // kbps
          setCurrentBandwidth(bw);
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[HLS] Network error, trying recovery...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[HLS] Media error, trying recovery...');
              hls.recoverMediaError();
              break;
            default:
              console.error('[HLS] Fatal error:', data);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src, isM3U8, autoPlay]);

  // Quality selection handler
  const setQuality = useCallback((levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex; // -1 = auto
      setCurrentLevel(levelIndex);
    }
    setShowQuality(false);
  }, []);

  // Buffering indicator
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);

    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);

    return () => {
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
    };
  }, []);

  return (
    <div className={`adaptive-player ${className}`} style={{ position: 'relative' }}>
      <video
        ref={videoRef}
        controls
        controlsList="nodownload"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        poster={poster || undefined}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate ? (e) => onTimeUpdate(e.target.currentTime) : undefined}
        style={{ width: '100%', height: '100%', background: '#000' }}
        playsInline
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="player-buffering">
          <div className="buffering-spinner" />
        </div>
      )}

      {/* Quality selector (only for HLS with multiple levels) */}
      {isHLS && levels.length > 1 && (
        <div className="quality-selector">
          <button
            className="quality-btn"
            onClick={() => setShowQuality(!showQuality)}
            title="Video quality"
          >
            <i className="fa-solid fa-gear" />
            <span className="quality-current">
              {currentLevel === -1 ? 'Auto' : levelLabel(levels[currentLevel])}
            </span>
            {currentBandwidth && (
              <span className="quality-bandwidth">{currentBandwidth} kbps</span>
            )}
          </button>

          {showQuality && (
            <div className="quality-menu">
              <button
                className={`quality-option ${currentLevel === -1 ? 'active' : ''}`}
                onClick={() => setQuality(-1)}
              >
                Auto {currentLevel === -1 && currentBandwidth ? `(${levelLabel(levels[hlsRef.current?.currentLevel])})` : ''}
              </button>
              {levels.map((level, idx) => (
                <button
                  key={idx}
                  className={`quality-option ${currentLevel === idx ? 'active' : ''}`}
                  onClick={() => setQuality(idx)}
                >
                  {levelLabel(level)}
                  <span className="quality-bitrate">
                    {Math.round(level.bitrate / 1000)} kbps
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default AdaptiveVideoPlayer;
