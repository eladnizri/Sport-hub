import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedResult } from '../lib/types';

interface FeedState<T> {
  data: FeedResult<T> | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * טוען פיד ומרענן אותו במרווח קבוע. המרווח מתקבל מבחוץ כדי שהמסך יוכל
 * להאיץ כשיש משחק חי ולהאט כשאין.
 */
export function useFeed<T>(
  load: () => Promise<FeedResult<T>>,
  intervalMs: number | null,
  deps: unknown[],
): FeedState<T> {
  const [data, setData] = useState<FeedResult<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadRef.current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch(() => {
        if (!cancelled) setData({ items: [], source: 'demo', fetchedAt: new Date().toISOString(), error: 'load failed' });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps]);

  useEffect(() => {
    if (!intervalMs) return;
    const id = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, refresh]);

  return { data, loading, refresh };
}
