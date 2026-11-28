import type { EditorId } from "../../../protocol";
import { CodeHead, useSourceFile } from "../../code/code-panel";
import { SourcePath } from "../../code/source-path";
import { type CodeMarks, readSource } from "../../code/source-reading";
import { SourceView } from "../../code/source-view";
import { LineText } from "../../code/syntax/line-text";
import { syntaxLines } from "../../code/syntax/syntax-lines";
import type { SourceRequest } from "../../route/dev-route";
import type { DevRouteState } from "../../route/use-dev-route";
import { spliceAllowEntry } from "./allow-splice";

const CONFIG_FILE = "retouche.config.ts";
const CONFIG_REQUEST: SourceRequest = {
  column: null,
  fileName: CONFIG_FILE,
  line: null,
  mappedCode: null,
};
const ADDED: CodeMarks = { change: "added", scope: "element", tokens: [] };

function EntrySnippet({ entry }: { entry: string }) {
  const indented = entry.split("\n").map((line) => ` ${line}`);
  const lines = syntaxLines(
    ["allow: [", ...indented, "]"].join("\n"),
    CONFIG_FILE
  );
  return (
    <>
      <div className="dt-code-head">
        <SourcePath line={null} path={CONFIG_FILE} />
      </div>
      <div className="dt-code-frame">
        <pre className="dt-code">
          <code className="dt-code-lines">
            {lines.map((line, index) => {
              const isEntry = index > 0 && index < lines.length - 1;
              return (
                <span
                  className="dt-line"
                  data-marked={isEntry ? "true" : undefined}
                  key={index}
                >
                  <span className="dt-line-number">{isEntry ? "+" : null}</span>
                  <span>
                    <LineText
                      change={ADDED.change}
                      line={line}
                      pattern={null}
                    />
                  </span>
                </span>
              );
            })}
          </code>
        </pre>
      </div>
    </>
  );
}

function ConfigFile({ editor, entry }: { editor: EditorId; entry: string }) {
  const state = useSourceFile(CONFIG_REQUEST);
  if (state.kind === "loading") {
    return <p className="dt-status">Opening the file…</p>;
  }
  const spliced =
    state.kind === "ready" ? spliceAllowEntry(state.file.code, entry) : null;
  if (!(state.kind === "ready" && spliced)) {
    return <EntrySnippet entry={entry} />;
  }
  const { inserted } = spliced;
  const file = { ...state.file, line: inserted.start };
  const reading = readSource(
    { ...file, code: spliced.code, elementLines: inserted },
    ADDED
  );
  return (
    <>
      <CodeHead editor={editor} file={file} />
      <SourceView
        key={entry}
        marks={ADDED}
        reading={{ ...reading, inserted }}
      />
    </>
  );
}

export function ConfigEntry({
  entry,
  route,
}: {
  entry: string;
  route: DevRouteState;
}) {
  return route.kind === "ready" ? (
    <ConfigFile editor={route.status.editor} entry={entry} />
  ) : (
    <EntrySnippet entry={entry} />
  );
}
