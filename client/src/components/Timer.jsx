import { useEffect, useState } from 'react';

export function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Timer({ timer, big }) {
  const [displaySeconds, setDisplaySeconds] = useState(timer?.remainingSeconds ?? 0);

  useEffect(() => {
    if (!timer) return undefined;
    if (!timer.running || !timer.endsAt) {
      setDisplaySeconds(timer.remainingSeconds);
      return undefined;
    }
    // Clock skew between this browser and the server, recomputed on every fresh poll
    // (serverNow reflects when the server produced this exact snapshot) — lets us tick a
    // smooth local countdown between polls instead of jumping only once per poll.
    const skew = timer.serverNow - Date.now();
    const tick = () => {
      const remaining = Math.max(0, Math.round((timer.endsAt - (Date.now() + skew)) / 1000));
      setDisplaySeconds(remaining);
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [timer?.endsAt, timer?.running, timer?.remainingSeconds, timer?.serverNow]);

  if (!timer) return null;
  const low = displaySeconds <= 60 && timer.running;
  return (
    <span
      className={`mono ${big ? 'big' : ''}`}
      style={{ color: low ? 'var(--bad)' : 'var(--text)', fontWeight: 700, fontSize: big ? '3rem' : undefined }}
    >
      {formatTime(displaySeconds)}
      {!timer.running && <span className="small muted" style={{ marginLeft: 8 }}>(paused)</span>}
    </span>
  );
}
