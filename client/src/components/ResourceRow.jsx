import { RESOURCE_ICONS, RESOURCE_KEYS, RESOURCE_LABELS } from '../resourceIcons';

export default function ResourceRow({ resources, production, onlyNonZero }) {
  const keys = onlyNonZero ? RESOURCE_KEYS.filter((k) => resources[k] > 0) : RESOURCE_KEYS;
  return (
    <div className="row wrap">
      {keys.map((k) => (
        <span
          className="resource-pill"
          key={k}
          title={RESOURCE_LABELS[k]}
          style={{ '--res-color': `var(--res-${k})` }}
        >
          <span className="icon">{RESOURCE_ICONS[k]}</span> {resources[k]}
          {production && (
            <span className="small muted" style={{ marginLeft: 2 }}>
              (+{production[k]}/rd)
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
