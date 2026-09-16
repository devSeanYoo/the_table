import { useNavigate, Link } from 'react-router-dom';
import { COUNTRY_LIST } from '../countryList';

export default function CountrySelect() {
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <Link to="/" className="small muted" style={{ textDecoration: 'none' }}>← Home</Link>
      <h1 className="brand-title" style={{ marginTop: 8 }}>Choose Your Country</h1>
      <p className="muted">No password needed — just pick your team's country.</p>
      <div className="row wrap" style={{ gap: 16, marginTop: 16 }}>
        {COUNTRY_LIST.map((c) => (
          <button
            key={c.code}
            className="secondary col center"
            style={{ padding: '22px 28px', minWidth: 140, gap: 8 }}
            onClick={() => navigate(`/play/${c.code}`)}
          >
            <div className="flag-tile">{c.flag}</div>
            <div style={{ fontWeight: 700 }}>{c.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
