import { RULES_TEXT } from '../rulesText';

export default function RulesPanel() {
  return (
    <div className="panel">
      <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
        📖 Rules Reference
      </div>
      {[RULES_TEXT.trackA, RULES_TEXT.trackB].map((section) => (
        <details className="rules" key={section.title}>
          <summary>{section.title}</summary>
          <ul style={{ margin: '4px 0 14px', paddingLeft: 22, lineHeight: 1.6 }}>
            {section.body.map((line, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{line}</li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
