import { useEffect, useState } from 'react';
import { fetchState, callAction, usePolling } from '../api';
import Timer from '../components/Timer';
import NewsFeed from '../components/NewsFeed';
import { RESOURCE_KEYS, RESOURCE_ICONS } from '../resourceIcons';
import { COUNTRY_LIST } from '../countryList';

// Rounds 9 and 10 both start trading with no announcement. Round 10's Battery Boom has no
// player action — it reveals (and scores) as a pure surprise once the round is 'locked'.
// Round 9's vote is a real decision, so trading closes into a 'voting' phase first; the
// event reveals there (explaining the vote), countries submit their choice, and Reveal
// Round 9 Results is what finally scores the round and locks it. See the matching logic in
// server/src/engine/roundLifecycle.js.
const NO_PRE_REVEAL_ROUNDS = [9, 10];

function revealEventDisabledReason(state) {
  if (state.eventRevealed) return 'already revealed';
  if (state.round === 9 && state.phase !== 'voting') return "Round 9 reveals once trading closes";
  if (state.round === 10 && state.phase !== 'locked') return "This round's twist only reveals after the timer reaches 0";
  return null;
}

function nextStepHint(state) {
  const isSurprise = NO_PRE_REVEAL_ROUNDS.includes(state.round);
  if (state.phase === 'game_over') return '🏁 The game has ended.';
  if (state.phase === 'active') {
    if (isSurprise) return '⏳ Trading is open — the twist reveals once the timer ends.';
    return '⏳ Trading is open — wait for the timer, or use Force End Round to skip (testing only).';
  }
  if (state.phase === 'voting') {
    if (!state.eventRevealed) return '👉 Next: Reveal Event to explain the vote';
    return '🗳 Waiting for every country to vote, then Reveal Round 9 Results';
  }
  if (state.phase === 'locked') {
    if (!state.eventRevealed) return '👉 Next: Reveal Event (what just happened)';
    return '👉 Next: click Next Round';
  }
  if (!state.eventRevealed && !isSurprise) return '👉 Next: Reveal Event';
  return '👉 Next: Start Timer';
}

function LoginForm({ onSubmit, error, busy }) {
  const [password, setPassword] = useState('');

  const submit = (e) => {
    e.preventDefault();
    onSubmit(password);
  };

  return (
    <div className="app-shell col center" style={{ minHeight: '100vh' }}>
      <form className="card col" onSubmit={submit} style={{ width: 320, padding: '32px 28px' }}>
        <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>THE TABLE</div>
        <h2 style={{ marginTop: 0, marginBottom: 4 }}>🛠 Admin Login</h2>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
        />
        {error && <div className="badge bad">{error}</div>}
        <button disabled={busy} type="submit">Log In</button>
      </form>
    </div>
  );
}

function PenaltyForm({ credentials, onActed }) {
  const [country, setCountry] = useState('ETHIOPIA');
  const [resource, setResource] = useState('oil');
  const [amount, setAmount] = useState(1);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const res = await callAction('admin:applyPenalty', { country, resource, amount: Number(amount) }, credentials);
    setMsg(res.ok ? 'Applied.' : res.reason);
    if (res.ok) onActed();
  };

  return (
    <form className="col" onSubmit={submit}>
      <div className="row wrap">
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
        </select>
        <select value={resource} onChange={(e) => setResource(e.target.value)}>
          {RESOURCE_KEYS.map((r) => <option key={r} value={r}>{RESOURCE_ICONS[r]} {r}</option>)}
        </select>
        <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 70 }} />
        <button type="submit">Apply Penalty</button>
      </div>
      {msg && <div className="small muted">{msg}</div>}
    </form>
  );
}

