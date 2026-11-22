export function SourcePath({
  line,
  path,
}: {
  line: number | null;
  path: string;
}) {
  const fileStart = path.lastIndexOf("/") + 1;
  const location = line === null ? path : `${path}:${line}`;
  return (
    <p className="dt-path" title={location}>
      <bdi dir="ltr">
        <span className="dt-path-dir">{path.slice(0, fileStart)}</span>
        <span className="dt-path-file">{path.slice(fileStart)}</span>
        {line !== null && <span className="dt-path-line">:{line}</span>}
      </bdi>
    </p>
  );
}
