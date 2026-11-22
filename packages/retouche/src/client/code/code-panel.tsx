import { useEffect, useState } from "react";

import type { EditorId, SourceFile } from "../../protocol";
import { fetchSourceFile, type SourceRequest } from "../route/dev-route";
import { EditorIcon } from "../shell/icons";
import { editorUrl } from "./editor-url";
import { SourcePath } from "./source-path";
import { type CodeMarks, readSource } from "./source-reading";
import { SourceView } from "./source-view";

type SourceState =
  | { kind: "failed"; message: string }
  | { kind: "loading" }
  | { file: SourceFile; fileName: string; kind: "ready" };

interface LoadedSource {
  request: SourceRequest;
  state: SourceState;
}

const LOADING: SourceState = { kind: "loading" };

async function readSourceState(request: SourceRequest): Promise<SourceState> {
  try {
    const file = await fetchSourceFile(request);
    return { file, fileName: request.fileName, kind: "ready" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read the file.";
    return { kind: "failed", message };
  }
}

export function useSourceFile(request: SourceRequest): SourceState {
  const [loaded, setLoaded] = useState<LoadedSource | null>(null);
  useEffect(() => {
    let isCurrent = true;
    const load = async () => {
      const state = await readSourceState(request);
      if (isCurrent) {
        setLoaded({ request, state });
      }
    };
    void load();
    return () => {
      isCurrent = false;
    };
  }, [request]);
  if (loaded?.request === request) {
    return loaded.state;
  }
  const shown = loaded?.state;
  return shown?.kind === "ready" && shown.fileName === request.fileName
    ? shown
    : LOADING;
}

export function CodeHead({
  editor,
  file,
}: {
  editor: EditorId;
  file: SourceFile;
}) {
  return (
    <div className="dt-code-head">
      <SourcePath line={file.line} path={file.path} />
      <a
        aria-label="Open in editor"
        className="icon-btn"
        href={editorUrl(editor, file)}
        title="Open in editor"
      >
        <EditorIcon />
      </a>
    </div>
  );
}

export function CodePanel({
  editor,
  marks,
  request,
}: {
  editor: EditorId;
  marks: CodeMarks;
  request: SourceRequest;
}) {
  const state = useSourceFile(request);
  if (state.kind === "loading") {
    return <p className="dt-status">Opening the file…</p>;
  }
  if (state.kind === "failed") {
    return <p className="dt-error">{state.message}</p>;
  }
  const { file } = state;
  return (
    <>
      <CodeHead editor={editor} file={file} />
      <SourceView
        key={`${file.path}:${file.line}`}
        marks={marks}
        reading={readSource(file, marks)}
      />
    </>
  );
}
