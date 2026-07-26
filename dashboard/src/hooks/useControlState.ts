import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────
//  useControlState — shared bot control-plane state.
//  Polls the dashboard server's /control endpoint so every
//  consumer (CommandStrip, ControlPanel) stays in sync.
// ─────────────────────────────────────────────────────────────

export interface CtrlState { paused: boolean; stop: boolean; }

export const useControlState = () => {
  const [state, setState] = useState<CtrlState>({ paused: false, stop: false });
  const [available, setAvailable] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/control');
      if (r.ok) {
        setState(await r.json());
        setAvailable(true);
      }
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 3000);
    return () => clearInterval(iv);
  }, [refresh]);

  const send = useCallback(async (action: string): Promise<CtrlState | null> => {
    try {
      const r = await fetch('/control', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (r.ok) {
        const s = await r.json();
        setState(s);
        return s;
      }
    } catch { /* server unavailable */ }
    return null;
  }, []);

  return { state, available, send, refresh };
};

export default useControlState;
