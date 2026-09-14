import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedResult } from '../lib/types';

interface FeedState<R> {
  data: R | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * טוען פיד ומרענן אותו במרווח קבוע. המרווח מתקבל מבחוץ כדי שהמסך יוכל
 * להאיץ כשיש משחק חי ולהאט כשאין.
 */
export function useFeed<R extends FeedResult<unknown>>(
  load: () => Promise<R>,
  intervalMs: number | null,
  deps: unknown[],
): FeedState<R> {
  const [data, setData] = useState<R | null>(null);
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
        // הטעינה נכשלה לגמרי — מציגים פיד ריק שמסומן ככשל, במקום מסך תקוע
        if (!cancelled) {
          setData({
            items: [],
            source: 'demo',
            fetchedAt: new Date().toISOString(),
            error: 'load failed',
          } as unknown as R);
        }
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
