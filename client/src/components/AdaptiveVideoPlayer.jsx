import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import Hls from 'hls.js';
import '../styles/adaptive-player.css';

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
  { src, poster, onEnded, onTimeUpdate, className = '', autoPlay = false, quizOverlay = null },
  ref
) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const hlsRef = useRef(null);
  const progressRef = useRef(null);
  const volumeRef = useRef(null);
  const hideControlsTimer = useRef(null);

  const [levels, setLevels] = useState([]);
  const [currentLevel, setCurrentLevel] = useState(-1); // -1 = auto
  const [isHLS, setIsHLS] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [currentBandwidth, setCurrentBandwidth] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Playback state for the custom control bar
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsPane, setSettingsPane] = useState('main'); // 'main' | 'quality' | 'speed'
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seeking, setSeeking] = useState(false);

  // Expose both the video element AND container to parent via ref
  useImperativeHandle(ref, () => ({
    get currentTime() { return videoRef.current?.currentTime; },
    set currentTime(v) { if (videoRef.current) videoRef.current.currentTime = v; },
    play() { return videoRef.current?.play(); },
    pause() { return videoRef.current?.pause(); },
    get paused() { return videoRef.current?.paused; },
    get duration() { return videoRef.current?.duration; },
    get videoElement() { return videoRef.current; },
    get containerElement() { return containerRef.current; },
  }), []);

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

  // Quality selection
  const setQuality = useCallback((levelIndex) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = levelIndex;
      setCurrentLevel(levelIndex);
    }
    setShowSettings(false);
    setSettingsPane('main');
  }, []);

  // Playback rate
  const setSpeed = useCallback((rate) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
    setSettingsPane('main');
  }, []);

  // Sync playback state from video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay    = () => setPlaying(true);
    const onPause   = () => setPlaying(false);
    const onEnded_  = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onTimeUpd = () => { if (!seeking) setCurrentTime(video.currentTime); };
    const onDurChng = () => setDuration(video.duration || 0);
    const onVolChng = () => { setVolume(video.volume); setMuted(video.muted); };
    const onRateChng= () => setPlaybackRate(video.playbackRate);
    video.addEventListener('play',        onPlay);
    video.addEventListener('pause',       onPause);
    video.addEventListener('ended',       onEnded_);
    video.addEventListener('waiting',     onWaiting);
    video.addEventListener('playing',     onPlaying);
    video.addEventListener('canplay',     onCanPlay);
    video.addEventListener('timeupdate',  onTimeUpd);
    video.addEventListener('durationchange', onDurChng);
    video.addEventListener('volumechange',onVolChng);
    video.addEventListener('ratechange',  onRateChng);
    return () => {
      video.removeEventListener('play',        onPlay);
      video.removeEventListener('pause',       onPause);
      video.removeEventListener('ended',       onEnded_);
      video.removeEventListener('waiting',     onWaiting);
      video.removeEventListener('playing',     onPlaying);
      video.removeEventListener('canplay',     onCanPlay);
      video.removeEventListener('timeupdate',  onTimeUpd);
      video.removeEventListener('durationchange', onDurChng);
      video.removeEventListener('volumechange',onVolChng);
      video.removeEventListener('ratechange',  onRateChng);
    };
  }, [seeking]);

  // Fullscreen tracking
  useEffect(() => {
    const onFSChange = () => {
      const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreen(fsEl === containerRef.current);
    };
    document.addEventListener('fullscreenchange', onFSChange);
    document.addEventListener('webkitfullscreenchange', onFSChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFSChange);
      document.removeEventListener('webkitfullscreenchange', onFSChange);
    };
  }, []);

  // Close settings when clicking outside
  useEffect(() => {
    if (!showSettings) return;
    const handler = (e) => {
      if (!containerRef.current?.contains(e.target)) {
        setShowSettings(false);
        setSettingsPane('main');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (!showSettings) setControlsVisible(false);
    }, 3000);
  }, [showSettings]);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
    }
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  }, []);

  const handleProgressClick = useCallback((e) => {
    const bar = progressRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    videoRef.current.currentTime = ratio * duration;
    setCurrentTime(ratio * duration);
  }, [duration]);

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    videoRef.current.volume = v;
    videoRef.current.muted = v === 0;
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const fmt = (s) => {
    if (!isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const activeQualityLabel = currentLevel === -1
    ? `Auto${currentBandwidth && hlsRef.current?.currentLevel >= 0 ? ` (${levelLabel(levels[hlsRef.current.currentLevel])})` : ''}`
    : levelLabel(levels[currentLevel]);

  const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const hasQuality = isHLS && levels.length > 1;

  return (
    <div
      ref={containerRef}
      className={`adaptive-player ${className} ${isFullscreen ? 'is-fullscreen' : ''}`}
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
      onMouseLeave={() => { clearTimeout(hideControlsTimer.current); setControlsVisible(false); }}
      onClick={(e) => {
        // click on video area (not controls) = play/pause
        if (e.target === videoRef.current || e.target === containerRef.current) togglePlay();
      }}
    >
      <video
        ref={videoRef}
        poster={poster || undefined}
        onEnded={onEnded}
        onTimeUpdate={onTimeUpdate ? (e) => onTimeUpdate(e.target.currentTime) : undefined}
        style={{ width: '100%', height: '100%', display: 'block', background: '#000' }}
        playsInline
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Buffering spinner */}
      {buffering && (
        <div className="vp-buffering">
          <div className="vp-spinner" />
        </div>
      )}

      {/* Quiz overlay */}
      {quizOverlay}

      {/* ── Control bar ───────────────────────────────── */}
      <div className={`vp-controls ${controlsVisible || !playing ? 'vp-controls--visible' : ''}`}>

        {/* Progress bar */}
        <div
          ref={progressRef}
          className="vp-progress"
          onClick={handleProgressClick}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
        >
          <div className="vp-progress__track">
            <div
              className="vp-progress__fill"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Buttons row */}
        <div className="vp-bar">
          {/* Play / Pause */}
          <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
            <i className={`fa-solid ${playing ? 'fa-pause' : 'fa-play'}`} />
          </button>

          {/* Volume */}
          <button className="vp-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
            <i className={`fa-solid ${muted || volume === 0 ? 'fa-volume-xmark' : volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high'}`} />
          </button>
          <input
            ref={volumeRef}
            className="vp-volume"
            type="range"
            min="0" max="1" step="0.05"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
          />

          {/* Time */}
          <span className="vp-time">{fmt(currentTime)} / {fmt(duration)}</span>

          {/* Spacer */}
          <div className="vp-spacer" />

          {/* Settings (quality + speed) */}
          <div className="vp-settings-wrap">
            <button
              className="vp-btn"
              onClick={() => { setShowSettings(s => !s); setSettingsPane('main'); }}
              title="Settings"
            >
              <i className="fa-solid fa-gear" />
            </button>

            {showSettings && (
              <div className="vp-settings-menu">
                {settingsPane === 'main' && (
                  <>
                    {hasQuality && (
                      <button className="vp-settings-row" onClick={() => setSettingsPane('quality')}>
                        <span className="vp-settings-row__label">Quality</span>
                        <span className="vp-settings-row__value">
                          {activeQualityLabel} <i className="fa-solid fa-chevron-right" />
                        </span>
                      </button>
                    )}
                    <button className="vp-settings-row" onClick={() => setSettingsPane('speed')}>
                      <span className="vp-settings-row__label">Speed</span>
                      <span className="vp-settings-row__value">
                        {playbackRate === 1 ? 'Normal' : `${playbackRate}×`} <i className="fa-solid fa-chevron-right" />
                      </span>
                    </button>
                  </>
                )}

                {settingsPane === 'quality' && (
                  <>
                    <button className="vp-settings-back" onClick={() => setSettingsPane('main')}>
                      <i className="fa-solid fa-chevron-left" /> Quality
                    </button>
                    <button
                      className={`vp-settings-option ${currentLevel === -1 ? 'vp-settings-option--active' : ''}`}
                      onClick={() => setQuality(-1)}
                    >
                      Auto{currentBandwidth && hlsRef.current?.currentLevel >= 0 ? ` (${levelLabel(levels[hlsRef.current.currentLevel])})` : ''}
                    </button>
                    {[...levels].reverse().map((level, i) => {
                      const idx = levels.length - 1 - i;
                      return (
                        <button
                          key={idx}
                          className={`vp-settings-option ${currentLevel === idx ? 'vp-settings-option--active' : ''}`}
                          onClick={() => setQuality(idx)}
                        >
                          {levelLabel(level)}
                        </button>
                      );
                    })}
                  </>
                )}

                {settingsPane === 'speed' && (
                  <>
                    <button className="vp-settings-back" onClick={() => setSettingsPane('main')}>
                      <i className="fa-solid fa-chevron-left" /> Speed
                    </button>
                    {SPEEDS.map((s) => (
                      <button
                        key={s}
                        className={`vp-settings-option ${playbackRate === s ? 'vp-settings-option--active' : ''}`}
                        onClick={() => setSpeed(s)}
                      >
                        {s === 1 ? 'Normal' : `${s}×`}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button className="vp-btn" onClick={toggleFullscreen} title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            <i className={`fa-solid ${isFullscreen ? 'fa-compress' : 'fa-expand'}`} />
          </button>
        </div>
      </div>
    </div>
  );
});

export default AdaptiveVideoPlayer;
