export default function NewsFeed({ news }) {
  const items = [...news].reverse();
  return (
    <div className="news-feed">
      {items.length === 0 && <div className="muted small">No news yet.</div>}
      {items.map((item) => (
        <div className="news-item" key={item.id}>
          <div className="news-round">Round {item.round}</div>
          <div>{item.text}</div>
        </div>
      ))}
    </div>
  );
}