function OverrideForm({ credentials, onActed }) {
  const [country, setCountry] = useState('ETHIOPIA');
  const [fields, setFields] = useState({ oil: '', gas: '', mineral: '', water: '', food: '', power: '', score: '', specialMoveUsesLeft: '', reinvestCountUsed: '' });
  const [gasUnlocked, setGasUnlocked] = useState(null);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const resources = {};
    for (const r of RESOURCE_KEYS) if (fields[r] !== '') resources[r] = Number(fields[r]);
    const patch = { resources };
    if (fields.score !== '') patch.score = Number(fields.score);
    if (fields.specialMoveUsesLeft !== '') patch.specialMoveUsesLeft = Number(fields.specialMoveUsesLeft);
    if (fields.reinvestCountUsed !== '') patch.reinvestCountUsed = Number(fields.reinvestCountUsed);
    if (gasUnlocked !== null) patch.gasUnlocked = gasUnlocked;

    const res = await callAction('admin:override', { country, patch }, credentials);
    setMsg(res.ok ? 'Override applied.' : res.reason);
    if (res.ok) onActed();
  };

  return (
    <form className="col" onSubmit={submit}>
      <select value={country} onChange={(e) => setCountry(e.target.value)}>
        {COUNTRY_LIST.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
      </select>
      <div className="row wrap">
        {RESOURCE_KEYS.map((r) => (
          <label key={r} className="small col" style={{ gap: 2 }}>
            {RESOURCE_ICONS[r]} {r}
            <input type="number" value={fields[r]} onChange={(e) => setFields({ ...fields, [r]: e.target.value })} style={{ width: 60 }} placeholder="—" />
          </label>
        ))}
      </div>
      <div className="row wrap">
        <label className="small col" style={{ gap: 2 }}>Score
          <input type="number" value={fields.score} onChange={(e) => setFields({ ...fields, score: e.target.value })} style={{ width: 70 }} placeholder="—" />
        </label>
        <label className="small col" style={{ gap: 2 }}>Special Move uses left
          <input type="number" value={fields.specialMoveUsesLeft} onChange={(e) => setFields({ ...fields, specialMoveUsesLeft: e.target.value })} style={{ width: 70 }} placeholder="—" />
        </label>
        <label className="small col" style={{ gap: 2 }}>Reinvest count used
          <input type="number" value={fields.reinvestCountUsed} onChange={(e) => setFields({ ...fields, reinvestCountUsed: e.target.value })} style={{ width: 70 }} placeholder="—" />
        </label>
        <label className="small col" style={{ gap: 2 }}>Turkmenistan gas unlocked
          <select value={gasUnlocked === null ? '' : String(gasUnlocked)} onChange={(e) => setGasUnlocked(e.target.value === '' ? null : e.target.value === 'true')}>
            <option value="">—</option>
            <option value="true">true</option>
            <option value="false">false</option>
          </select>
        </label>
      </div>
      <button type="submit">Apply Override</button>
      {msg && <div className="small muted">{msg}</div>}
    </form>
  );
}

