export interface ConfigIssue {
  message: string;
  path: string;
}

export function ConfigIssues({ issues }: { issues: ConfigIssue[] }) {
  return (
    <section aria-label="Config issues" className="dt-card">
      <h3 className="dt-card-title">retouche.config is invalid</h3>
      <ul className="dt-issues">
        {issues.map((issue) => (
          <li key={`${issue.path}:${issue.message}`}>
            <code>{issue.path || "config"}</code> {issue.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
