import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { fetchState, callAction, usePolling } from '../api';
import Timer from '../components/Timer';
import RulesPanel from '../components/RulesPanel';
import ResourceRow from '../components/ResourceRow';
import { RESOURCE_KEYS, RESOURCE_ICONS, RESOURCE_LABELS } from '../resourceIcons';
import { COUNTRY_LIST } from '../countryList';

function SecretCard({ title, children, defaultHidden = true }) {
  const [hidden, setHidden] = useState(defaultHidden);
  return (
    <div className="card">
      <div className="row between">
        <h2 style={{ margin: 0 }}>{title}</h2>
        <button className="secondary small" onClick={() => setHidden((h) => !h)}>
          {hidden ? '👁 Show' : '🙈 Hide'}
        </button>
      </div>
      {hidden ? (
        <div className="secret-veil" onClick={() => setHidden(false)}>
          🔒 Tap to reveal — make sure no one else can see your screen first
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>{children}</div>
      )}
    </div>
  );
}

function ProposeTradeForm({ credentials, others, phaseActive, onActed }) {
  const [to, setTo] = useState(others[0]?.code);
  const [giveResource, setGiveResource] = useState('oil');
  const [giveQty, setGiveQty] = useState(0);
  const [wantResource, setWantResource] = useState('water');
  const [wantQty, setWantQty] = useState(0);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const res = await callAction('country:proposeTrade', {
      to,
      give: { resource: giveResource, qty: Number(giveQty) },
      want: { resource: wantResource, qty: Number(wantQty) },
    }, credentials);
    setMsg(res.ok ? 'Offer sent!' : res.reason);
    if (res.ok) { setGiveQty(0); setWantQty(0); onActed(); }
  };

  return (
    <form className="col" onSubmit={submit}>
      <label className="small">To
        <select value={to} onChange={(e) => setTo(e.target.value)} style={{ marginLeft: 8 }}>
          {others.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
        </select>
      </label>
      <div className="row wrap">
        <div className="col">
          <span className="small muted">You give</span>
          <div className="row">
            <select value={giveResource} onChange={(e) => setGiveResource(e.target.value)}>
              {RESOURCE_KEYS.map((r) => <option key={r} value={r}>{RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}</option>)}
            </select>
            <input type="number" min="0" value={giveQty} onChange={(e) => setGiveQty(e.target.value)} style={{ width: 60 }} />
          </div>
        </div>
        <div className="col">
          <span className="small muted">You receive</span>
          <div className="row">
            <select value={wantResource} onChange={(e) => setWantResource(e.target.value)}>
              {RESOURCE_KEYS.map((r) => <option key={r} value={r}>{RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}</option>)}
            </select>
            <input type="number" min="0" value={wantQty} onChange={(e) => setWantQty(e.target.value)} style={{ width: 60 }} />
          </div>
        </div>
      </div>
      <button type="submit" disabled={!phaseActive}>Propose Trade</button>
      {!phaseActive && <div className="small muted">Trading is closed right now.</div>}
      {msg && <div className="small muted">{msg}</div>}
    </form>
  );
}

