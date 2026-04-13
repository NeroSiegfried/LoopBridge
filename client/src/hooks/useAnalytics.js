/**
 * LoopBridge — Client Analytics
 *
 * Provides useAnalytics() hook and trackEvent() utility.
 *
 * Automatically tracks:
 *   - page_view   on every route change
 *   - page_exit   with duration when leaving a page
 *   - scroll_depth at 25/50/75/100% thresholds
 *
 * Manual tracking via trackEvent():
 *   - click, course_start, lesson_start, lesson_complete,
 *     quiz_start, quiz_submit, quiz_retry, enroll, search, etc.
 *
 * Events are batched and flushed every 5s or on page unload.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ─── Session ID (persisted per browser tab) ─────────────
let sessionId = sessionStorage.getItem('lb_session_id');
if (!sessionId) {
  sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  sessionStorage.setItem('lb_session_id', sessionId);
}

// ─── Event Queue + Flush ────────────────────────────────
const queue = [];
const FLUSH_INTERVAL = 5000;
const MAX_BATCH = 25;

function flush() {
  if (queue.length === 0) return;
  const batch = queue.splice(0, MAX_BATCH);
  const body = JSON.stringify(batch);
  // Use sendBeacon if available (works during unload), else fetch
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/analytics/events', new Blob([body], { type: 'application/json' }));
  } else {
    fetch('/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      credentials: 'include',
      keepalive: true,
    }).catch(() => {});
  }
  // If there are still more, flush again
  if (queue.length > 0) flush();
}

// Flush on interval
setInterval(flush, FLUSH_INTERVAL);

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.addEventListener('pagehide', flush);
}

// ─── Public: enqueue an event ───────────────────────────
export function trackEvent(eventType, data = {}) {
  queue.push({
    sessionId,
    eventType,
    page: window.location.pathname,
    timestamp: new Date().toISOString(),
    ...data,
  });
  // Flush immediately if queue is getting large
  if (queue.length >= MAX_BATCH) flush();
}

// ─── Hook: auto-track page views, exits, scroll depth ──
export function useAnalytics() {
  const location = useLocation();
  const { user } = useAuth();
  const pageEnteredAt = useRef(Date.now());
  const prevPath = useRef(null);
  const scrollThresholds = useRef(new Set());

  // Track page views and exits on route change
  useEffect(() => {
    const now = Date.now();

    // Send page_exit for previous page
    if (prevPath.current !== null) {
      trackEvent('page_exit', {
        page: prevPath.current,
        durationMs: now - pageEnteredAt.current,
        userId: user?.id || null,
        metadata: {
          scrollDepths: Array.from(scrollThresholds.current),
        },
      });
    }

    // Send page_view for new page
    trackEvent('page_view', {
      page: location.pathname,
      userId: user?.id || null,
      referrer: prevPath.current || document.referrer,
      metadata: {
        search: location.search || null,
        hash: location.hash || null,
      },
    });

    prevPath.current = location.pathname;
    pageEnteredAt.current = now;
    scrollThresholds.current = new Set();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll depth tracking
  useEffect(() => {
    const thresholds = [25, 50, 75, 100];
    const onScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const t of thresholds) {
        if (pct >= t && !scrollThresholds.current.has(t)) {
          scrollThresholds.current.add(t);
          trackEvent('scroll_depth', {
            page: location.pathname,
            userId: user?.id || null,
            metadata: { depth: t },
          });
        }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname, user?.id]);

  // Return manual tracking helper
  const track = useCallback((eventType, data = {}) => {
    trackEvent(eventType, { ...data, userId: user?.id || null });
  }, [user?.id]);

  return { track, trackEvent: track };
}

export default useAnalytics;
