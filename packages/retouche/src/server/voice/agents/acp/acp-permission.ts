import {
  type ClientConnection,
  client,
  methods,
  type PermissionOptionKind,
  type RequestPermissionOutcome,
  type RequestPermissionRequest,
  type SessionUpdate,
  type Stream,
  type ToolKind,
} from "@agentclientprotocol/sdk";

const READ_ONLY_KINDS: ReadonlySet<ToolKind> = new Set(["read", "search"]);

const ALLOW: PermissionOptionKind[] = ["allow_once"];

const REFUSE: PermissionOptionKind[] = ["reject_once", "reject_always"];

function rememberToolKind(
  toolKinds: Map<string, ToolKind>,
  update: SessionUpdate
): void {
  if (
    (update.sessionUpdate === "tool_call" ||
      update.sessionUpdate === "tool_call_update") &&
    update.kind
  ) {
    toolKinds.set(update.toolCallId, update.kind);
  }
}

function permissionOutcome(
  request: RequestPermissionRequest,
  toolKinds: Map<string, ToolKind>
): RequestPermissionOutcome {
  const { kind, toolCallId } = request.toolCall;
  const toolKind = kind ?? toolKinds.get(toolCallId);
  const wanted =
    toolKind !== undefined && READ_ONLY_KINDS.has(toolKind) ? ALLOW : REFUSE;
  const option = wanted
    .map((optionKind) =>
      request.options.find((candidate) => candidate.kind === optionKind)
    )
    .find((candidate) => candidate !== undefined);
  return option === undefined
    ? { outcome: "cancelled" }
    : { optionId: option.optionId, outcome: "selected" };
}

export function connectAgent(stream: Stream): ClientConnection {
  const toolKinds = new Map<string, ToolKind>();
  return client({ name: "retouche" })
    .onNotification(methods.client.session.update, ({ params }) => {
      rememberToolKind(toolKinds, params.update);
    })
    .onRequest(methods.client.session.requestPermission, ({ params }) => ({
      outcome: permissionOutcome(params, toolKinds),
    }))
    .connect(stream);
}