function PinPanel({ countries, credentials, onActed }) {
  const [busyCode, setBusyCode] = useState(null);

  const regenerate = async (code) => {
    setBusyCode(code);
    await callAction('admin:regeneratePin', { country: code }, credentials);
    setBusyCode(null);
    onActed();
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Hand each team their PIN before the game starts — they'll need it to open their country's page.
      </p>
      <table>
        <thead>
          <tr>
            <th>Country</th>
            <th>PIN</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Object.values(countries).map((c) => (
            <tr key={c.code}>
              <td>{c.flag} {c.name}</td>
              <td className="mono badge accent" style={{ fontSize: '1.1em', letterSpacing: '0.1em' }}>{c.accessPin}</td>
              <td>
                <button className="secondary small" disabled={busyCode === c.code} onClick={() => regenerate(c.code)}>
                  ↺ New PIN
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CheckpointPanel({ availableCheckpoints, currentRound, credentials, onActed }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const restore = async (round) => {
    const confirmed = window.confirm(
      `Restore to the start of Round ${round}?\n\nThis erases everything that happened after that point (scores, resources, trades, special move uses — for every country) and cannot be undone.`
    );
    if (!confirmed) return;
    setBusy(true);
    const res = await callAction('admin:restoreRound', { round }, credentials);
    setBusy(false);
    setMsg(res.ok ? `Restored to Round ${round}.` : res.reason);
    if (res.ok) onActed();
  };

  return (
    <div>
      <p className="small muted" style={{ marginTop: 0 }}>
        A checkpoint is saved automatically at the start of every round. Use this if something goes wrong
        (a wrong override, a disputed trade, a bug) and you need to undo it.
      </p>
      <div className="row wrap">
        {availableCheckpoints.map((round) => (
          <button
            key={round}
            className="secondary"
            disabled={busy}
            onClick={() => restore(round)}
          >
            ⏮ Round {round}{round === currentRound ? ' (reset this round)' : ''}
          </button>
        ))}
      </div>
      {msg && <div className="small muted" style={{ marginTop: 8 }}>{msg}</div>}
    </div>
  );
}

function CountryTable({ countries }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <p className="small muted" style={{ marginTop: 0 }}>Each cell shows current stock, with this round's production rate below it.</p>
      <table>
        <thead>
          <tr>
            <th>Country</th>
            {RESOURCE_KEYS.map((r) => <th key={r}>{RESOURCE_ICONS[r]}</th>)}
            <th>Req E/W/F</th>
            <th>Score</th>
            <th>Move left</th>
            <th>Reinvest#</th>
            <th>TKM gas</th>
            <th>R9</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(countries).map((c) => (
            <tr key={c.code}>
              <td>{c.flag} {c.name}</td>
              {RESOURCE_KEYS.map((r) => (
                <td key={r} className="mono">
                  {c.resources[r]}
                  <div className="muted" style={{ fontSize: '0.75em' }}>+{c.production[r]}</div>
                </td>
              ))}
              <td className="mono">{c.requirement.energy}/{c.requirement.water}/{c.requirement.food}</td>
              <td className="mono">{c.score}</td>
              <td className="mono">{c.specialMove.usesLeft}/{c.specialMove.usesMax}</td>
              <td className="mono">{c.reinvestCountUsed}</td>
              <td className="mono">{c.gasUnlocked ? 'yes' : '-'}</td>
              <td className="mono">{c.round9Choice ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminConsole({ password, onAuthFailed }) {
  const [credentials] = useState({ role: 'admin', password });
  const { data, refetch } = usePolling(() => fetchState(credentials), 2000, [password]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data && !data.ok) onAuthFailed(data.reason);
  }, [data, onAuthFailed]);

  const act = async (action, payload) => {
    setBusy(true);
    const res = await callAction(action, payload, credentials);
    setBusy(false);
    if (!res.ok) alert(res.reason);
    else refetch();
  };

  if (!data || !data.ok) return <div className="app-shell">Loading admin console...</div>;
  const state = data.view;

  return (
    <div className="app-shell">
      <div className="row between panel" style={{ marginBottom: 24, padding: '18px 28px' }}>
        <div>
          <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>THE TABLE · Admin</div>
          <h1 className="brand-title" style={{ margin: 0, fontSize: '2em' }}>Round {state.round} <span className="muted" style={{ fontSize: '0.55em' }}>of {state.totalRounds}</span></h1>
        </div>
        <Timer timer={state.timer} big />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2><span className="section-icon">🔑</span>Team Access PINs</h2>
        <PinPanel countries={state.countries} credentials={credentials} onActed={refetch} />
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="badge accent" style={{ marginBottom: 12 }}>{nextStepHint(state)}</div>
        <div className="row wrap">
          <button
            disabled={busy || !!revealEventDisabledReason(state)}
            title={revealEventDisabledReason(state) || undefined}
            onClick={() => act('admin:revealEvent')}
          >
            📰 Reveal Event
          </button>
          <button
            disabled={
              busy ||
              state.timer.running ||
              state.phase === 'locked' ||
              state.phase === 'voting' ||
              state.phase === 'game_over' ||
              (!state.eventRevealed && !NO_PRE_REVEAL_ROUNDS.includes(state.round))
            }
            title={!state.eventRevealed && !NO_PRE_REVEAL_ROUNDS.includes(state.round) ? 'Reveal this round\'s event first' : undefined}
            onClick={() => act('admin:startTimer')}
          >
            ▶ Start Timer
          </button>
          <button disabled={busy || !state.timer.running} className="secondary" onClick={() => act('admin:pauseTimer')}>⏸ Pause</button>
          <button disabled={busy} className="secondary" onClick={() => act('admin:resetTimer')}>↺ Reset Timer</button>
          {state.round === 9 && (
            <button
              disabled={busy || state.round9.revealed || state.phase !== 'voting' || !state.eventRevealed}
              title={state.phase !== 'voting' ? 'Wait for trading to close first' : !state.eventRevealed ? 'Reveal Event first' : undefined}
              onClick={() => act('admin:revealRound9')}
            >
              🗳 Reveal Round 9 Results
            </button>
          )}
          <button
            disabled={busy || state.phase !== 'locked' || (state.round === 9 && !state.round9.revealed)}
            title={state.round === 9 && !state.round9.revealed ? 'Reveal Round 9 Results first' : undefined}
            onClick={() => act('admin:nextRound')}
          >
            Next Round →
          </button>
        </div>
        <div className="row between" style={{ marginTop: 12 }}>
          <span className="badge accent">Phase: {state.phase}</span>
          <button
            disabled={busy || state.phase === 'locked' || state.phase === 'voting' || state.phase === 'game_over'}
            className="danger small"
            title="Testing only: skips the real-time wait and scores the round immediately"
            onClick={() => act('admin:forceEndRound')}
          >
            ⏭ Force End Round (debug)
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <h2><span className="section-icon">⏮</span>Round Checkpoints</h2>
        <CheckpointPanel availableCheckpoints={state.availableCheckpoints} currentRound={state.round} credentials={credentials} onActed={refetch} />
      </div>

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 20 }}>
        <div className="card grow" style={{ minWidth: 600 }}>
          <h2><span className="section-icon">🌐</span>Full Country View</h2>
          <CountryTable countries={state.countries} />
        </div>
        <div className="card" style={{ minWidth: 300 }}>
          <h2><span className="section-icon">📰</span>News</h2>
          <NewsFeed news={state.news} />
        </div>
      </div>

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 20, marginTop: 20 }}>
        <div className="card grow" style={{ minWidth: 300 }}>
          <h2><span className="section-icon">🚫</span>Apply Language Penalty</h2>
          <PenaltyForm credentials={credentials} onActed={refetch} />
        </div>
        <div className="card grow" style={{ minWidth: 300 }}>
          <h2><span className="section-icon">🛠</span>Manual Override</h2>
          <OverrideForm credentials={credentials} onActed={refetch} />
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2><span className="section-icon">✉️</span>Pending Trade Offers ({state.pendingOffers.length})</h2>
        {state.pendingOffers.length === 0 && <div className="muted small">None.</div>}
        {state.pendingOffers.map((o) => (
          <div key={o.id} className="small" style={{ padding: '4px 0' }}>
            #{o.id} {o.from} → {o.to}: gives {o.give.qty} {o.give.resource}, wants {o.want.qty} {o.want.resource}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2><span className="section-icon">⚡</span>Special Move Log</h2>
        {state.specialMoveLog.slice().reverse().map((e) => (
          <div key={e.id} className="small" style={{ padding: '4px 0' }}>
            R{e.round} — {e.country} used {e.moveId}{e.targetCountry ? ` (target: ${e.targetCountry})` : ''}{e.cancelled ? ` — CANCELLED by ${e.cancelledBy}` : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState(null);
  const [error, setError] = useState(null);

  if (password === null) {
    return <LoginForm error={error} onSubmit={(pw) => { setError(null); setPassword(pw); }} />;
  }
  return (
    <AdminConsole
      key={password}
      password={password}
      onAuthFailed={(reason) => { setError(reason); setPassword(null); }}
    />
  );
}