function CounterForm({ offer, onDone, phaseActive, credentials }) {
  const [giveResource, setGiveResource] = useState(offer.want.resource);
  const [giveQty, setGiveQty] = useState(offer.want.qty);
  const [wantResource, setWantResource] = useState(offer.give.resource);
  const [wantQty, setWantQty] = useState(offer.give.qty);
  const [msg, setMsg] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    const res = await callAction('country:counterTrade', {
      offerId: offer.id,
      give: { resource: giveResource, qty: Number(giveQty) },
      want: { resource: wantResource, qty: Number(wantQty) },
    }, credentials);
    setMsg(res.ok ? 'Counter sent.' : res.reason);
    if (res.ok) onDone();
  };

  return (
    <form className="col small" onSubmit={submit} style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
      <div className="row wrap">
        <span>You give</span>
        <select value={giveResource} onChange={(e) => setGiveResource(e.target.value)}>
          {RESOURCE_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="number" min="0" value={giveQty} onChange={(e) => setGiveQty(e.target.value)} style={{ width: 50 }} />
        <span>you get</span>
        <select value={wantResource} onChange={(e) => setWantResource(e.target.value)}>
          {RESOURCE_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <input type="number" min="0" value={wantQty} onChange={(e) => setWantQty(e.target.value)} style={{ width: 50 }} />
        <button type="submit" disabled={!phaseActive}>Send Counter</button>
      </div>
      {msg && <div className="muted">{msg}</div>}
    </form>
  );
}

function TradeOffers({ incomingOffers, phaseActive, credentials, onActed }) {
  const [counteringId, setCounteringId] = useState(null);
  const [msg, setMsg] = useState({});

  const respond = async (offerId, action) => {
    const res = await callAction(action, { offerId }, credentials);
    setMsg((m) => ({ ...m, [offerId]: res.ok ? 'Done.' : res.reason }));
    if (res.ok) onActed();
  };

  if (incomingOffers.length === 0) return <div className="muted small">No offers right now.</div>;

  return (
    <div className="col">
      {incomingOffers.map((o) => (
        <div key={o.id} className="card">
          <div>
            <strong>{o.from}</strong> offers you {o.give.qty} {RESOURCE_ICONS[o.give.resource]} {o.give.resource}
            {' '}for {o.want.qty} {RESOURCE_ICONS[o.want.resource]} {o.want.resource}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button disabled={!phaseActive} onClick={() => respond(o.id, 'country:acceptTrade')}>Accept</button>
            <button disabled={!phaseActive} className="secondary" onClick={() => respond(o.id, 'country:rejectTrade')}>Reject</button>
            <button disabled={!phaseActive} className="secondary" onClick={() => setCounteringId(counteringId === o.id ? null : o.id)}>Counter-Offer</button>
          </div>
          {msg[o.id] && <div className="small muted">{msg[o.id]}</div>}
          {counteringId === o.id && (
            <CounterForm
              offer={o}
              phaseActive={phaseActive}
              credentials={credentials}
              onDone={() => { setCounteringId(null); onActed(); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SpecialMoveBox({ view, phaseActive, credentials, onActed }) {
  const sm = view.specialMove;
  const [msg, setMsg] = useState(null);
  const [blockTarget, setBlockTarget] = useState('');
  const [swapGive, setSwapGive] = useState('oil');
  const [swapReceive, setSwapReceive] = useState('water');

  const disabledBase = !phaseActive || sm.usesLeft <= 0 || sm.usedThisRound;
  const isReactive = !!sm.reactive;
  const reactiveReady = sm.reactiveAvailable === true;

  const fire = async (payload) => {
    const res = await callAction('country:useSpecialMove', payload, credentials);
    setMsg(res.ok ? 'Special Move used!' : res.reason);
    if (res.ok) onActed();
  };

  return (
    <>
      <h3 style={{ marginTop: 0 }}><span className="section-icon">⚡</span>{sm.name} <span className="badge accent">{sm.usesLeft}/{sm.usesMax} left</span> <span className="badge">{sm.visibility}</span></h3>
      <p className="small muted">{sm.description}</p>

      {sm.id === 'BLOCK_IT' && (
        <div className="col">
          <select value={blockTarget} onChange={(e) => setBlockTarget(e.target.value)}>
            <option value="">Choose a Special Move to cancel...</option>
            {view.blockableMoves.map((m) => (
              <option key={m.id} value={m.id}>{m.country} — {m.moveName}</option>
            ))}
          </select>
          <button disabled={disabledBase || !blockTarget} onClick={() => fire({ targetLogId: Number(blockTarget) })}>Use Block It</button>
        </div>
      )}

      {sm.id === 'QUICK_SWAP' && (
        <div className="col">
          <div className="row wrap">
            <select value={swapGive} onChange={(e) => setSwapGive(e.target.value)}>
              {RESOURCE_KEYS.map((r) => <option key={r} value={r}>give {r}</option>)}
            </select>
            <select value={swapReceive} onChange={(e) => setSwapReceive(e.target.value)}>
              {RESOURCE_KEYS.map((r) => <option key={r} value={r}>get {r}</option>)}
            </select>
          </div>
          <button disabled={disabledBase} onClick={() => fire({ giveResource: swapGive, receiveResource: swapReceive })}>Use Quick Swap</button>
        </div>
      )}

      {isReactive && sm.id !== 'BLOCK_IT' && (
        <button disabled={disabledBase || !reactiveReady} onClick={() => fire({})}>
          {reactiveReady ? `Use ${sm.name}` : 'Not available right now'}
        </button>
      )}

      {!isReactive && sm.id !== 'QUICK_SWAP' && sm.id !== 'BLOCK_IT' && (
        <button disabled={disabledBase} onClick={() => fire({})}>
          {sm.usedThisRound ? 'Already used this round' : `Use ${sm.name}`}
        </button>
      )}

      {sm.usedThisRound && <div className="small muted" style={{ marginTop: 6 }}>One use per round — try again next round.</div>}
      {msg && <div className="small muted" style={{ marginTop: 6 }}>{msg}</div>}
    </>
  );
}

function ReinvestBox({ view, phaseActive, credentials, onActed }) {
  const [resource, setResource] = useState(view.reinvestOptions[0]);
  const [msg, setMsg] = useState(null);

  const submit = async () => {
    const res = await callAction('country:buildForFuture', { resource }, credentials);
    setMsg(res.ok ? `Built! ${resource} +1 starting round ${res.effectiveRound}.` : res.reason);
    if (res.ok) onActed();
  };

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><span className="section-icon">🏗</span>Build for the Future</h3>
      <p className="small muted">Next cost: {view.reinvest.nextCost} Mineral + {view.reinvest.nextCost} Power</p>
      <div className="row">
        <select value={resource} onChange={(e) => setResource(e.target.value)}>
          {view.reinvestOptions.map((r) => <option key={r} value={r}>{RESOURCE_ICONS[r]} {RESOURCE_LABELS[r]}</option>)}
        </select>
        <button disabled={!phaseActive || view.reinvest.usedThisRound} onClick={submit}>Build</button>
      </div>
      {view.reinvest.usedThisRound && <div className="small muted">Already used this round.</div>}
      {msg && <div className="small muted">{msg}</div>}
    </div>
  );
}

function Round9Box({ view, phaseActive, credentials, onActed }) {
  const [msg, setMsg] = useState(null);
  const choose = async (choice) => {
    const res = await callAction('country:submitRound9', { choice }, credentials);
    setMsg(res.ok ? `Submitted: ${choice}` : res.reason);
    if (res.ok) onActed();
  };
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}><span className="section-icon">🌍</span>Round 9: The Climate Deal</h3>
      <p className="small muted">Trading has closed — pick now, before results are revealed. Your current choice: <strong>{view.round9Choice ?? 'none yet'}</strong></p>
      <div className="row">
        <button disabled={!phaseActive} onClick={() => choose('comply')}>Comply</button>
        <button disabled={!phaseActive} className="secondary" onClick={() => choose('ignore')}>Ignore</button>
      </div>
      {msg && <div className="small muted">{msg}</div>}
    </div>
  );
}

function PinGate({ code, onSubmit, error, busy }) {
  const [pin, setPin] = useState('');
  const info = COUNTRY_LIST.find((c) => c.code === code);

  const submit = (e) => {
    e.preventDefault();
    onSubmit(pin);
  };

  return (
    <div className="app-shell col center" style={{ minHeight: '100vh' }}>
      <form className="card col" onSubmit={submit} style={{ width: 320, padding: '32px 28px', textAlign: 'center' }}>
        <div className="flag-tile" style={{ margin: '0 auto' }}>{info?.flag}</div>
        <h2 style={{ marginTop: 4, marginBottom: 4 }}>{info?.name}</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Ask your teacher for your team's PIN.</p>
        <input
          type="text"
          inputMode="numeric"
          placeholder="4-digit PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          style={{ textAlign: 'center', fontSize: '1.2em', letterSpacing: '0.2em' }}
        />
        {error && <div className="badge bad">{error}</div>}
        <button disabled={busy} type="submit">Enter</button>
      </form>
    </div>
  );
}

function PersonalConsole({ code, pin, onAuthFailed }) {
  const [credentials] = useState({ role: 'country', country: code, pin });
  const { data, refetch } = usePolling(() => fetchState(credentials), 2000, [code, pin]);

  useEffect(() => {
    if (data && !data.ok) onAuthFailed(data.reason);
  }, [data, onAuthFailed]);

  if (!data || !data.ok) return <div className="app-shell">Connecting as {code}...</div>;

  const pub = data.public;
  const view = data.country;
  const phaseActive = pub.phase === 'active';

  return (
    <div className="app-shell">
      <div className="row between panel" style={{ marginBottom: 20, padding: '16px 24px' }}>
        <h1 className="brand-title" style={{ margin: 0, fontSize: '1.7em' }}>
          <span className="flag-tile" style={{ fontSize: '1em', verticalAlign: 'middle', marginRight: 10 }}>{view.flag}</span>
          {view.name} <span className="badge accent" style={{ verticalAlign: 'middle' }}>Score {view.score}</span>
        </h1>
        <div className="row" style={{ gap: 20 }}>
          <span className="muted">Round {pub.round} of {pub.totalRounds}</span>
          <Timer timer={pub.timer} />
        </div>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="row between wrap" style={{ gap: 16 }}>
          <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎯 This Round, You Need</div>
          <div className="row wrap" style={{ gap: 10 }}>
            <span className="resource-pill" style={{ '--res-color': 'var(--res-oil)' }}>⚡ Energy ≥ {view.requirement.energy}</span>
            <span className="resource-pill" style={{ '--res-color': 'var(--res-water)' }}>💧 Water ≥ {view.requirement.water}</span>
            <span className="resource-pill" style={{ '--res-color': 'var(--res-food)' }}>🌾 Food ≥ {view.requirement.food}</span>
          </div>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Meet each one for +3 points (and it's used up). Miss one and it's -3, but nothing is used. Energy = Oil + Gas combined.
        </p>
      </div>

      <RulesPanel />

      <div className="row wrap" style={{ gap: 20, marginTop: 20, alignItems: 'flex-start' }}>
        <div className="col grow" style={{ minWidth: 320, gap: 20 }}>
          <SecretCard title="Your Country Card">
            <p className="small muted" style={{ fontStyle: 'italic' }}>{view.flavor}</p>
            <p className="small"><strong>Passive:</strong> {view.passiveText}</p>
          </SecretCard>

          <SecretCard title="Your Resources">
            <ResourceRow resources={view.resources} production={view.production} />
            <p className="small muted" style={{ marginBottom: 0, marginTop: 10 }}>(+N/rd) is how much of that resource you produce every round.</p>
          </SecretCard>

          <SecretCard title="Your Special Move">
            <SpecialMoveBox view={view} phaseActive={phaseActive} credentials={credentials} onActed={refetch} />
          </SecretCard>
          <ReinvestBox view={view} phaseActive={phaseActive} credentials={credentials} onActed={refetch} />
          {pub.round === 9 && pub.eventRevealed && (
            <Round9Box view={view} phaseActive={pub.phase === 'voting'} credentials={credentials} onActed={refetch} />
          )}
        </div>

        <div className="col grow" style={{ minWidth: 320, gap: 20 }}>
          <div className="card">
            <h2 style={{ marginTop: 0 }}><span className="section-icon">🤝</span>Propose Trade</h2>
            <ProposeTradeForm credentials={credentials} others={view.otherCountries} phaseActive={phaseActive} onActed={refetch} />
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}><span className="section-icon">📥</span>Trade Offers (Inbox)</h2>
            <TradeOffers incomingOffers={view.incomingOffers} phaseActive={phaseActive} credentials={credentials} onActed={refetch} />
          </div>

          <div className="card">
            <h2 style={{ marginTop: 0 }}><span className="section-icon">📜</span>Trade History</h2>
            {view.tradeHistory.length === 0 && <div className="muted small">No trades yet.</div>}
            {view.tradeHistory.slice().reverse().map((o) => (
              <div key={o.id} className="small" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border-soft)' }}>
                <span className="badge" style={{ marginRight: 8 }}>R{o.round}</span>
                {o.from} → {o.to} · {o.give.qty} {o.give.resource} for {o.want.qty} {o.want.resource} · {o.status}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PersonalPage() {
  const { code } = useParams();
  const known = COUNTRY_LIST.some((c) => c.code === code);
  const [pin, setPin] = useState(null);
  const [error, setError] = useState(null);

  if (!known) return <Navigate to="/play" replace />;

  if (pin === null) {
    return <PinGate key={code} code={code} error={error} onSubmit={(p) => { setError(null); setPin(p); }} />;
  }
  return (
    <PersonalConsole
      key={`${code}:${pin}`}
      code={code}
      pin={pin}
      onAuthFailed={(reason) => { setError(reason); setPin(null); }}
    />
  );
}
