import { Link } from 'react-router-dom';
import { COUNTRY_LIST } from '../countryList';

export default function Home() {
  return (
    <div className="app-shell col center" style={{ minHeight: '100vh' }}>
      <div className="row wrap center" style={{ gap: 4, marginBottom: 28, maxWidth: 420 }}>
        {COUNTRY_LIST.map((c) => (
          <span key={c.code} style={{ fontSize: '1.5em', opacity: 0.85 }} title={c.name}>{c.flag}</span>
        ))}
      </div>

      <div className="card col center" style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '44px 40px' }}>
        <h1 className="brand-title" style={{ margin: 0, fontSize: '2.6em', letterSpacing: '0.06em' }}>THE TABLE</h1>
        <div className="divider" style={{ width: 80, margin: '16px 0' }} />
        <p className="muted" style={{ marginTop: 0 }}>A resource negotiation simulation — 9 countries, 6 resources, 10 rounds.</p>
        <div className="col" style={{ width: '100%', marginTop: 24, gap: 12 }}>
          <Link to="/play" style={{ textDecoration: 'none' }}><button style={{ width: '100%', padding: '12px 16px' }}>🌍 Play as a Country</button></Link>
          <Link to="/dashboard" style={{ textDecoration: 'none' }}><button className="secondary" style={{ width: '100%', padding: '12px 16px' }}>📺 Public Dashboard</button></Link>
          <Link to="/admin" style={{ textDecoration: 'none' }}><button className="secondary" style={{ width: '100%', padding: '12px 16px' }}>🛠 Admin</button></Link>
        </div>
      </div>
    </div>
  );
}
