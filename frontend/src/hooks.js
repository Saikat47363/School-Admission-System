import { useCallback, useEffect, useRef, useState } from 'react';

// Calls `fn` now and then every `ms` milliseconds. Keeps the last good data when a
// refresh fails, so a short network blip shows a banner instead of a blank screen.
export function usePolling(fn, ms, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  // Start fresh when the inputs (e.g. student id, hold id) change.
  useEffect(() => {
    setState({ data: null, error: null, loading: true });
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let alive = true;
    let timer;
    const run = async () => {
      try {
        const data = await fnRef.current();
        if (alive) setState({ data, error: null, loading: false });
      } catch (e) {
        if (alive) setState((s) => ({ ...s, error: e.message, loading: false }));
      }
      if (alive) timer = setTimeout(run, ms);
    };
    run();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ms, tick, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function secondsLeft(expiresAt, now) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now) / 1000));
}
