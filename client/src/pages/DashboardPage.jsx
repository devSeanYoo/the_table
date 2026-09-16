import { fetchState, usePolling } from '../api';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import NewsFeed from '../components/NewsFeed';

const CREDENTIALS = { role: 'dashboard' };

export default function DashboardPage() {
  const { data } = usePolling(() => fetchState(CREDENTIALS), 2000, []);

  if (!data || !data.ok) return <div className="app-shell">Connecting...</div>;
  const pub = data.view;

  return (
    <div className="app-shell">
      <div className="row between panel" style={{ marginBottom: 28, padding: '18px 28px' }}>
        <div>
          <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>THE TABLE</div>
          <h1 className="brand-title" style={{ margin: 0, fontSize: '2.2em' }}>Round {pub.round} <span className="muted" style={{ fontSize: '0.5em' }}>of {pub.totalRounds}</span></h1>
        </div>
        <Timer timer={pub.timer} big />
      </div>

      <div className="row wrap" style={{ alignItems: 'flex-start', gap: 24 }}>
        <div className="card grow" style={{ minWidth: 340, flexBasis: 480 }}>
          <h2><span className="section-icon">🏆</span>Leaderboard</h2>
          <Leaderboard leaderboard={pub.leaderboard} />
        </div>
        <div className="card grow" style={{ minWidth: 320, flexBasis: 380 }}>
          <h2><span className="section-icon">📰</span>News</h2>
          <NewsFeed news={pub.news} />
        </div>
      </div>
    </div>
  );
}
