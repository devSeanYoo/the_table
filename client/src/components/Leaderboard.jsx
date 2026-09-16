const MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard({ leaderboard }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Country</th>
          <th>Score</th>
        </tr>
      </thead>
      <tbody>
        {leaderboard.map((row, i) => {
          const rank = i + 1;
          return (
            <tr key={row.code} className={`leaderboard-row rank-${rank}`}>
              <td><span className="leaderboard-rank">{MEDALS[rank] ?? rank}</span></td>
              <td>{row.flag} {row.name}</td>
              <td className="mono" style={{ fontWeight: 700 }}>{row.score}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
